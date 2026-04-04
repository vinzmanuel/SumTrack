import "server-only";

import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { branch, employee_info, expenses, roles, users } from "@/db/schema";
import type {
  ExpenseBranchOption,
  ExpenseBreakdownMode,
  ExpenseBreakdownRow,
  ExpenseListRow,
  ExpensesPageAccessState,
  ExpensesResultsData,
} from "@/app/dashboard/expenses/types";
type ReadyExpensesAccess = Extract<ExpensesPageAccessState, { view: "ready" }>;

const EXPENSE_BREAKDOWN_COLORS = [
  "#16a34a",
  "#0ea5e9",
  "#f97316",
  "#8b5cf6",
  "#eab308",
  "#ec4899",
  "#14b8a6",
  "#64748b",
] as const;

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

  filters.push(gte(expenses.expense_date, access.dateRange.start));
  filters.push(lte(expenses.expense_date, access.dateRange.end));

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
  recorded_by_role_name: string | null;
  recorded_by_first_name: string | null;
  recorded_by_middle_name: string | null;
  recorded_by_last_name: string | null;
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
    recordedByRoleName: row.recorded_by_role_name,
    recordedByFirstName: row.recorded_by_first_name,
    recordedByMiddleName: row.recorded_by_middle_name,
    recordedByLastName: row.recorded_by_last_name,
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
  const pageSize = access.pageSize;
  const breakdownMode: ExpenseBreakdownMode =
    access.canChooseBranch && access.selectedBranchRaw === "all" ? "branch" : "category";

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
  const totalPages = Math.max(Math.ceil(totalExpenses / pageSize), 1);
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;

  const expenseRows = await db
    .select({
      expense_id: expenses.expense_id,
      branch_name: branch.branch_name,
      expense_category: expenses.expense_category,
      description: expenses.description,
      amount: expenses.amount,
      expense_date: expenses.expense_date,
      recorded_by_role_name: roles.role_name,
      recorded_by_first_name: employee_info.first_name,
      recorded_by_middle_name: employee_info.middle_name,
      recorded_by_last_name: employee_info.last_name,
      recorded_by_username: users.username,
      recorded_by_company_id: users.company_id,
      recorded_at: expenses.recorded_at,
    })
    .from(expenses)
    .innerJoin(branch, eq(branch.branch_id, expenses.branch_id))
    .leftJoin(users, eq(users.user_id, expenses.recorded_by))
    .leftJoin(roles, eq(roles.role_id, users.role_id))
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .where(whereCondition)
    .orderBy(desc(expenses.expense_date), desc(expenses.expense_id))
    .limit(pageSize)
    .offset(offset)
    .catch(() => []);

  const rawBreakdownRows =
    breakdownMode === "branch"
      ? await db
          .select({
            key: sql<string>`${branch.branch_id}::text`,
            label: branch.branch_name,
            amount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
            expense_count: sql<number>`count(*)`,
          })
          .from(expenses)
          .innerJoin(branch, eq(branch.branch_id, expenses.branch_id))
          .where(whereCondition)
          .groupBy(branch.branch_id, branch.branch_name)
          .orderBy(desc(sql`coalesce(sum(${expenses.amount}), 0)`), branch.branch_name)
          .catch(() => [])
      : await db
          .select({
            key: expenses.expense_category,
            label: expenses.expense_category,
            amount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
            expense_count: sql<number>`count(*)`,
          })
          .from(expenses)
          .where(whereCondition)
          .groupBy(expenses.expense_category)
          .orderBy(desc(sql`coalesce(sum(${expenses.amount}), 0)`), expenses.expense_category)
          .catch(() => []);

  const breakdownRows: ExpenseBreakdownRow[] = rawBreakdownRows.map((row, index) => {
    const amount = Number(row.amount) || 0;
    return {
      key: row.key,
      label: row.label,
      amount,
      expenseCount: Number(row.expense_count) || 0,
      share: totalExpenses > 0 && Number(totalsRow.total_amount) > 0 ? (amount / (Number(totalsRow.total_amount) || 0)) * 100 : 0,
      fill: EXPENSE_BREAKDOWN_COLORS[index % EXPENSE_BREAKDOWN_COLORS.length],
    };
  });

  return {
    expenses: expenseRows.map(toExpenseListRow),
    totalExpenses,
    totalAmount: Number(totalsRow.total_amount) || 0,
    page,
    pageSize,
    breakdownMode,
    breakdownRows,
  };
}
