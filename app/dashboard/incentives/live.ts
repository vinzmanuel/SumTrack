import { and, asc, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  areas,
  collections,
  employee_area_assignment,
  employee_branch_assignment,
  employee_info,
  loan_records,
  users,
} from "@/db/schema";
import {
  type EmployeeRow,
  type IncentiveRoleName,
  type IncentiveRow,
  type LiveIncentiveData,
  type RuleValue,
  getIncentiveRoleMap,
  keyForBranchRole,
  loadApplicableRuleVersionsForPeriod,
} from "@/app/dashboard/incentives/core";

function buildEmployeeName(employee: Pick<EmployeeRow, "first_name" | "middle_name" | "last_name">) {
  return [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(" ");
}

function computeIncentive(baseAmount: number, rule: RuleValue) {
  if (!rule) {
    return null;
  }

  return (baseAmount * rule.percentValue) / 100 + rule.flatAmount;
}

function buildRows(
  employees: EmployeeRow[],
  roleName: IncentiveRoleName,
  roleId: number,
  branchId: number,
  branchName: string,
  baseAmountByUserId: Map<string, number>,
  fallbackBaseAmount: number,
  rule: RuleValue,
) {
  return employees.map<IncentiveRow>((employee) => {
    const baseAmount = baseAmountByUserId.get(employee.user_id) ?? fallbackBaseAmount;
    return {
      userId: employee.user_id,
      employeeName: buildEmployeeName(employee),
      companyId: employee.company_id,
      roleName,
      roleId,
      branchId,
      branchName,
      baseAmount,
      percentValue: rule?.percentValue ?? null,
      flatAmount: rule?.flatAmount ?? null,
      computedIncentive: computeIncentive(baseAmount, rule),
      missingRule: rule === null,
    };
  });
}

export async function computeLiveIncentivesForPeriod(
  branchId: number,
  branchName: string,
  periodStart: string,
  periodEnd: string,
): Promise<LiveIncentiveData> {
  const roleIdByName = await getIncentiveRoleMap();
  const collectorRoleId = roleIdByName.get("Collector");
  const secretaryRoleId = roleIdByName.get("Secretary");
  const branchManagerRoleId = roleIdByName.get("Branch Manager");

  const collectorEmployees: EmployeeRow[] = !collectorRoleId
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
            eq(areas.branch_id, branchId),
            eq(users.role_id, collectorRoleId),
            isNull(employee_area_assignment.end_date),
          ),
        )
        .orderBy(asc(employee_info.last_name), asc(employee_info.first_name))
        .catch(() => []);

  const secretaryEmployees: EmployeeRow[] = !secretaryRoleId
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
            eq(employee_branch_assignment.branch_id, branchId),
            eq(users.role_id, secretaryRoleId),
            isNull(employee_branch_assignment.end_date),
          ),
        )
        .orderBy(asc(employee_info.last_name), asc(employee_info.first_name))
        .catch(() => []);

  const branchManagerEmployees: EmployeeRow[] = !branchManagerRoleId
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
            eq(employee_branch_assignment.branch_id, branchId),
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
          collector_id: loan_records.collector_id,
          total_amount: sql<string>`coalesce(sum(${collections.amount}), 0)`,
        })
        .from(collections)
        .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
        .where(
          and(
            inArray(loan_records.collector_id, collectorIds),
            eq(loan_records.branch_id, branchId),
            gte(collections.collection_date, periodStart),
            lte(collections.collection_date, periodEnd),
          ),
        )
        .groupBy(loan_records.collector_id)
        .catch(() => []);

  const collectorBaseAmountByUserId = new Map<string, number>(
    collectorTotalsRows
      .filter((row): row is typeof row & { collector_id: string } => Boolean(row.collector_id))
      .map((row) => [row.collector_id, Number(row.total_amount) || 0]),
  );

  const collectorTotalAcrossBranch = collectorEmployees.reduce(
    (sum, item) => sum + (collectorBaseAmountByUserId.get(item.user_id) ?? 0),
    0,
  );
  const branchCollectorAverage = collectorEmployees.length > 0
    ? collectorTotalAcrossBranch / collectorEmployees.length
    : 0;

  const roleIdsToLoad = [collectorRoleId, secretaryRoleId, branchManagerRoleId].filter(
    (value): value is number => typeof value === "number",
  );

  const applicableRuleMap = await loadApplicableRuleVersionsForPeriod(
    [branchId],
    roleIdsToLoad,
    periodStart,
    periodEnd,
  );

  const collectorRule = collectorRoleId
    ? applicableRuleMap.get(keyForBranchRole(branchId, collectorRoleId)) ?? null
    : null;
  const secretaryRule = secretaryRoleId
    ? applicableRuleMap.get(keyForBranchRole(branchId, secretaryRoleId)) ?? null
    : null;
  const branchManagerRule = branchManagerRoleId
    ? applicableRuleMap.get(keyForBranchRole(branchId, branchManagerRoleId)) ?? null
    : null;

  const collectorRows = collectorRoleId
    ? buildRows(
        collectorEmployees,
        "Collector",
        collectorRoleId,
        branchId,
        branchName,
        collectorBaseAmountByUserId,
        0,
        collectorRule,
      )
    : [];

  const secretaryRows = secretaryRoleId
    ? buildRows(
        secretaryEmployees,
        "Secretary",
        secretaryRoleId,
        branchId,
        branchName,
        new Map(),
        branchCollectorAverage,
        secretaryRule,
      )
    : [];

  const branchManagerRows = branchManagerRoleId
    ? buildRows(
        branchManagerEmployees,
        "Branch Manager",
        branchManagerRoleId,
        branchId,
        branchName,
        new Map(),
        branchCollectorAverage,
        branchManagerRule,
      )
    : [];

  return {
    collectorRows,
    secretaryRows,
    branchManagerRows,
    branchCollectorAverage,
    collectorRuleMissing: collectorRows.length > 0 && collectorRule === null,
    secretaryRuleMissing: secretaryRows.length > 0 && secretaryRule === null,
    branchManagerRuleMissing: branchManagerRows.length > 0 && branchManagerRule === null,
  };
}
