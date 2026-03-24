import "server-only";

import { eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import type { StoredLoanStatus } from "@/app/dashboard/loans/loan-state";
import { db } from "@/db";
import { collections, loan_records } from "@/db/schema";

export const LIVE_VISIBLE_LOAN_STATUSES = ["Active", "Overdue"] as const;
export const CLOSED_VISIBLE_LOAN_STATUSES = ["Completed", "Archived"] as const;
export const LIVE_STORED_LOAN_STATUSES = ["active", "overdue"] as const satisfies readonly StoredLoanStatus[];
export const CLOSED_STORED_LOAN_STATUSES = ["completed", "archived"] as const satisfies readonly StoredLoanStatus[];

function buildStatusListSql(statuses: readonly string[]) {
  return sql.join(
    statuses.map((status) => sql`${status}`),
    sql`, `,
  );
}

export function buildLoanTotalPayableSql(columns: {
  principal: SQLWrapper;
  interest: SQLWrapper;
}) {
  return sql<number>`(${columns.principal} + (${columns.principal} * ${columns.interest} / 100))`;
}

export function buildLoanRemainingBalanceSql(params: {
  principal: SQLWrapper;
  interest: SQLWrapper;
  totalCollectedSql: SQLWrapper;
}) {
  const totalPayable = buildLoanTotalPayableSql({
    principal: params.principal,
    interest: params.interest,
  });

  return sql<number>`greatest(${totalPayable} - coalesce(${params.totalCollectedSql}, 0), 0)`;
}

export function buildVisibleLoanStatusSql(params: {
  principal: SQLWrapper;
  interest: SQLWrapper;
  dueDate: SQLWrapper;
  storedStatus: SQLWrapper;
  totalCollectedSql: SQLWrapper;
  currentDate: string;
}) {
  const remainingBalance = buildLoanRemainingBalanceSql({
    principal: params.principal,
    interest: params.interest,
    totalCollectedSql: params.totalCollectedSql,
  });

  return sql<string>`case
    when lower(${params.storedStatus}) = 'archived' then 'Archived'
    when lower(${params.storedStatus}) = 'abandoned' then 'Abandoned'
    when ${remainingBalance} <= 0 then 'Completed'
    when ${params.dueDate} < ${params.currentDate} and ${remainingBalance} > 0 then 'Overdue'
    else 'Active'
  end`;
}

export function buildVisibleLoanStatusEqualsSql(visibleStatus: SQLWrapper, status: string) {
  return sql<boolean>`${visibleStatus} = ${status}`;
}

export function buildVisibleLoanStatusInSql(visibleStatus: SQLWrapper, statuses: readonly string[]) {
  return sql<boolean>`${visibleStatus} in (${buildStatusListSql(statuses)})`;
}

export function buildStoredLoanStatusEqualsSql(storedStatus: SQLWrapper, status: StoredLoanStatus) {
  return sql<boolean>`lower(${storedStatus}) = ${status}`;
}

export function buildStoredLoanStatusInSql(
  storedStatus: SQLWrapper,
  statuses: readonly StoredLoanStatus[],
) {
  return sql<boolean>`lower(${storedStatus}) in (${buildStatusListSql(statuses)})`;
}

export function buildLoanDerivedMetricsSubquery(params: {
  aliasName: string;
  currentDate: string;
  where?: SQL;
}) {
  const totalCollected = sql<number>`coalesce(sum(${collections.amount}), 0)`;
  const totalPayable = buildLoanTotalPayableSql({
    principal: loan_records.principal,
    interest: loan_records.interest,
  });
  const remainingBalance = buildLoanRemainingBalanceSql({
    principal: loan_records.principal,
    interest: loan_records.interest,
    totalCollectedSql: totalCollected,
  });
  const visibleStatus = buildVisibleLoanStatusSql({
    principal: loan_records.principal,
    interest: loan_records.interest,
    dueDate: loan_records.due_date,
    storedStatus: loan_records.status,
    totalCollectedSql: totalCollected,
    currentDate: params.currentDate,
  });

  return db
    .select({
      loanId: loan_records.loan_id,
      loanCode: loan_records.loan_code,
      borrowerId: loan_records.borrower_id,
      collectorId: loan_records.collector_id,
      branchId: loan_records.branch_id,
      principal: loan_records.principal,
      interest: loan_records.interest,
      startDate: loan_records.start_date,
      dueDate: loan_records.due_date,
      termDays: loan_records.term_days,
      storedStatus: loan_records.status,
      totalCollected: totalCollected.as("total_collected"),
      totalPayable: totalPayable.as("total_payable"),
      remainingBalance: remainingBalance.as("remaining_balance"),
      visibleStatus: visibleStatus.as("visible_status"),
    })
    .from(loan_records)
    .leftJoin(collections, eq(collections.loan_id, loan_records.loan_id))
    .where(params.where)
    .groupBy(
      loan_records.loan_id,
      loan_records.loan_code,
      loan_records.borrower_id,
      loan_records.collector_id,
      loan_records.branch_id,
      loan_records.principal,
      loan_records.interest,
      loan_records.start_date,
      loan_records.due_date,
      loan_records.term_days,
      loan_records.status,
    )
    .as(params.aliasName);
}
