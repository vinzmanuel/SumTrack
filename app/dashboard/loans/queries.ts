import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { borrower_info, branch, collections, employee_info, loan_records, users } from "@/db/schema";
import {
  buildLoanComputedState,
  getManilaTodayDateString,
  resolveArchiveTargetStatus,
  type StoredLoanStatus,
} from "@/app/dashboard/loans/loan-state";
import type {
  LoanListRow,
  LoanStatusFilter,
  StaffLoansPageData,
  StaffLoansScope,
} from "@/app/dashboard/loans/types";

const borrowerUsers = alias(users, "borrower_users");
const collectorUsers = alias(users, "collector_users");
const STAFF_LOANS_PAGE_SIZE = 20;
const ARCHIVED_BUCKET_STORED_VALUES = ["archived", "abandoned"] as const satisfies readonly StoredLoanStatus[];

const loanCollectionStats = db
  .select({
    loanId: collections.loan_id,
    totalCollected: sql<number>`coalesce(sum(${collections.amount}), 0)`.as("total_collected"),
    collectionCount: sql<number>`count(*)`.as("collection_count"),
  })
  .from(collections)
  .groupBy(collections.loan_id)
  .as("loan_collection_stats");

function buildLoansFilters(scope: StaffLoansScope): SQL[] {
  const filters: SQL[] = [];

  if (scope.roleName === "Admin") {
    if (scope.selectedBranchId) {
      filters.push(eq(loan_records.branch_id, scope.selectedBranchId));
    }
  } else if (scope.selectedBranchId) {
    filters.push(eq(loan_records.branch_id, scope.selectedBranchId));
  } else if (scope.allowedBranchIds.length > 0) {
    filters.push(inArray(loan_records.branch_id, scope.allowedBranchIds));
  } else {
    filters.push(eq(loan_records.loan_id, -1));
  }

  if (scope.tab === "archived") {
    filters.push(inArray(loan_records.status, [...ARCHIVED_BUCKET_STORED_VALUES]));
  } else {
    filters.push(notInArray(loan_records.status, [...ARCHIVED_BUCKET_STORED_VALUES]));
  }

  if (scope.searchQuery) {
    const pattern = `%${scope.searchQuery}%`;
    filters.push(
      or(
        ilike(loan_records.loan_code, pattern),
        ilike(sql<string>`concat_ws(' ', ${borrower_info.first_name}, ${borrower_info.last_name})`, pattern),
        ilike(borrower_info.first_name, pattern),
        ilike(borrower_info.last_name, pattern),
      )!,
    );
  }

  return filters;
}

function buildBranchOptionsWhere(scope: StaffLoansScope) {
  if (scope.roleName === "Admin") {
    return undefined;
  }

  if (scope.allowedBranchIds.length === 0) {
    return eq(branch.branch_id, -1);
  }

  return inArray(branch.branch_id, scope.allowedBranchIds);
}

function whereFrom(filters: SQL[]) {
  if (filters.length === 0) {
    return undefined;
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return and(...filters);
}

function buildLoanTotalPayableSql() {
  return sql<number>`(${loan_records.principal} + (${loan_records.principal} * ${loan_records.interest} / 100))`;
}

function buildLoanRemainingBalanceSql() {
  const totalPayable = buildLoanTotalPayableSql();
  return sql<number>`greatest(${totalPayable} - coalesce(${loanCollectionStats.totalCollected}, 0), 0)`;
}

function buildVisibleStatusSql(currentDate: string) {
  const remainingBalance = buildLoanRemainingBalanceSql();

  return sql<string>`case
    when lower(${loan_records.status}) = 'archived' then 'Archived'
    when lower(${loan_records.status}) = 'abandoned' then 'Abandoned'
    when ${remainingBalance} <= 0 then 'Completed'
    when ${loan_records.due_date} < ${currentDate} and ${remainingBalance} > 0 then 'Overdue'
    else 'Active'
  end`;
}

function buildVisibleStatusWhere(
  statusFilter: LoanStatusFilter,
  currentDate: string,
) {
  if (statusFilter === "all") {
    return undefined;
  }

  const visibleStatus = buildVisibleStatusSql(currentDate);
  return sql`${visibleStatus} = ${statusFilter}`;
}

function toLoanListRow(
  row: {
    loan_id: number;
    loan_code: string;
    borrower_id: string;
    branch_id: number;
    collector_id: string | null;
    principal: string;
    interest: string;
    start_date: string;
    due_date: string;
    status: string;
    borrower_first_name: string | null;
    borrower_last_name: string | null;
    borrower_company_id: string | null;
    borrower_username: string | null;
    branch_name: string;
    collector_first_name: string | null;
    collector_last_name: string | null;
    collector_username: string | null;
    total_collected: number;
    collection_count: number;
  },
  scope: StaffLoansScope,
  currentDate: string,
): LoanListRow {
  const borrowerName =
    [row.borrower_first_name, row.borrower_last_name].filter(Boolean).join(" ") ||
    row.borrower_company_id ||
    row.borrower_username ||
    row.borrower_id;
  const collectorName = row.collector_id
    ? [row.collector_first_name, row.collector_last_name].filter(Boolean).join(" ") ||
      row.collector_username ||
      row.collector_id
    : "N/A";

  const computedState = buildLoanComputedState({
    principal: Number(row.principal) || 0,
    interest: Number(row.interest) || 0,
    totalCollected: Number(row.total_collected) || 0,
    dueDate: row.due_date,
    storedStatus: row.status,
    currentDate,
  });

  const canManageLoanLifecycle =
    scope.roleName === "Admin" || scope.roleName === "Branch Manager" || scope.roleName === "Secretary";

  return {
    loanId: row.loan_id,
    loanCode: row.loan_code,
    borrowerId: row.borrower_id,
    borrowerName,
    branchId: row.branch_id,
    branchName: row.branch_name,
    collectorId: row.collector_id,
    collectorName,
    principal: Number(row.principal) || 0,
    interest: Number(row.interest) || 0,
    startDate: row.start_date,
    dueDate: row.due_date,
    storedStatus: computedState.storedStatus,
    visibleStatus: computedState.visibleStatus,
    totalPayable: computedState.totalPayable,
    totalCollected: computedState.totalCollected,
    remainingBalance: computedState.remainingBalance,
    collectionCount: Number(row.collection_count) || 0,
    canArchive: canManageLoanLifecycle
      ? resolveArchiveTargetStatus({
          storedStatus: computedState.storedStatus,
          visibleStatus: computedState.visibleStatus,
        }) !== null
      : false,
    canDelete: scope.roleName === "Admin" && (Number(row.collection_count) || 0) === 0,
  };
}

export async function loadStaffLoansPageData(scope: StaffLoansScope): Promise<StaffLoansPageData> {
  const currentDate = getManilaTodayDateString();
  const loanFilters = buildLoansFilters(scope);
  const visibleStatusWhere = buildVisibleStatusWhere(scope.status, currentDate);
  if (visibleStatusWhere) {
    loanFilters.push(visibleStatusWhere);
  }
  const whereCondition = whereFrom(loanFilters);
  const branchOptionsWhere = buildBranchOptionsWhere(scope);
  const requestedPage = Math.max(scope.page, 1);

  const branchOptions = await (
    scope.canChooseBranchFilter
      ? db
          .select({
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
          })
          .from(branch)
          .where(branchOptionsWhere)
          .orderBy(asc(branch.branch_name))
          .catch(() => [])
      : Promise.resolve([])
  );

  const totalCount = await db
    .select({ value: sql<number>`count(*)` })
    .from(loan_records)
    .innerJoin(branch, eq(branch.branch_id, loan_records.branch_id))
    .innerJoin(borrowerUsers, eq(borrowerUsers.user_id, loan_records.borrower_id))
    .leftJoin(borrower_info, eq(borrower_info.user_id, loan_records.borrower_id))
    .leftJoin(loanCollectionStats, eq(loanCollectionStats.loanId, loan_records.loan_id))
    .where(whereCondition)
    .then((rows) => Number(rows[0]?.value) || 0)
    .catch(() => 0);

  const totalPages = Math.max(Math.ceil(totalCount / STAFF_LOANS_PAGE_SIZE), 1);
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * STAFF_LOANS_PAGE_SIZE;

  const pageLoanRows = await db
    .select({
      loan_id: loan_records.loan_id,
      loan_code: loan_records.loan_code,
      borrower_id: loan_records.borrower_id,
      branch_id: loan_records.branch_id,
      collector_id: loan_records.collector_id,
      principal: loan_records.principal,
      interest: loan_records.interest,
      start_date: loan_records.start_date,
      due_date: loan_records.due_date,
      status: loan_records.status,
      borrower_first_name: borrower_info.first_name,
      borrower_last_name: borrower_info.last_name,
      borrower_company_id: borrowerUsers.company_id,
      borrower_username: borrowerUsers.username,
      branch_name: branch.branch_name,
      collector_first_name: employee_info.first_name,
      collector_last_name: employee_info.last_name,
      collector_username: collectorUsers.username,
      total_collected: sql<number>`coalesce(${loanCollectionStats.totalCollected}, 0)`,
      collection_count: sql<number>`coalesce(${loanCollectionStats.collectionCount}, 0)`,
    })
    .from(loan_records)
    .innerJoin(branch, eq(branch.branch_id, loan_records.branch_id))
    .innerJoin(borrowerUsers, eq(borrowerUsers.user_id, loan_records.borrower_id))
    .leftJoin(borrower_info, eq(borrower_info.user_id, loan_records.borrower_id))
    .leftJoin(loanCollectionStats, eq(loanCollectionStats.loanId, loan_records.loan_id))
    .leftJoin(collectorUsers, eq(collectorUsers.user_id, loan_records.collector_id))
    .leftJoin(employee_info, eq(employee_info.user_id, collectorUsers.user_id))
    .where(whereCondition)
    .orderBy(desc(loan_records.loan_id))
    .limit(STAFF_LOANS_PAGE_SIZE)
    .offset(offset)
    .catch(() => []);

  return {
    branchOptions,
    loans: pageLoanRows.map((row) => toLoanListRow(row, scope, currentDate)),
    page,
    pageSize: STAFF_LOANS_PAGE_SIZE,
    totalCount,
  };
}
