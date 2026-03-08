import "server-only";

import { asc, desc, eq, inArray, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { borrower_info, branch, employee_info, loan_records, users } from "@/db/schema";
import type { LoanListRow, StaffLoansPageData, StaffLoansScope } from "@/app/dashboard/loans/types";

const borrowerUsers = alias(users, "borrower_users");
const collectorUsers = alias(users, "collector_users");

function buildLoansWhere(scope: StaffLoansScope): SQL | undefined {
  if (scope.roleName === "Admin") {
    return scope.selectedBranchId ? eq(loan_records.branch_id, scope.selectedBranchId) : undefined;
  }

  if (scope.selectedBranchId) {
    return eq(loan_records.branch_id, scope.selectedBranchId);
  }

  if (scope.allowedBranchIds.length > 0) {
    return inArray(loan_records.branch_id, scope.allowedBranchIds);
  }

  return eq(loan_records.loan_id, -1);
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

function toLoanListRow(row: {
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
}): LoanListRow {
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
    status: row.status,
  };
}

export async function loadStaffLoansPageData(scope: StaffLoansScope): Promise<StaffLoansPageData> {
  const whereCondition = buildLoansWhere(scope);
  const branchOptionsWhere = buildBranchOptionsWhere(scope);

  const [loansRows, branchOptions] = await Promise.all([
    db
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
      })
      .from(loan_records)
      .innerJoin(branch, eq(branch.branch_id, loan_records.branch_id))
      .innerJoin(borrowerUsers, eq(borrowerUsers.user_id, loan_records.borrower_id))
      .leftJoin(borrower_info, eq(borrower_info.user_id, loan_records.borrower_id))
      .leftJoin(collectorUsers, eq(collectorUsers.user_id, loan_records.collector_id))
      .leftJoin(employee_info, eq(employee_info.user_id, collectorUsers.user_id))
      .where(whereCondition)
      .orderBy(desc(loan_records.loan_id))
      .catch(() => []),
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
      : Promise.resolve([]),
  ]);

  return {
    branchOptions,
    loans: loansRows.map(toLoanListRow),
  };
}
