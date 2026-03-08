import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  branch,
  employee_info,
  incentive_payout_batches,
  incentive_payout_history,
  roles,
  users,
} from "@/db/schema";
import type { IncentiveRow } from "@/app/dashboard/incentives/core";

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
