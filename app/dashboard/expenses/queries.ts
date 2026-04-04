import "server-only";

import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { formatCollectionsDisplayDate, formatCollectionsMonthLabel, formatCollectionsShortDate } from "@/app/dashboard/collections/format";
import type {
  ExpenseAnalyticsData,
  ExpenseBranchComparisonData,
  ExpenseBranchComparisonItem,
  ExpenseBranchOption,
  ExpenseBreakdownMode,
  ExpenseBreakdownRow,
  ExpenseHighestSpendDaysData,
  ExpenseHighestSpendDayItem,
  ExpenseListRow,
  ExpenseTopDriver,
  ExpensesPageAccessState,
  ExpensesResultsData,
} from "@/app/dashboard/expenses/types";
import type { AnalyticsChartModel, AnalyticsChartRow } from "@/components/analytics/types";
import { db } from "@/db";
import { branch, collections, employee_info, expenses, loan_records, roles, users } from "@/db/schema";

type ReadyExpensesAccess = Extract<ExpensesPageAccessState, { view: "ready" }>;

type ExpensesTrendGranularity = "day" | "week" | "month";

type TrendBucket = {
  key: string;
  label: string;
};

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

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function addMonths(value: Date, amount: number) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + amount, 1));
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function diffDays(start: string, end: string) {
  const milliseconds = parseIsoDate(end).getTime() - parseIsoDate(start).getTime();
  return Math.floor(milliseconds / 86_400_000);
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

function buildExpenseFilters(access: ReadyExpensesAccess): SQL[] {
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

function buildCollectionsContextFilters(access: ReadyExpensesAccess): SQL[] {
  const filters: SQL[] = [];

  if (access.isBranchManager && access.resolvedBranchId !== null) {
    filters.push(eq(loan_records.branch_id, access.resolvedBranchId));
  } else if ((access.isAdmin || access.isAuditor) && access.resolvedBranchId !== null) {
    filters.push(eq(loan_records.branch_id, access.resolvedBranchId));
  } else if (access.isAuditor) {
    if (access.assignedBranchIds.length === 0) {
      filters.push(eq(loan_records.loan_id, -1));
    } else {
      filters.push(inArray(loan_records.branch_id, access.assignedBranchIds));
    }
  }

  filters.push(gte(collections.collection_date, access.dateRange.start));
  filters.push(lte(collections.collection_date, access.dateRange.end));

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

function resolveBreakdownMode(access: ReadyExpensesAccess): ExpenseBreakdownMode {
  if (access.canChooseBranch && access.selectedBranchRaw === "all" && access.selectedCategory !== "all") {
    return "branch";
  }

  return "category";
}

function resolveTrendGranularity(range: ReadyExpensesAccess["dateRange"]): ExpensesTrendGranularity {
  const totalDays = diffDays(range.start, range.end) + 1;

  if (totalDays <= 14) {
    return "day";
  }

  if (totalDays <= 60) {
    return "week";
  }

  return "month";
}

function buildTrendBuckets(
  range: ReadyExpensesAccess["dateRange"],
  granularity: ExpensesTrendGranularity,
): TrendBucket[] {
  const buckets: TrendBucket[] = [];

  if (granularity === "month") {
    let cursor = new Date(Date.UTC(parseIsoDate(range.start).getUTCFullYear(), parseIsoDate(range.start).getUTCMonth(), 1));
    const end = new Date(Date.UTC(parseIsoDate(range.end).getUTCFullYear(), parseIsoDate(range.end).getUTCMonth(), 1));

    while (cursor.getTime() <= end.getTime()) {
      const key = cursor.toISOString().slice(0, 7);
      buckets.push({
        key,
        label: formatCollectionsMonthLabel(key),
      });
      cursor = addMonths(cursor, 1);
    }

    return buckets;
  }

  if (granularity === "week") {
    let cursor = parseIsoDate(range.start);
    const end = parseIsoDate(range.end);

    while (cursor.getTime() <= end.getTime()) {
      const bucketStart = cursor;
      const bucketEnd = new Date(Math.min(addDays(cursor, 6).getTime(), end.getTime()));
      buckets.push({
        key: toIsoDate(bucketStart),
        label: `${formatCollectionsShortDate(toIsoDate(bucketStart))} - ${formatCollectionsShortDate(toIsoDate(bucketEnd))}`,
      });
      cursor = addDays(cursor, 7);
    }

    return buckets;
  }

  let cursor = parseIsoDate(range.start);
  const end = parseIsoDate(range.end);

  while (cursor.getTime() <= end.getTime()) {
    const key = toIsoDate(cursor);
    buckets.push({
      key,
      label: formatCollectionsShortDate(key),
    });
    cursor = addDays(cursor, 1);
  }

  return buckets;
}

function bucketKeyForExpenseDate(
  value: string,
  rangeStart: string,
  granularity: ExpensesTrendGranularity,
) {
  if (granularity === "month") {
    return value.slice(0, 7);
  }

  if (granularity === "week") {
    const offset = diffDays(rangeStart, value);
    const bucketStart = addDays(parseIsoDate(rangeStart), Math.floor(offset / 7) * 7);
    return toIsoDate(bucketStart);
  }

  return value;
}

function buildTrendChartModel(
  buckets: TrendBucket[],
  sourceRows: Array<{ bucket: string; amount: number }>,
): AnalyticsChartModel {
  const lookup = new Map(sourceRows.map((row) => [row.bucket, row.amount]));
  const rows = buckets.map<AnalyticsChartRow>((bucket) => ({
    bucket: bucket.label,
    values: {
      expenses: lookup.get(bucket.key) ?? 0,
    },
  }));

  return {
    rows,
    series: [{ key: "expenses", label: "Expenses", color: "#f97316" }],
    noData: rows.every((row) => toNumber(row.values.expenses) === 0),
  };
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
    amount: toNumber(row.amount),
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

function buildBranchComparisonData(items: ExpenseBranchComparisonItem[]): ExpenseBranchComparisonData {
  return {
    title: "Expenses by Branch",
    description: "Compare which branches actually drove spending in the selected scope.",
    items,
    emptyMessage: "No branch comparison is available for the current expense scope.",
  };
}

function buildHighestSpendDaysData(items: ExpenseHighestSpendDayItem[]): ExpenseHighestSpendDaysData {
  return {
    title: "Highest-Spend Days",
    description: "See which days concentrated the most expense activity inside the selected scope.",
    items,
    emptyMessage: "No active spend days are available for the current scope.",
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

export async function loadExpensesResultsData(access: ReadyExpensesAccess): Promise<ExpensesResultsData> {
  const expenseFilters = buildExpenseFilters(access);
  const whereCondition = whereFrom(expenseFilters);
  const requestedPage = Math.max(access.page, 1);
  const pageSize = access.pageSize;
  const breakdownMode = resolveBreakdownMode(access);
  const trendGranularity = resolveTrendGranularity(access.dateRange);
  const trendBuckets = buildTrendBuckets(access.dateRange, trendGranularity);

  const [
    totalsRow,
    rawBreakdownRows,
    dailyActivityRows,
    topDriverRows,
    branchExpenseRows,
    branchCategoryRows,
    collectionRows,
  ] = await Promise.all([
    db
      .select({
        total_expenses: sql<number>`count(*)`,
        total_amount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(whereCondition)
      .then((rows) => rows[0] ?? { total_expenses: 0, total_amount: 0 })
      .catch(() => ({ total_expenses: 0, total_amount: 0 })),
    breakdownMode === "branch"
      ? db
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
      : db
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
          .catch(() => []),
    db
      .select({
        expense_date: expenses.expense_date,
        amount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
        expense_count: sql<number>`count(*)`,
      })
      .from(expenses)
      .where(whereCondition)
      .groupBy(expenses.expense_date)
      .orderBy(asc(expenses.expense_date))
      .catch(() => []),
    db
      .select({
        expense_id: expenses.expense_id,
        branch_name: branch.branch_name,
        expense_category: expenses.expense_category,
        description: expenses.description,
        amount: expenses.amount,
        expense_date: expenses.expense_date,
      })
      .from(expenses)
      .innerJoin(branch, eq(branch.branch_id, expenses.branch_id))
      .where(whereCondition)
      .orderBy(desc(expenses.amount), desc(expenses.expense_date), desc(expenses.expense_id))
      .limit(5)
      .catch(() => []),
    db
      .select({
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
        amount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
        expense_count: sql<number>`count(*)`,
      })
      .from(expenses)
      .innerJoin(branch, eq(branch.branch_id, expenses.branch_id))
      .where(whereCondition)
      .groupBy(branch.branch_id, branch.branch_name)
      .orderBy(desc(sql`coalesce(sum(${expenses.amount}), 0)`), branch.branch_name)
      .catch(() => []),
    db
      .select({
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
        category: expenses.expense_category,
        amount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .innerJoin(branch, eq(branch.branch_id, expenses.branch_id))
      .where(whereCondition)
      .groupBy(branch.branch_id, branch.branch_name, expenses.expense_category)
      .orderBy(branch.branch_name, desc(sql`coalesce(sum(${expenses.amount}), 0)`), expenses.expense_category)
      .catch(() => []),
    db
      .select({
        branch_id: loan_records.branch_id,
        total_collections: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(whereFrom(buildCollectionsContextFilters(access)))
      .groupBy(loan_records.branch_id)
      .catch(() => []),
  ]);

  const totalExpenses = toNumber(totalsRow.total_expenses);
  const totalAmount = toNumber(totalsRow.total_amount);
  const totalPages = Math.max(Math.ceil(totalExpenses / pageSize), 1);
  const page = Math.min(requestedPage, totalPages);
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
    .offset((page - 1) * pageSize)
    .catch(() => []);

  const breakdownRows: ExpenseBreakdownRow[] = rawBreakdownRows.map((row, index) => {
    const amount = toNumber(row.amount);
    return {
      key: row.key,
      label: row.label,
      amount,
      expenseCount: toNumber(row.expense_count),
      share: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
      fill: EXPENSE_BREAKDOWN_COLORS[index % EXPENSE_BREAKDOWN_COLORS.length],
    };
  });

  const trendSourceRows = dailyActivityRows.reduce<Array<{ bucket: string; amount: number }>>((rows, rawRow) => {
    const bucket = bucketKeyForExpenseDate(rawRow.expense_date, access.dateRange.start, trendGranularity);
    const existing = rows.find((row) => row.bucket === bucket);
    if (existing) {
      existing.amount += toNumber(rawRow.amount);
      return rows;
    }

    rows.push({
      bucket,
      amount: toNumber(rawRow.amount),
    });
    return rows;
  }, []);

  const trend = buildTrendChartModel(trendBuckets, trendSourceRows);

  const topDrivers: ExpenseTopDriver[] = topDriverRows.map((row) => ({
    expenseId: row.expense_id,
    branchName: row.branch_name,
    category: row.expense_category,
    description: row.description,
    amount: toNumber(row.amount),
    expenseDate: row.expense_date,
  }));

  const collectionsByBranch = new Map(
    collectionRows.map((row) => [row.branch_id, toNumber(row.total_collections)] as const),
  );
  const totalCollections = Array.from(collectionsByBranch.values()).reduce((sum, value) => sum + value, 0);
  const daysWithExpenses = dailyActivityRows.length;
  const averageExpensePerActiveDay = daysWithExpenses > 0 ? totalAmount / daysWithExpenses : 0;
  const largestExpense = topDrivers[0] ?? null;
  const topThreeExpenseShare =
    totalAmount > 0
      ? (topDrivers.slice(0, 3).reduce((sum, row) => sum + row.amount, 0) / totalAmount) * 100
      : 0;

  const highestSpendDayCandidates = dailyActivityRows
    .map((row) => ({
      key: row.expense_date,
      label: formatCollectionsDisplayDate(row.expense_date),
      amount: toNumber(row.amount),
      expenseCount: toNumber(row.expense_count),
      share: totalAmount > 0 ? (toNumber(row.amount) / totalAmount) * 100 : 0,
    }))
    .sort((left, right) => right.amount - left.amount || right.key.localeCompare(left.key))
    .slice(0, 5);

  const topCategoryByBranch = new Map<string, string>();
  for (const row of branchCategoryRows) {
    if (!topCategoryByBranch.has(String(row.branch_id))) {
      topCategoryByBranch.set(String(row.branch_id), row.category);
    }
  }

  const branchComparisonItems: ExpenseBranchComparisonItem[] = branchExpenseRows
    .map((row) => {
      const amount = toNumber(row.amount);
      const branchCollections = collectionsByBranch.get(row.branch_id) ?? 0;
      return {
        key: String(row.branch_id),
        label: row.branch_name,
        amount,
        expenseCount: toNumber(row.expense_count),
        share: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
        expenseToCollectionsRatio: branchCollections > 0 ? (amount / branchCollections) * 100 : null,
        topCategory: topCategoryByBranch.get(String(row.branch_id)) ?? null,
      };
    })
    .sort((left, right) => right.amount - left.amount || left.label.localeCompare(right.label))
    .slice(0, 6);

  const analytics: ExpenseAnalyticsData = {
    summary: {
      totalCollections,
      expenseToCollectionsRatio: totalCollections > 0 ? (totalAmount / totalCollections) * 100 : null,
      daysWithExpenses,
      averageExpensePerActiveDay,
      largestExpenseAmount: largestExpense?.amount ?? 0,
      largestExpenseCategory: largestExpense?.category ?? null,
      largestExpenseDate: largestExpense?.expenseDate ?? null,
      topThreeExpenseShare,
    },
    trend,
    topDrivers,
    supportMode:
      access.canChooseBranch && access.selectedBranchRaw === "all"
        ? "branch-comparison"
        : "highest-spend-days",
    branchComparison: buildBranchComparisonData(branchComparisonItems),
    highestSpendDays: buildHighestSpendDaysData(
      highestSpendDayCandidates.map((row) => ({
        key: row.key,
        label: row.label,
        amount: row.amount,
        expenseCount: row.expenseCount,
        share: row.share,
      })),
    ),
  };

  return {
    expenses: expenseRows.map(toExpenseListRow),
    totalExpenses,
    totalAmount,
    page,
    pageSize,
    breakdownMode,
    breakdownRows,
    analytics,
  };
}
