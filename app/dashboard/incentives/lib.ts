import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  areas,
  branch,
  collections,
  employee_area_assignment,
  employee_branch_assignment,
  employee_info,
  incentive_payout_batches,
  incentive_payout_history,
  incentive_rules,
  loan_records,
  roles,
  users,
} from "@/db/schema";

export type IncentiveRoleName = "Collector" | "Secretary" | "Branch Manager";

export type PayPeriod = {
  label: string;
  month: string;
  periodStart: string;
  periodEnd: string;
};

type RuleValue = {
  percentValue: number;
  flatAmount: number;
} | null;

type EmployeeRow = {
  user_id: string;
  company_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
};

export type IncentiveRow = {
  userId: string;
  employeeName: string;
  companyId: string;
  roleName: IncentiveRoleName;
  roleId: number;
  branchId: number;
  branchName: string;
  baseAmount: number;
  percentValue: number | null;
  flatAmount: number | null;
  computedIncentive: number | null;
  missingRule: boolean;
};

export type LiveIncentiveData = {
  collectorRows: IncentiveRow[];
  secretaryRows: IncentiveRow[];
  branchManagerRows: IncentiveRow[];
  branchCollectorAverage: number;
  collectorRuleMissing: boolean;
  secretaryRuleMissing: boolean;
  branchManagerRuleMissing: boolean;
};

export type HistoricalBatchMeta = {
  batchId: number;
  branchId: number;
  branchName: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  finalizedAt: string;
  finalizedByUserId: string;
  finalizedByCompanyId: string | null;
  finalizedByUsername: string | null;
  finalizedByName: string | null;
};

export type HistoricalIncentiveData = {
  collectorRows: IncentiveRow[];
  secretaryRows: IncentiveRow[];
  branchManagerRows: IncentiveRow[];
};

export type ApplicableRuleVersion = {
  ruleId: number;
  branchId: number;
  roleId: number;
  percentValue: number;
  flatAmount: number;
  effectiveStart: string;
  effectiveEnd: string | null;
  createdAt: string;
};

const INCENTIVE_ROLE_NAMES: IncentiveRoleName[] = ["Collector", "Secretary", "Branch Manager"];
const MONTH_ABBREVIATIONS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"] as const;

export function getCurrentMonthValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function resolvePayPeriod(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }

  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }

  const endOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0));
  if (Number.isNaN(endOfMonth.getTime())) {
    return null;
  }

  const periodStart = `${month}-01`;
  const periodEnd = endOfMonth.toISOString().slice(0, 10);
  const label = `${MONTH_ABBREVIATIONS[monthIndex]}-${year}`;

  return {
    label,
    month,
    periodStart,
    periodEnd,
  } satisfies PayPeriod;
}

function keyForBranchRole(branchId: number, roleId: number) {
  return `${branchId}:${roleId}`;
}

function getManilaDateParts(now: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "01");
  return {
    year,
    month,
    day,
  };
}

export function getCurrentPayPeriod(now = new Date()) {
  const parts = getManilaDateParts(now);
  const month = `${parts.year}-${parts.month}`;
  return resolvePayPeriod(month);
}

export function getNextPayPeriod(currentPayPeriod: PayPeriod) {
  const [yearRaw, monthRaw] = currentPayPeriod.month.split("-");
  const nextMonthDate = new Date(Date.UTC(Number(yearRaw), Number(monthRaw), 1));
  const nextMonth = `${nextMonthDate.getUTCFullYear()}-${String(nextMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;
  return resolvePayPeriod(nextMonth);
}

export function getFinalizationCutoffDate(periodEnd: string) {
  return new Date(`${periodEnd}T17:00:00+08:00`);
}

export function isFinalizationWindowOpen(periodEnd: string, now = new Date()) {
  const cutoffAt = getFinalizationCutoffDate(periodEnd);
  return now.getTime() >= cutoffAt.getTime();
}

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

export async function getIncentiveRoleMap() {
  const roleRows = await db
    .select({
      role_id: roles.role_id,
      role_name: roles.role_name,
    })
    .from(roles)
    .where(inArray(roles.role_name, [...INCENTIVE_ROLE_NAMES]))
    .catch(() => []);

  const roleIdByName = new Map<string, number>();
  roleRows.forEach((row) => {
    roleIdByName.set(row.role_name, row.role_id);
  });
  return roleIdByName;
}

export async function loadApplicableRuleVersionsForPeriod(
  branchIds: number[],
  roleIds: number[],
  periodStart: string,
  periodEnd: string,
) {
  if (branchIds.length === 0 || roleIds.length === 0) {
    return new Map<string, ApplicableRuleVersion>();
  }

  const rows = await db
    .select({
      rule_id: incentive_rules.rule_id,
      branch_id: incentive_rules.branch_id,
      role_id: incentive_rules.role_id,
      percent_value: incentive_rules.percent_value,
      flat_amount: incentive_rules.flat_amount,
      effective_start: incentive_rules.effective_start,
      effective_end: incentive_rules.effective_end,
      created_at: incentive_rules.created_at,
    })
    .from(incentive_rules)
    .where(
      and(
        inArray(incentive_rules.branch_id, branchIds),
        inArray(incentive_rules.role_id, roleIds),
        lte(incentive_rules.effective_start, periodStart),
        or(
          isNull(incentive_rules.effective_end),
          gte(incentive_rules.effective_end, periodEnd),
        ),
      ),
    )
    .orderBy(
      asc(incentive_rules.branch_id),
      asc(incentive_rules.role_id),
      desc(incentive_rules.effective_start),
      desc(incentive_rules.created_at),
      desc(incentive_rules.rule_id),
    )
    .catch(() => []);

  const map = new Map<string, ApplicableRuleVersion>();
  rows.forEach((row) => {
    const key = keyForBranchRole(row.branch_id, row.role_id);
    if (map.has(key)) {
      return;
    }

    map.set(key, {
      ruleId: row.rule_id,
      branchId: row.branch_id,
      roleId: row.role_id,
      percentValue: Number(row.percent_value) || 0,
      flatAmount: Number(row.flat_amount) || 0,
      effectiveStart: row.effective_start,
      effectiveEnd: row.effective_end,
      createdAt: row.created_at,
    });
  });

  return map;
}

export async function resolveActiveBranchForBranchManager(userId: string) {
  const activeAssignments = await db
    .select({
      branch_id: employee_branch_assignment.branch_id,
    })
    .from(employee_branch_assignment)
    .where(
      and(
        eq(employee_branch_assignment.employee_user_id, userId),
        isNull(employee_branch_assignment.end_date),
      ),
    )
    .catch(() => []);

  if (activeAssignments.length === 0) {
    return {
      ok: false as const,
      message: "No active branch assignment found.",
    };
  }

  const uniqueBranchIds = Array.from(new Set(activeAssignments.map((item) => item.branch_id)));
  if (uniqueBranchIds.length !== 1) {
    return {
      ok: false as const,
      message: "Multiple active branch assignments detected.",
    };
  }

  const branchRow = await db
    .select({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
    })
    .from(branch)
    .where(eq(branch.branch_id, uniqueBranchIds[0]))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!branchRow) {
    return {
      ok: false as const,
      message: "Active branch assignment points to an invalid branch.",
    };
  }

  return {
    ok: true as const,
    branchId: branchRow.branch_id,
    branchName: branchRow.branch_name,
  };
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

export async function getFinalizedBatchForPeriod(branchId: number, periodStart: string, periodEnd: string) {
  return db
    .select({
      batch_id: incentive_payout_batches.batch_id,
      branch_id: incentive_payout_batches.branch_id,
      branch_name: branch.branch_name,
      period_label: incentive_payout_batches.period_label,
      period_start: incentive_payout_batches.period_start,
      period_end: incentive_payout_batches.period_end,
      finalized_by: incentive_payout_batches.finalized_by,
      finalized_at: incentive_payout_batches.finalized_at,
      finalized_by_company_id: users.company_id,
      finalized_by_username: users.username,
      finalized_by_first_name: employee_info.first_name,
      finalized_by_middle_name: employee_info.middle_name,
      finalized_by_last_name: employee_info.last_name,
    })
    .from(incentive_payout_batches)
    .innerJoin(branch, eq(branch.branch_id, incentive_payout_batches.branch_id))
    .leftJoin(users, eq(users.user_id, incentive_payout_batches.finalized_by))
    .leftJoin(employee_info, eq(employee_info.user_id, incentive_payout_batches.finalized_by))
    .where(
      and(
        eq(incentive_payout_batches.branch_id, branchId),
        eq(incentive_payout_batches.period_start, periodStart),
        eq(incentive_payout_batches.period_end, periodEnd),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);
}

export function mapBatchMeta(
  batchRow: Awaited<ReturnType<typeof getFinalizedBatchForPeriod>>,
): HistoricalBatchMeta | null {
  if (!batchRow) {
    return null;
  }

  const fullName = [
    batchRow.finalized_by_first_name,
    batchRow.finalized_by_middle_name,
    batchRow.finalized_by_last_name,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    batchId: batchRow.batch_id,
    branchId: batchRow.branch_id,
    branchName: batchRow.branch_name,
    periodLabel: batchRow.period_label,
    periodStart: batchRow.period_start,
    periodEnd: batchRow.period_end,
    finalizedAt: batchRow.finalized_at,
    finalizedByUserId: batchRow.finalized_by,
    finalizedByCompanyId: batchRow.finalized_by_company_id,
    finalizedByUsername: batchRow.finalized_by_username,
    finalizedByName: fullName || null,
  };
}

export async function loadHistoricalIncentives(batchMeta: HistoricalBatchMeta): Promise<HistoricalIncentiveData> {
  const historyRows = await db
    .select({
      employee_user_id: incentive_payout_history.employee_user_id,
      role_id: incentive_payout_history.role_id,
      role_name: roles.role_name,
      base_amount: incentive_payout_history.base_amount,
      percent_value: incentive_payout_history.percent_value,
      flat_amount: incentive_payout_history.flat_amount,
      computed_incentive: incentive_payout_history.computed_incentive,
      company_id: users.company_id,
      first_name: employee_info.first_name,
      middle_name: employee_info.middle_name,
      last_name: employee_info.last_name,
    })
    .from(incentive_payout_history)
    .innerJoin(roles, eq(roles.role_id, incentive_payout_history.role_id))
    .innerJoin(users, eq(users.user_id, incentive_payout_history.employee_user_id))
    .innerJoin(employee_info, eq(employee_info.user_id, incentive_payout_history.employee_user_id))
    .where(eq(incentive_payout_history.batch_id, batchMeta.batchId))
    .orderBy(asc(roles.role_name), asc(employee_info.last_name), asc(employee_info.first_name))
    .catch(() => []);

  const collectorRows: IncentiveRow[] = [];
  const secretaryRows: IncentiveRow[] = [];
  const branchManagerRows: IncentiveRow[] = [];

  historyRows.forEach((row) => {
    if (
      row.role_name !== "Collector" &&
      row.role_name !== "Secretary" &&
      row.role_name !== "Branch Manager"
    ) {
      return;
    }

    const mappedRow: IncentiveRow = {
      userId: row.employee_user_id,
      employeeName: [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(" "),
      companyId: row.company_id,
      roleName: row.role_name,
      roleId: row.role_id,
      branchId: batchMeta.branchId,
      branchName: batchMeta.branchName,
      baseAmount: Number(row.base_amount) || 0,
      percentValue: Number(row.percent_value) || 0,
      flatAmount: Number(row.flat_amount) || 0,
      computedIncentive: Number(row.computed_incentive) || 0,
      missingRule: false,
    };

    if (mappedRow.roleName === "Collector") {
      collectorRows.push(mappedRow);
    } else if (mappedRow.roleName === "Secretary") {
      secretaryRows.push(mappedRow);
    } else {
      branchManagerRows.push(mappedRow);
    }
  });

  return {
    collectorRows,
    secretaryRows,
    branchManagerRows,
  };
}
