import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  branch,
  employee_branch_assignment,
  incentive_rules,
  roles,
} from "@/db/schema";

export type IncentiveRoleName = "Collector" | "Secretary" | "Branch Manager";

export type PayPeriod = {
  label: string;
  month: string;
  periodStart: string;
  periodEnd: string;
};

export type RuleValue = {
  percentValue: number;
  flatAmount: number;
} | null;

export type EmployeeRow = {
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

export function keyForBranchRole(branchId: number, roleId: number) {
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
