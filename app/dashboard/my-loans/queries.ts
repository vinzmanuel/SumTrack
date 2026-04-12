import "server-only";

import {
  and,
  desc,
  eq,
  ilike,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  calculateLoanRemainingBalance,
  calculateLoanTotalPayable,
  getVisibleLoanStatusFromStoredStatus,
  normalizeStoredLoanStatus,
} from "@/app/dashboard/loans/loan-state";
import type { LoanListRow } from "@/app/dashboard/loans/types";
import type {
  BorrowerLoansFilters,
  BorrowerLoansPageData,
} from "@/app/dashboard/my-loans/types";
import { db } from "@/db";
import {
  borrower_info,
  branch,
  collections,
  employee_info,
  loan_records,
  users,
} from "@/db/schema";

const borrowerUsers = alias(users, "my_loans_borrower_users");
const collectorUsers = alias(users, "my_loans_collector_users");
const collectorEmployeeInfo = alias(employee_info, "my_loans_collector_employee_info");
const borrowerInfo = alias(borrower_info, "my_loans_borrower_info");
const loanCollectionStats = db
  .select({
    loanId: collections.loan_id,
    totalCollected: sql<number>`coalesce(sum(${collections.amount}), 0)`.as("total_collected"),
  })
  .from(collections)
  .groupBy(collections.loan_id)
  .as("my_loans_collection_stats");

function buildMyLoansFilters(userId: string, filters: BorrowerLoansFilters) {
  const conditions: SQL[] = [eq(loan_records.borrower_id, userId)];

  if (filters.query) {
    const pattern = `%${filters.query}%`;
    conditions.push(ilike(loan_records.loan_code, pattern));
  }

  if (filters.status === "Active") {
    conditions.push(eq(loan_records.status, "active"));
  } else if (filters.status === "Overdue") {
    conditions.push(eq(loan_records.status, "overdue"));
  } else if (filters.status === "Completed") {
    conditions.push(eq(loan_records.status, "completed"));
  } else if (filters.status === "Archived") {
    conditions.push(eq(loan_records.status, "archived"));
  } else if (filters.status === "Abandoned") {
    conditions.push(eq(loan_records.status, "abandoned"));
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return and(...conditions);
}

function toBorrowerLoanListRow(row: {
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
  total_collected: number;
  borrower_first_name: string | null;
  borrower_last_name: string | null;
  borrower_company_id: string | null;
  borrower_username: string | null;
  branch_name: string;
  collector_first_name: string | null;
  collector_last_name: string | null;
  collector_company_id: string | null;
  collector_username: string | null;
}): LoanListRow {
  const borrowerName =
    [row.borrower_first_name, row.borrower_last_name].filter(Boolean).join(" ") ||
    row.borrower_company_id ||
    row.borrower_username ||
    row.borrower_id;
  const collectorName = row.collector_id
    ? [row.collector_first_name, row.collector_last_name].filter(Boolean).join(" ") ||
      row.collector_company_id ||
      row.collector_username ||
      row.collector_id
    : "N/A";

  const principal = Number(row.principal) || 0;
  const interest = Number(row.interest) || 0;
  const totalCollected = Number(row.total_collected) || 0;
  const storedStatus = normalizeStoredLoanStatus(row.status);
  const totalPayable = calculateLoanTotalPayable(principal, interest);
  const remainingBalance = calculateLoanRemainingBalance(totalPayable, totalCollected);

  return {
    loanId: row.loan_id,
    loanCode: row.loan_code,
    borrowerId: row.borrower_id,
    borrowerName,
    branchId: row.branch_id,
    branchName: row.branch_name,
    collectorId: row.collector_id,
    collectorName,
    principal,
    interest,
    startDate: row.start_date,
    dueDate: row.due_date,
    storedStatus,
    visibleStatus: getVisibleLoanStatusFromStoredStatus(storedStatus),
    totalPayable,
    totalCollected,
    remainingBalance,
    collectionCount: 0,
    canArchive: false,
    canDelete: false,
  };
}

export async function loadBorrowerLoansData(
  userId: string,
  filters: BorrowerLoansFilters,
): Promise<BorrowerLoansPageData> {
  const whereCondition = buildMyLoansFilters(userId, filters);
  const requestedPage = Math.max(filters.page, 1);

  const totalCount = await db
    .select({ value: sql<number>`count(*)` })
    .from(loan_records)
    .where(whereCondition)
    .then((rows) => Number(rows[0]?.value) || 0)
    .catch(() => 0);

  const totalPages = Math.max(Math.ceil(totalCount / filters.pageSize), 1);
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * filters.pageSize;

  const rows = await db
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
      total_collected: sql<number>`coalesce(${loanCollectionStats.totalCollected}, 0)`,
      borrower_first_name: borrowerInfo.first_name,
      borrower_last_name: borrowerInfo.last_name,
      borrower_company_id: borrowerUsers.company_id,
      borrower_username: borrowerUsers.username,
      branch_name: branch.branch_name,
      collector_first_name: collectorEmployeeInfo.first_name,
      collector_last_name: collectorEmployeeInfo.last_name,
      collector_company_id: collectorUsers.company_id,
      collector_username: collectorUsers.username,
    })
    .from(loan_records)
    .innerJoin(branch, eq(branch.branch_id, loan_records.branch_id))
    .innerJoin(borrowerUsers, eq(borrowerUsers.user_id, loan_records.borrower_id))
    .leftJoin(borrowerInfo, eq(borrowerInfo.user_id, loan_records.borrower_id))
    .leftJoin(collectorUsers, eq(collectorUsers.user_id, loan_records.collector_id))
    .leftJoin(collectorEmployeeInfo, eq(collectorEmployeeInfo.user_id, loan_records.collector_id))
    .leftJoin(loanCollectionStats, eq(loanCollectionStats.loanId, loan_records.loan_id))
    .where(whereCondition)
    .orderBy(desc(loan_records.loan_id))
    .limit(filters.pageSize)
    .offset(offset)
    .catch(() => []);

  const loans = rows.map((row) => toBorrowerLoanListRow(row));

  return {
    loans,
    page,
    pageSize: filters.pageSize,
    totalCount,
  };
}
