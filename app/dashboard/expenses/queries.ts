import "server-only";

import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { branch, expenses, users } from "@/db/schema";
import type {
  ExpenseBranchOption,
  ExpenseListRow,
  ExpensesPageAccessState,
  ExpensesResultsData,
} from "@/app/dashboard/expenses/types";
const EXPENSES_PAGE_SIZE = 20;
type ReadyExpensesAccess = Extract<ExpensesPageAccessState, { view: "ready" }>;

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
  access: ReadyExpensesAccess,
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

function buildBranchOptionsWhere(access: ReadyExpensesAccess) {
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

export async function loadExpensesBranchOptions(access: ReadyExpensesAccess): Promise<ExpenseBranchOption[]> {
  if (!access.canChooseBranch) {
    return [];
  }

  return db
    .select({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
    })
    .from(branch)
    .where(buildBranchOptionsWhere(access))
    .orderBy(branch.branch_name)
    .catch(() => []);
}

export async function loadExpensesResultsData(
  access: ReadyExpensesAccess,
): Promise<ExpensesResultsData> {
  const expenseFilters = buildExpenseFilters(access);
  const whereCondition = whereFrom(expenseFilters);
  const requestedPage = Math.max(access.page, 1);

  const totalsRow = await db
    .select({
      total_expenses: sql<number>`count(*)`,
      total_amount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(whereCondition)
    .then((rows) => rows[0] ?? { total_expenses: 0, total_amount: 0 })
    .catch(() => ({ total_expenses: 0, total_amount: 0 }));

  const totalExpenses = Number(totalsRow.total_expenses) || 0;
  const totalPages = Math.max(Math.ceil(totalExpenses / EXPENSES_PAGE_SIZE), 1);
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * EXPENSES_PAGE_SIZE;

  const expenseRows = await db
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
    .limit(EXPENSES_PAGE_SIZE)
    .offset(offset)
    .catch(() => []);

  return {
    expenses: expenseRows.map(toExpenseListRow),
    totalExpenses,
    totalAmount: Number(totalsRow.total_amount) || 0,
    page,
    pageSize: EXPENSES_PAGE_SIZE,
  };
}
