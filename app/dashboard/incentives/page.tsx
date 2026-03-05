import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { branch, employee_branch_assignment, roles, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { IncentivesFilters } from "@/app/dashboard/incentives/incentives-filters";
import { ExportPrintTools, type ExportIncentiveRow } from "@/app/dashboard/incentives/export-print-tools";
import { FinalizePayoutForm } from "@/app/dashboard/incentives/finalize-payout-form";
import {
  computeLiveIncentivesForPeriod,
  getCurrentMonthValue,
  getFinalizedBatchForPeriod,
  isFinalizationWindowOpen,
  loadHistoricalIncentives,
  mapBatchMeta,
  resolveActiveBranchForBranchManager,
  resolvePayPeriod,
  type IncentiveRow,
} from "@/app/dashboard/incentives/lib";

type PageProps = {
  searchParams?: Promise<{
    branch?: string;
    month?: string;
  }>;
};

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

function sectionTotal(rows: IncentiveRow[]) {
  return rows.reduce((sum, row) => sum + (row.computedIncentive ?? 0), 0);
}

function renderSection(
  title: string,
  description: string,
  rows: IncentiveRow[],
  ruleMissing: boolean,
) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {ruleMissing ? (
          <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
            No incentive rule configured for this role in the selected branch.
          </p>
        ) : null}

        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No eligible employees found.</p>
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
                {rows.map((row) => (
                  <tr className="border-b" key={`${row.roleName}-${row.userId}`}>
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
  );
}

export default async function IncentivesPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const selectedMonthRaw = String(params.month ?? getCurrentMonthValue());
  const selectedBranchRaw = String(params.branch ?? "all");
  const payPeriod = resolvePayPeriod(selectedMonthRaw);

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
  const isAuditor = currentRole?.role_name === "Auditor";

  if (!isAdmin && !isBranchManager && !isAuditor) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Incentives</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are logged in, but only Admin, Branch Manager, and Auditor users can access payout computation and history.
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
  let fixedBranchError: string | null = null;
  let auditorBranchIds: number[] = [];

  if (isBranchManager) {
    const branchResolution = await resolveActiveBranchForBranchManager(user.id);
    if (!branchResolution.ok) {
      fixedBranchError = branchResolution.message;
    } else {
      fixedBranchId = branchResolution.branchId;
      fixedBranchName = branchResolution.branchName;
    }
  }

  if (isAuditor) {
    const assignments = await db
      .select({ branch_id: employee_branch_assignment.branch_id })
      .from(employee_branch_assignment)
      .where(
        and(
          eq(employee_branch_assignment.employee_user_id, user.id),
          isNull(employee_branch_assignment.end_date),
        ),
      )
      .catch(() => []);
    auditorBranchIds = Array.from(new Set(assignments.map((item) => item.branch_id)));
  }

  if (isBranchManager && fixedBranchError) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Incentive Payouts</CardTitle>
            <CardDescription>Payout finalization and history</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">{fixedBranchError}</p>
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const selectedBranchId = (isAdmin || isAuditor) && /^\d+$/.test(selectedBranchRaw) ? Number(selectedBranchRaw) : null;
  const resolvedBranchId = isBranchManager
    ? fixedBranchId
    : isAuditor
      ? (selectedBranchId && auditorBranchIds.includes(selectedBranchId) ? selectedBranchId : null)
      : selectedBranchId;
  const resolvedBranchName = isBranchManager
    ? fixedBranchName
    : branches.find((item) => item.branch_id === resolvedBranchId)?.branch_name ?? null;

  let collectorRows: IncentiveRow[] = [];
  let secretaryRows: IncentiveRow[] = [];
  let branchManagerRows: IncentiveRow[] = [];
  let branchCollectorAverage = 0;
  let collectorRuleMissing = false;
  let secretaryRuleMissing = false;
  let branchManagerRuleMissing = false;
  let batchMeta = null as ReturnType<typeof mapBatchMeta> | null;

  if (payPeriod && resolvedBranchId !== null && resolvedBranchName) {
    const batchRow = await getFinalizedBatchForPeriod(
      resolvedBranchId,
      payPeriod.periodStart,
      payPeriod.periodEnd,
    );
    batchMeta = mapBatchMeta(batchRow);

    if (batchMeta) {
      const historicalData = await loadHistoricalIncentives(batchMeta);
      collectorRows = historicalData.collectorRows;
      secretaryRows = historicalData.secretaryRows;
      branchManagerRows = historicalData.branchManagerRows;
      branchCollectorAverage = collectorRows.length > 0
        ? collectorRows.reduce((sum, row) => sum + row.baseAmount, 0) / collectorRows.length
        : 0;
    } else {
      const liveData = await computeLiveIncentivesForPeriod(
        resolvedBranchId,
        resolvedBranchName,
        payPeriod.periodStart,
        payPeriod.periodEnd,
      );
      collectorRows = liveData.collectorRows;
      secretaryRows = liveData.secretaryRows;
      branchManagerRows = liveData.branchManagerRows;
      branchCollectorAverage = liveData.branchCollectorAverage;
      collectorRuleMissing = liveData.collectorRuleMissing;
      secretaryRuleMissing = liveData.secretaryRuleMissing;
      branchManagerRuleMissing = liveData.branchManagerRuleMissing;
    }
  } else if (payPeriod && isAuditor && selectedBranchRaw === "all" && auditorBranchIds.length > 0) {
    for (const branchId of auditorBranchIds) {
      const branchName = branches.find((item) => item.branch_id === branchId)?.branch_name;
      if (!branchName) {
        continue;
      }

      const batchRow = await getFinalizedBatchForPeriod(
        branchId,
        payPeriod.periodStart,
        payPeriod.periodEnd,
      );
      const mappedBatch = mapBatchMeta(batchRow);

      if (mappedBatch) {
        const historicalData = await loadHistoricalIncentives(mappedBatch);
        collectorRows = [...collectorRows, ...historicalData.collectorRows];
        secretaryRows = [...secretaryRows, ...historicalData.secretaryRows];
        branchManagerRows = [...branchManagerRows, ...historicalData.branchManagerRows];
      } else {
        const liveData = await computeLiveIncentivesForPeriod(
          branchId,
          branchName,
          payPeriod.periodStart,
          payPeriod.periodEnd,
        );
        collectorRows = [...collectorRows, ...liveData.collectorRows];
        secretaryRows = [...secretaryRows, ...liveData.secretaryRows];
        branchManagerRows = [...branchManagerRows, ...liveData.branchManagerRows];
      }
    }

    batchMeta = null;
    branchCollectorAverage = collectorRows.length > 0
      ? collectorRows.reduce((sum, row) => sum + row.baseAmount, 0) / collectorRows.length
      : 0;
  }

  const allRows = [...collectorRows, ...secretaryRows, ...branchManagerRows];
  const totalEmployees = allRows.length;
  const totalComputedIncentive = sectionTotal(allRows);

  const exportRows: ExportIncentiveRow[] = allRows.map((row) => ({
    employeeName: row.employeeName,
    companyId: row.companyId,
    roleName: row.roleName,
    branchName: row.branchName,
    baseAmount: formatMoney(row.baseAmount),
    percentValue: row.percentValue === null ? "No incentive rule configured" : formatPercent(row.percentValue),
    flatAmount: row.flatAmount === null ? "No incentive rule configured" : formatMoney(row.flatAmount),
    computedIncentive: row.computedIncentive === null
      ? "No incentive rule configured"
      : formatMoney(row.computedIncentive),
  }));

  const periodLabel = batchMeta?.periodLabel ?? payPeriod?.label ?? "N/A";
  const periodStart = batchMeta?.periodStart ?? payPeriod?.periodStart ?? "N/A";
  const periodEnd = batchMeta?.periodEnd ?? payPeriod?.periodEnd ?? "N/A";

  const isFinalized = Boolean(batchMeta);
  const finalizationWindowOpen = payPeriod ? isFinalizationWindowOpen(payPeriod.periodEnd) : false;
  const canFinalize = Boolean(
    !isAuditor &&
      !isFinalized &&
      payPeriod &&
      resolvedBranchId !== null &&
      finalizationWindowOpen,
  );

  let finalizeLockReason = "";
  if (isFinalized) {
    finalizeLockReason = "This month has already been finalized.";
  } else if (!payPeriod) {
    finalizeLockReason = "Invalid month filter.";
  } else if (resolvedBranchId === null) {
    finalizeLockReason = "Select a branch first.";
  } else if (!finalizationWindowOpen) {
    finalizeLockReason = `Finalization is allowed starting ${payPeriod.periodEnd} at 5:00 PM (Asia/Manila).`;
  }

  const finalizedByText = batchMeta
    ? [
        batchMeta.finalizedByName,
        batchMeta.finalizedByCompanyId ?? batchMeta.finalizedByUsername ?? batchMeta.finalizedByUserId,
      ]
        .filter(Boolean)
        .join(" - ")
    : null;

  const safeBranch = (resolvedBranchName ?? "branch").replace(/[^a-zA-Z0-9_-]/g, "_");
  const exportFileName = `incentives_${safeBranch}_${selectedMonthRaw}.csv`;
  const modeLabel = isFinalized ? "Historical View" : (isAuditor && selectedBranchRaw === "all" ? "All Assigned Branches" : "Live Computation");

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Incentive Payouts</CardTitle>
          <CardDescription>
            Monthly payout computation, finalization, and history viewing.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/dashboard">
            <Button type="button" variant="outline">
              Back to dashboard
            </Button>
          </Link>
          {!isAuditor ? (
            <Link href="/dashboard/incentives/rules">
              <Button type="button" variant="secondary">
                Manage Rules
              </Button>
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          {isAdmin || isAuditor ? (
            <IncentivesFilters
              allBranchLabel={isAuditor ? "Select assigned branch" : "Select branch"}
              branches={(isAuditor
                ? branches.filter((item) => auditorBranchIds.includes(item.branch_id))
                : branches
              ).map((item) => ({ branch_id: item.branch_id, branch_name: item.branch_name }))}
              canChooseBranch
              clearHref="/dashboard/incentives"
              selectedBranchRaw={selectedBranchRaw}
              selectedMonthRaw={selectedMonthRaw}
            />
          ) : (
            <div className="space-y-4">
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
              <IncentivesFilters
                allBranchLabel="Select branch"
                branches={[]}
                canChooseBranch={false}
                clearHref="/dashboard/incentives"
                selectedBranchRaw={selectedBranchRaw}
                selectedMonthRaw={selectedMonthRaw}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {!payPeriod ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Invalid month filter. Please choose a valid month.
            </p>
          </CardContent>
        </Card>
      ) : (resolvedBranchId === null && !(isAuditor && selectedBranchRaw === "all" && auditorBranchIds.length > 0)) ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">Select a branch to view incentive payouts.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{isFinalized ? "Historical View" : "Live Computation"}</CardTitle>
              <CardDescription>
                {isFinalized
                  ? "This month has already been finalized. The values shown here are locked payout records."
                  : "This view is based on current records and may still change until the month is finalized."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <span className="font-medium">Branch:</span>{" "}
                {isAuditor && selectedBranchRaw === "all"
                  ? "All assigned branches"
                  : resolvedBranchName ?? "N/A"}
              </p>
              <p>
                <span className="font-medium">Period:</span> {periodLabel}
              </p>
              <p>
                <span className="font-medium">Period Start:</span> {periodStart}
              </p>
              <p>
                <span className="font-medium">Period End:</span> {periodEnd}
              </p>
              {batchMeta || isAuditor ? (
                <>
                  {batchMeta ? (
                    <>
                      <p>
                        <span className="font-medium">Finalized By:</span> {finalizedByText ?? "N/A"}
                      </p>
                      <p>
                        <span className="font-medium">Finalized At:</span> {batchMeta.finalizedAt}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">Auditor access is read-only.</p>
                  )}
                </>
              ) : (
                <FinalizePayoutForm
                  branchId={resolvedBranchId ?? 0}
                  canFinalize={canFinalize}
                  lockReason={finalizeLockReason}
                  month={selectedMonthRaw}
                />
              )}

              <ExportPrintTools fileName={exportFileName} modeLabel={modeLabel} rows={exportRows} />
            </CardContent>
          </Card>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
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

            <Card>
              <CardHeader>
                <CardTitle>Collector Average Basis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{formatMoney(branchCollectorAverage)}</p>
                {isFinalized ? (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Historical records are shown from finalized payout history.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {renderSection(
            "Collectors",
            "Collector incentive = (collector month total * percent / 100) + flat amount",
            collectorRows,
            !isFinalized && collectorRuleMissing,
          )}

          {renderSection(
            "Secretaries",
            "Secretary incentive = (branch collector average * percent / 100) + flat amount",
            secretaryRows,
            !isFinalized && secretaryRuleMissing,
          )}

          {renderSection(
            "Branch Managers",
            "Branch Manager incentive = (branch collector average * percent / 100) + flat amount",
            branchManagerRows,
            !isFinalized && branchManagerRuleMissing,
          )}
        </>
      )}
    </main>
  );
}
