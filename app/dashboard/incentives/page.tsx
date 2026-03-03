import Link from "next/link";
import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import {
  areas,
  branch,
  collections,
  employee_area_assignment,
  employee_branch_assignment,
  employee_info,
  incentive_rules,
  loan_records,
  roles,
  users,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<{
    branch?: string;
    month?: string;
  }>;
};

type RoleName = "Collector" | "Secretary" | "Branch Manager";

type EmployeeRow = {
  user_id: string;
  company_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

type IncentiveRule = {
  percentValue: number;
  flatAmount: number;
} | null;

type ComputedRow = {
  userId: string;
  employeeName: string;
  companyId: string;
  roleName: RoleName;
  branchName: string;
  baseAmount: number;
  percentValue: number | null;
  flatAmount: number | null;
  computedIncentive: number | null;
  missingRule: boolean;
};

const INCENTIVE_ROLE_NAMES: RoleName[] = ["Collector", "Secretary", "Branch Manager"];

function getCurrentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function resolveMonthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }

  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const startDate = new Date(Date.UTC(year, monthIndex, 1));

  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const nextMonthDate = new Date(Date.UTC(year, monthIndex + 1, 1));
  const endDate = new Date(nextMonthDate.getTime() - 86400000);

  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  };
}

function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function fullName(employee: Pick<EmployeeRow, "first_name" | "middle_name" | "last_name">) {
  return [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(" ");
}

function computeIncentive(baseAmount: number, rule: IncentiveRule) {
  if (!rule) {
    return null;
  }

  return (baseAmount * rule.percentValue) / 100 + rule.flatAmount;
}

function buildComputedRows(
  employees: EmployeeRow[],
  roleName: RoleName,
  branchName: string,
  baseAmountByUserId: Map<string, number>,
  fallbackBaseAmount: number,
  rule: IncentiveRule,
) {
  return employees.map<ComputedRow>((employee) => {
    const baseAmount = baseAmountByUserId.get(employee.user_id) ?? fallbackBaseAmount;
    return {
      userId: employee.user_id,
      employeeName: fullName(employee),
      companyId: employee.company_id,
      roleName,
      branchName,
      baseAmount,
      percentValue: rule?.percentValue ?? null,
      flatAmount: rule?.flatAmount ?? null,
      computedIncentive: computeIncentive(baseAmount, rule),
      missingRule: rule === null,
    };
  });
}

function sectionTotal(rows: ComputedRow[]) {
  return rows.reduce((sum, row) => sum + (row.computedIncentive ?? 0), 0);
}

export default async function IncentivesPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const selectedMonthRaw = String(params.month ?? getCurrentMonthValue());
  const selectedBranchRaw = String(params.branch ?? "all");
  const monthRange = resolveMonthRange(selectedMonthRaw);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Incentives</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Not logged in</p>
            <Link className="mt-3 inline-block text-sm underline" href="/login">
              Go to login
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const currentAppUser = await db
    .select({ role_id: users.role_id })
    .from(users)
    .where(eq(users.user_id, user.id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const currentRole = currentAppUser?.role_id
    ? await db
        .select({ role_name: roles.role_name })
        .from(roles)
        .where(eq(roles.role_id, currentAppUser.role_id))
        .limit(1)
        .then((rows) => rows[0] ?? null)
        .catch(() => null)
    : null;

  const isAdmin = currentRole?.role_name === "Admin";
  const isBranchManager = currentRole?.role_name === "Branch Manager";

  if (!isAdmin && !isBranchManager) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Incentives</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are logged in, but only Admin and Branch Manager users can view incentive computation.
            </p>
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const branches = await db
    .select({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
    })
    .from(branch)
    .orderBy(asc(branch.branch_name))
    .catch(() => []);

  let fixedBranchId: number | null = null;
  let fixedBranchName: string | null = null;

  if (isBranchManager) {
    const activeAssignments = await db
      .select({
        branch_id: employee_branch_assignment.branch_id,
      })
      .from(employee_branch_assignment)
      .where(
        and(
          eq(employee_branch_assignment.employee_user_id, user.id),
          isNull(employee_branch_assignment.end_date),
        ),
      )
      .catch(() => []);

    if (activeAssignments.length === 0) {
      return (
        <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>Incentive Computation</CardTitle>
              <CardDescription>Monthly incentives by branch and role</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                No active branch assignment found. You cannot view incentives until an active assignment is set.
              </p>
              <Link className="text-sm underline" href="/dashboard">
                Back to dashboard
              </Link>
            </CardContent>
          </Card>
        </main>
      );
    }

    const uniqueBranchIds = Array.from(new Set(activeAssignments.map((item) => item.branch_id)));

    if (uniqueBranchIds.length !== 1) {
      return (
        <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>Incentive Computation</CardTitle>
              <CardDescription>Monthly incentives by branch and role</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Multiple active branch assignments detected. Please contact Admin to resolve assignments.
              </p>
              <Link className="text-sm underline" href="/dashboard">
                Back to dashboard
              </Link>
            </CardContent>
          </Card>
        </main>
      );
    }

    const fixedBranch = await db
      .select({
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
      })
      .from(branch)
      .where(eq(branch.branch_id, uniqueBranchIds[0]))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null);

    if (!fixedBranch) {
      return (
        <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>Incentive Computation</CardTitle>
              <CardDescription>Monthly incentives by branch and role</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Active branch assignment points to an invalid branch.
              </p>
              <Link className="text-sm underline" href="/dashboard">
                Back to dashboard
              </Link>
            </CardContent>
          </Card>
        </main>
      );
    }

    fixedBranchId = fixedBranch.branch_id;
    fixedBranchName = fixedBranch.branch_name;
  }

  const selectedBranchId = isAdmin && /^\d+$/.test(selectedBranchRaw) ? Number(selectedBranchRaw) : null;
  const resolvedBranchId = isBranchManager ? fixedBranchId : selectedBranchId;
  const resolvedBranchName = isBranchManager
    ? fixedBranchName
    : branches.find((item) => item.branch_id === selectedBranchId)?.branch_name ?? null;

  const incentiveRoles = await db
    .select({
      role_id: roles.role_id,
      role_name: roles.role_name,
    })
    .from(roles)
    .where(inArray(roles.role_name, [...INCENTIVE_ROLE_NAMES]))
    .catch(() => []);

  const roleIdByName = new Map(incentiveRoles.map((role) => [role.role_name, role.role_id]));

  const collectorRoleId = roleIdByName.get("Collector") ?? null;
  const secretaryRoleId = roleIdByName.get("Secretary") ?? null;
  const branchManagerRoleId = roleIdByName.get("Branch Manager") ?? null;

  let collectorRows: ComputedRow[] = [];
  let secretaryRows: ComputedRow[] = [];
  let branchManagerRows: ComputedRow[] = [];

  let collectorRuleMissing = false;
  let secretaryRuleMissing = false;
  let branchManagerRuleMissing = false;
  let branchCollectorAverage = 0;

  if (resolvedBranchId !== null && monthRange) {
    const collectorEmployees: EmployeeRow[] = collectorRoleId === null
      ? []
      : await db
          .select({
            user_id: users.user_id,
            company_id: users.company_id,
            first_name: employee_info.first_name,
            middle_name: employee_info.middle_name,
            last_name: employee_info.last_name,
          })
          .from(employee_area_assignment)
          .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
          .innerJoin(users, eq(users.user_id, employee_area_assignment.employee_user_id))
          .innerJoin(employee_info, eq(employee_info.user_id, users.user_id))
          .where(
            and(
              eq(areas.branch_id, resolvedBranchId),
              eq(users.role_id, collectorRoleId),
              isNull(employee_area_assignment.end_date),
            ),
          )
          .orderBy(asc(employee_info.last_name), asc(employee_info.first_name))
          .catch(() => []);

    const secretaryEmployees: EmployeeRow[] = secretaryRoleId === null
      ? []
      : await db
          .select({
            user_id: users.user_id,
            company_id: users.company_id,
            first_name: employee_info.first_name,
            middle_name: employee_info.middle_name,
            last_name: employee_info.last_name,
          })
          .from(employee_branch_assignment)
          .innerJoin(users, eq(users.user_id, employee_branch_assignment.employee_user_id))
          .innerJoin(employee_info, eq(employee_info.user_id, users.user_id))
          .where(
            and(
              eq(employee_branch_assignment.branch_id, resolvedBranchId),
              eq(users.role_id, secretaryRoleId),
              isNull(employee_branch_assignment.end_date),
            ),
          )
          .orderBy(asc(employee_info.last_name), asc(employee_info.first_name))
          .catch(() => []);

    const branchManagerEmployees: EmployeeRow[] = branchManagerRoleId === null
      ? []
      : await db
          .select({
            user_id: users.user_id,
            company_id: users.company_id,
            first_name: employee_info.first_name,
            middle_name: employee_info.middle_name,
            last_name: employee_info.last_name,
          })
          .from(employee_branch_assignment)
          .innerJoin(users, eq(users.user_id, employee_branch_assignment.employee_user_id))
          .innerJoin(employee_info, eq(employee_info.user_id, users.user_id))
          .where(
            and(
              eq(employee_branch_assignment.branch_id, resolvedBranchId),
              eq(users.role_id, branchManagerRoleId),
              isNull(employee_branch_assignment.end_date),
            ),
          )
          .orderBy(asc(employee_info.last_name), asc(employee_info.first_name))
          .catch(() => []);

    const collectorIds = collectorEmployees.map((item) => item.user_id);

    const collectorTotalsRows = collectorIds.length === 0
      ? []
      : await db
          .select({
            collector_id: collections.collector_id,
            total_amount: sql<string>`coalesce(sum(${collections.amount}), 0)`,
          })
          .from(collections)
          .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
          .where(
            and(
              inArray(collections.collector_id, collectorIds),
              eq(loan_records.branch_id, resolvedBranchId),
              gte(collections.collection_date, monthRange.start),
              lte(collections.collection_date, monthRange.end),
            ),
          )
          .groupBy(collections.collector_id)
          .catch(() => []);

    const collectorBaseAmountByUserId = new Map<string, number>(
      collectorTotalsRows.map((row) => [row.collector_id, Number(row.total_amount) || 0]),
    );

    const collectorTotalAcrossBranch = collectorEmployees.reduce(
      (sum, item) => sum + (collectorBaseAmountByUserId.get(item.user_id) ?? 0),
      0,
    );

    branchCollectorAverage = collectorEmployees.length > 0
      ? collectorTotalAcrossBranch / collectorEmployees.length
      : 0;

    const roleIdsToLoad = [collectorRoleId, secretaryRoleId, branchManagerRoleId].filter(
      (value): value is number => value !== null,
    );

    const ruleRows = roleIdsToLoad.length === 0
      ? []
      : await db
          .select({
            role_id: incentive_rules.role_id,
            percent_value: incentive_rules.percent_value,
            flat_amount: incentive_rules.flat_amount,
          })
          .from(incentive_rules)
          .where(
            and(
              eq(incentive_rules.branch_id, resolvedBranchId),
              inArray(incentive_rules.role_id, roleIdsToLoad),
            ),
          )
          .catch(() => []);

    const ruleByRoleId = new Map<number, IncentiveRule>(
      ruleRows.map((row) => [
        row.role_id,
        {
          percentValue: Number(row.percent_value) || 0,
          flatAmount: Number(row.flat_amount) || 0,
        },
      ]),
    );

    const collectorRule = collectorRoleId ? ruleByRoleId.get(collectorRoleId) ?? null : null;
    const secretaryRule = secretaryRoleId ? ruleByRoleId.get(secretaryRoleId) ?? null : null;
    const branchManagerRule = branchManagerRoleId ? ruleByRoleId.get(branchManagerRoleId) ?? null : null;

    collectorRows = buildComputedRows(
      collectorEmployees,
      "Collector",
      resolvedBranchName ?? "N/A",
      collectorBaseAmountByUserId,
      0,
      collectorRule,
    );

    secretaryRows = buildComputedRows(
      secretaryEmployees,
      "Secretary",
      resolvedBranchName ?? "N/A",
      new Map(),
      branchCollectorAverage,
      secretaryRule,
    );

    branchManagerRows = buildComputedRows(
      branchManagerEmployees,
      "Branch Manager",
      resolvedBranchName ?? "N/A",
      new Map(),
      branchCollectorAverage,
      branchManagerRule,
    );

    collectorRuleMissing = collectorRows.length > 0 && collectorRule === null;
    secretaryRuleMissing = secretaryRows.length > 0 && secretaryRule === null;
    branchManagerRuleMissing = branchManagerRows.length > 0 && branchManagerRule === null;
  }

  const totalEmployees = collectorRows.length + secretaryRows.length + branchManagerRows.length;
  const totalComputedIncentive =
    sectionTotal(collectorRows) + sectionTotal(secretaryRows) + sectionTotal(branchManagerRows);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Incentive Computation</CardTitle>
          <CardDescription>
            {isAdmin
              ? "Compute monthly incentives by branch."
              : "Compute monthly incentives for your assigned branch."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard">
            <Button type="button" variant="outline">
              Back to dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-4" method="get">
            {isAdmin ? (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="branch">
                  Branch
                </label>
                <select
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                  defaultValue={selectedBranchRaw}
                  id="branch"
                  name="branch"
                >
                  <option value="all">Select branch</option>
                  {branches.map((item) => (
                    <option key={item.branch_id} value={String(item.branch_id)}>
                      {item.branch_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="fixed_branch">
                  Branch
                </label>
                <input
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                  id="fixed_branch"
                  readOnly
                  value={fixedBranchName ?? "N/A"}
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="month">
                Month
              </label>
              <input
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                defaultValue={selectedMonthRaw}
                id="month"
                name="month"
                type="month"
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-2">
              <Button type="submit">Apply Filters</Button>
              <Link href="/dashboard/incentives">
                <Button type="button" variant="outline">
                  Clear
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {!monthRange ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Invalid month filter. Please choose a valid month.
            </p>
          </CardContent>
        </Card>
      ) : resolvedBranchId === null ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Select a branch to compute incentives.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Selected Branch</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{resolvedBranchName ?? "N/A"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Eligible Employees</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{totalEmployees}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Total Computed Incentive</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatMoney(totalComputedIncentive)}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Computation Basis</CardTitle>
              <CardDescription>
                Branch collector average for the selected month: {formatMoney(branchCollectorAverage)}
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Collectors</CardTitle>
              <CardDescription>
                Collector incentive = (collector monthly total * percent / 100) + flat amount
              </CardDescription>
            </CardHeader>
            <CardContent>
              {collectorRuleMissing ? (
                <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
                  No incentive rule configured for Collector in this branch.
                </p>
              ) : null}

              {collectorRows.length === 0 ? (
                <p className="text-muted-foreground text-sm">No eligible collectors found.</p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full min-w-260 text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-2 py-2 font-medium">Employee</th>
                        <th className="px-2 py-2 font-medium">Company ID</th>
                        <th className="px-2 py-2 font-medium">Role</th>
                        <th className="px-2 py-2 font-medium">Branch</th>
                        <th className="px-2 py-2 font-medium">Base Amount</th>
                        <th className="px-2 py-2 font-medium">Percent</th>
                        <th className="px-2 py-2 font-medium">Flat Amount</th>
                        <th className="px-2 py-2 font-medium">Computed Incentive</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collectorRows.map((row) => (
                        <tr className="border-b" key={row.userId}>
                          <td className="px-2 py-2">{row.employeeName}</td>
                          <td className="px-2 py-2">{row.companyId}</td>
                          <td className="px-2 py-2">{row.roleName}</td>
                          <td className="px-2 py-2">{row.branchName}</td>
                          <td className="px-2 py-2">{formatMoney(row.baseAmount)}</td>
                          <td className="px-2 py-2">
                            {row.percentValue === null ? "No incentive rule configured" : formatPercent(row.percentValue)}
                          </td>
                          <td className="px-2 py-2">
                            {row.flatAmount === null ? "No incentive rule configured" : formatMoney(row.flatAmount)}
                          </td>
                          <td className="px-2 py-2">
                            {row.computedIncentive === null
                              ? "No incentive rule configured"
                              : formatMoney(row.computedIncentive)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Secretaries</CardTitle>
              <CardDescription>
                Secretary incentive = (branch collector average * percent / 100) + flat amount
              </CardDescription>
            </CardHeader>
            <CardContent>
              {secretaryRuleMissing ? (
                <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
                  No incentive rule configured for Secretary in this branch.
                </p>
              ) : null}

              {secretaryRows.length === 0 ? (
                <p className="text-muted-foreground text-sm">No eligible secretaries found.</p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full min-w-260 text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-2 py-2 font-medium">Employee</th>
                        <th className="px-2 py-2 font-medium">Company ID</th>
                        <th className="px-2 py-2 font-medium">Role</th>
                        <th className="px-2 py-2 font-medium">Branch</th>
                        <th className="px-2 py-2 font-medium">Base Amount</th>
                        <th className="px-2 py-2 font-medium">Percent</th>
                        <th className="px-2 py-2 font-medium">Flat Amount</th>
                        <th className="px-2 py-2 font-medium">Computed Incentive</th>
                      </tr>
                    </thead>
                    <tbody>
                      {secretaryRows.map((row) => (
                        <tr className="border-b" key={row.userId}>
                          <td className="px-2 py-2">{row.employeeName}</td>
                          <td className="px-2 py-2">{row.companyId}</td>
                          <td className="px-2 py-2">{row.roleName}</td>
                          <td className="px-2 py-2">{row.branchName}</td>
                          <td className="px-2 py-2">{formatMoney(row.baseAmount)}</td>
                          <td className="px-2 py-2">
                            {row.percentValue === null ? "No incentive rule configured" : formatPercent(row.percentValue)}
                          </td>
                          <td className="px-2 py-2">
                            {row.flatAmount === null ? "No incentive rule configured" : formatMoney(row.flatAmount)}
                          </td>
                          <td className="px-2 py-2">
                            {row.computedIncentive === null
                              ? "No incentive rule configured"
                              : formatMoney(row.computedIncentive)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Branch Managers</CardTitle>
              <CardDescription>
                Branch Manager incentive = (branch collector average * percent / 100) + flat amount
              </CardDescription>
            </CardHeader>
            <CardContent>
              {branchManagerRuleMissing ? (
                <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
                  No incentive rule configured for Branch Manager in this branch.
                </p>
              ) : null}

              {branchManagerRows.length === 0 ? (
                <p className="text-muted-foreground text-sm">No eligible branch managers found.</p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full min-w-260 text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-2 py-2 font-medium">Employee</th>
                        <th className="px-2 py-2 font-medium">Company ID</th>
                        <th className="px-2 py-2 font-medium">Role</th>
                        <th className="px-2 py-2 font-medium">Branch</th>
                        <th className="px-2 py-2 font-medium">Base Amount</th>
                        <th className="px-2 py-2 font-medium">Percent</th>
                        <th className="px-2 py-2 font-medium">Flat Amount</th>
                        <th className="px-2 py-2 font-medium">Computed Incentive</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branchManagerRows.map((row) => (
                        <tr className="border-b" key={row.userId}>
                          <td className="px-2 py-2">{row.employeeName}</td>
                          <td className="px-2 py-2">{row.companyId}</td>
                          <td className="px-2 py-2">{row.roleName}</td>
                          <td className="px-2 py-2">{row.branchName}</td>
                          <td className="px-2 py-2">{formatMoney(row.baseAmount)}</td>
                          <td className="px-2 py-2">
                            {row.percentValue === null ? "No incentive rule configured" : formatPercent(row.percentValue)}
                          </td>
                          <td className="px-2 py-2">
                            {row.flatAmount === null ? "No incentive rule configured" : formatMoney(row.flatAmount)}
                          </td>
                          <td className="px-2 py-2">
                            {row.computedIncentive === null
                              ? "No incentive rule configured"
                              : formatMoney(row.computedIncentive)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
