import "server-only";

import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { branch, expenses, users } from "@/db/schema";
import type { ExpenseListRow, ExpensesPageAccessState, ExpensesPageData } from "@/app/dashboard/expenses/types";

function whereFrom(filters: SQL[]) {
  if (filters.length === 0) {
    return undefined;
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return and(...filters);
}

function buildExpenseFilters(
  access: Extract<ExpensesPageAccessState, { view: "ready" }>,
): SQL[] {
  const filters: SQL[] = [];

  if (access.isBranchManager && access.resolvedBranchId !== null) {
    filters.push(eq(expenses.branch_id, access.resolvedBranchId));
  } else if ((access.isAdmin || access.isAuditor) && access.resolvedBranchId !== null) {
    filters.push(eq(expenses.branch_id, access.resolvedBranchId));
  } else if (access.isAuditor) {
    if (access.assignedBranchIds.length === 0) {
      filters.push(eq(expenses.expense_id, -1));
    } else {
      filters.push(inArray(expenses.branch_id, access.assignedBranchIds));
    }
  }

  if (access.monthRange) {
    filters.push(gte(expenses.expense_date, access.monthRange.start));
    filters.push(lte(expenses.expense_date, access.monthRange.end));
  }

  if (access.selectedCategory !== "all") {
    filters.push(eq(expenses.expense_category, access.selectedCategory));
  }

  return filters;
}

function buildBranchOptionsWhere(access: Extract<ExpensesPageAccessState, { view: "ready" }>) {
  if (access.isAdmin) {
    return undefined;
  }

  if (access.assignedBranchIds.length === 0) {
    return eq(branch.branch_id, -1);
  }

  return inArray(branch.branch_id, access.assignedBranchIds);
}

function toExpenseListRow(row: {
  expense_id: number;
  branch_name: string;
  expense_category: string;
  description: string | null;
  amount: string;
  expense_date: string;
  recorded_by_username: string | null;
  recorded_by_company_id: string | null;
  recorded_at: string | null;
}): ExpenseListRow {
  return {
    expenseId: row.expense_id,
    branchName: row.branch_name,
    category: row.expense_category,
    description: row.description,
    amount: Number(row.amount) || 0,
    expenseDate: row.expense_date,
    recordedByUsername: row.recorded_by_username,
    recordedByCompanyId: row.recorded_by_company_id,
    recordedAt: row.recorded_at,
  };
}

export async function loadExpensesPageData(
  access: Extract<ExpensesPageAccessState, { view: "ready" }>,
): Promise<ExpensesPageData> {
  const expenseFilters = buildExpenseFilters(access);
  const whereCondition = whereFrom(expenseFilters);

  const [branches, expenseRows, totalsRow] = await Promise.all([
    access.canChooseBranch
      ? db
          .select({
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
          })
          .from(branch)
          .where(buildBranchOptionsWhere(access))
          .orderBy(branch.branch_name)
          .catch(() => [])
      : Promise.resolve([]),
    db
      .select({
        expense_id: expenses.expense_id,
        branch_name: branch.branch_name,
        expense_category: expenses.expense_category,
        description: expenses.description,
        amount: expenses.amount,
        expense_date: expenses.expense_date,
        recorded_by_username: users.username,
        recorded_by_company_id: users.company_id,
        recorded_at: expenses.recorded_at,
      })
      .from(expenses)
      .innerJoin(branch, eq(branch.branch_id, expenses.branch_id))
      .leftJoin(users, eq(users.user_id, expenses.recorded_by))
      .where(whereCondition)
      .orderBy(desc(expenses.expense_date), desc(expenses.expense_id))
      .catch(() => []),
    db
      .select({
        total_expenses: sql<number>`count(*)`,
        total_amount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(whereCondition)
      .then((rows) => rows[0] ?? { total_expenses: 0, total_amount: 0 })
      .catch(() => ({ total_expenses: 0, total_amount: 0 })),
  ]);

  return {
    branches,
    expenses: expenseRows.map(toExpenseListRow),
    totalExpenses: Number(totalsRow.total_expenses) || 0,
    totalAmount: Number(totalsRow.total_amount) || 0,
  };
}
