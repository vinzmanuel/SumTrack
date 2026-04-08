import "server-only";

import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { formatCollectionsDisplayDate, formatCollectionsMonthLabel, formatCollectionsShortDate } from "@/app/dashboard/collections/format";
import type {
  ExpenseAnalyticsData,
  ExpenseBranchComparisonData,
  ExpenseBranchComparisonItem,
  ExpenseBranchOption,
  ExpenseBranchMixItem,
  ExpenseBreakdownMode,
  ExpenseBreakdownRow,
  ExpenseGroupedSpendSummary,
  ExpenseHighestSpendDaysData,
  ExpenseHighestSpendDayItem,
  ExpenseListRow,
  ExpenseMiscDescriptionItem,
  ExpenseTopDriver,
  ExpensesPageAccessState,
  ExpensesResultsData,
} from "@/app/dashboard/expenses/types";
import type { AnalyticsChartModel, AnalyticsChartRow } from "@/components/analytics/types";
import { db } from "@/db";
import { branch, collections, employee_info, expenses, loan_records, roles, users } from "@/db/schema";

type ReadyExpensesAccess = Extract<ExpensesPageAccessState, { view: "ready" }>;
type LoadExpensesResultsOptions = {
  includeAnalytics?: boolean;
};

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

const FIXED_EXPENSE_CATEGORIES = ["Rent", "Electricity", "Water", "Salary"] as const;
const VARIABLE_EXPENSE_CATEGORIES = ["Transportation", "Lunch", "Miscellaneous"] as const;
const RECURRING_EXPENSE_CATEGORIES = ["Rent", "Electricity", "Water", "Salary"] as const;
const AD_HOC_EXPENSE_CATEGORIES = ["Transportation", "Lunch", "Miscellaneous"] as const;
const UTILITY_EXPENSE_CATEGORIES = ["Electricity", "Water"] as const;

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

function buildMultiSeriesChartModel(
  buckets: TrendBucket[],
  series: Array<{ key: string; label: string; color: string }>,
  sourceRows: Array<{ bucket: string; seriesKey: string; amount: number }>,
): AnalyticsChartModel {
  const lookup = new Map<string, Record<string, number>>();

  for (const row of sourceRows) {
    const bucketValues = lookup.get(row.bucket) ?? {};
    bucketValues[row.seriesKey] = (bucketValues[row.seriesKey] ?? 0) + row.amount;
    lookup.set(row.bucket, bucketValues);
  }

  const rows = buckets.map<AnalyticsChartRow>((bucket) => ({
    bucket: bucket.label,
    values: Object.fromEntries(series.map((entry) => [entry.key, lookup.get(bucket.key)?.[entry.key] ?? 0])),
  }));

  return {
    rows,
    series,
    noData: rows.every((row) => series.every((entry) => toNumber(row.values[entry.key]) === 0)),
  };
}

function summarizeCategoryGroup(params: {
  rows: Array<{ category: string; amount: number; expenseCount: number }>;
  categories: readonly string[];
  totalAmount: number;
  totalExpenses: number;
  label: string;
}): ExpenseGroupedSpendSummary {
  const categorySet = new Set(params.categories);
  const matchingRows = params.rows.filter((row) => categorySet.has(row.category));
  const amount = matchingRows.reduce((sum, row) => sum + row.amount, 0);
  const expenseCount = matchingRows.reduce((sum, row) => sum + row.expenseCount, 0);

  return {
    label: params.label,
    amount,
    share: params.totalAmount > 0 ? (amount / params.totalAmount) * 100 : 0,
    expenseCount: params.totalExpenses > 0 ? expenseCount : 0,
    categories: [...params.categories],
  };
}

function disciplineLabelForBranch(item: {
  miscellaneousShare: number;
  variableShare: number;
  expenseToCollectionsRatio: number | null;
}) {
  if (item.miscellaneousShare >= 18 || item.variableShare >= 38 || (item.expenseToCollectionsRatio ?? 0) >= 40) {
    return "More erratic";
  }

  if (item.miscellaneousShare <= 9 && item.variableShare <= 28) {
    return "Cleaner mix";
  }

  return "Balanced mix";
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

function buildEmptyChartModel(
  series: AnalyticsChartModel["series"] = [],
): AnalyticsChartModel {
  return {
    rows: [],
    series,
    noData: true,
  };
}

function buildEmptySpendSummary(label: string, categories: readonly string[]): ExpenseGroupedSpendSummary {
  return {
    label,
    amount: 0,
    share: 0,
    expenseCount: 0,
    categories: [...categories],
  };
}

function buildEmptyExpensesAnalyticsData(access: ReadyExpensesAccess): ExpenseAnalyticsData {
  return {
    summary: {
      totalCollections: 0,
      expenseToCollectionsRatio: null,
      daysWithExpenses: 0,
      averageExpensePerActiveDay: 0,
      largestExpenseAmount: 0,
      largestExpenseCategory: null,
      largestExpenseDate: null,
      topThreeExpenseShare: 0,
      highestSpendDayAmount: 0,
      highestSpendDayDate: null,
      topCategory: null,
      topCategoryShare: 0,
      totalFixedSpend: 0,
      totalVariableSpend: 0,
      fixedSpendShare: 0,
      variableSpendShare: 0,
      totalRecurringSpend: 0,
      totalAdHocSpend: 0,
      recurringSpendShare: 0,
      adHocSpendShare: 0,
      totalSalarySpend: 0,
      salaryShare: 0,
      totalUtilitySpend: 0,
      utilityShare: 0,
      miscellaneousSpend: 0,
      miscellaneousShare: 0,
      miscellaneousCount: 0,
    },
    structure: {
      fixed: buildEmptySpendSummary("Fixed spend", FIXED_EXPENSE_CATEGORIES),
      variable: buildEmptySpendSummary("Variable spend", VARIABLE_EXPENSE_CATEGORIES),
      recurring: buildEmptySpendSummary("Recurring spend", RECURRING_EXPENSE_CATEGORIES),
      adHoc: buildEmptySpendSummary("Ad hoc spend", AD_HOC_EXPENSE_CATEGORIES),
    },
    salaryRhythm: {
      totalAmount: 0,
      share: 0,
      midMonthTotal: 0,
      monthEndTotal: 0,
      midMonthCount: 0,
      monthEndCount: 0,
      monthEndHigherMonths: 0,
      chart: buildEmptyChartModel([
        { key: "midMonth", label: "Mid-month", color: "#0ea5e9" },
        { key: "monthEnd", label: "Month-end", color: "#16a34a" },
      ]),
      rows: [],
    },
    utilities: {
      totalAmount: 0,
      share: 0,
      electricityAmount: 0,
      waterAmount: 0,
      electricityShare: 0,
      waterShare: 0,
      chart: buildEmptyChartModel([
        { key: "electricity", label: "Electricity", color: "#f97316" },
        { key: "water", label: "Water", color: "#0ea5e9" },
      ]),
    },
    miscellaneous: {
      totalAmount: 0,
      share: 0,
      count: 0,
      overuseFlag: false,
      topDescriptions: [],
    },
    trend: buildEmptyChartModel([{ key: "expenses", label: "Expenses", color: "#f97316" }]),
    topDrivers: [],
    branchMix: [],
    supportMode:
      access.canChooseBranch && access.selectedBranchRaw === "all"
        ? "branch-comparison"
        : "highest-spend-days",
    branchComparison: buildBranchComparisonData([]),
    highestSpendDays: buildHighestSpendDaysData([]),
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
  options?: LoadExpensesResultsOptions,
): Promise<ExpensesResultsData> {
  const includeAnalytics = options?.includeAnalytics ?? true;
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
    categoryTotalsRows,
    dailyActivityRows,
    topDriverRows,
    branchExpenseRows,
    branchCategoryRows,
    collectionRows,
    salaryRhythmRows,
    utilityTrendRows,
    miscDescriptionRows,
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
    includeAnalytics && breakdownMode === "branch"
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
      : includeAnalytics
        ? db
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
            .catch(() => [])
        : Promise.resolve([]),
    includeAnalytics
      ? db
      .select({
        category: expenses.expense_category,
        amount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
        expense_count: sql<number>`count(*)`,
      })
      .from(expenses)
      .where(whereCondition)
      .groupBy(expenses.expense_category)
      .orderBy(desc(sql`coalesce(sum(${expenses.amount}), 0)`), expenses.expense_category)
      .catch(() => [])
      : Promise.resolve([]),
    includeAnalytics
      ? db
      .select({
        expense_date: expenses.expense_date,
        amount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
        expense_count: sql<number>`count(*)`,
      })
      .from(expenses)
      .where(whereCondition)
      .groupBy(expenses.expense_date)
      .orderBy(asc(expenses.expense_date))
      .catch(() => [])
      : Promise.resolve([]),
    includeAnalytics
      ? db
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
      .catch(() => [])
      : Promise.resolve([]),
    includeAnalytics
      ? db
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
      .catch(() => [])
      : Promise.resolve([]),
    includeAnalytics
      ? db
      .select({
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
        category: expenses.expense_category,
        amount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
        expense_count: sql<number>`count(*)`,
      })
      .from(expenses)
      .innerJoin(branch, eq(branch.branch_id, expenses.branch_id))
      .where(whereCondition)
      .groupBy(branch.branch_id, branch.branch_name, expenses.expense_category)
      .orderBy(branch.branch_name, desc(sql`coalesce(sum(${expenses.amount}), 0)`), expenses.expense_category)
      .catch(() => [])
      : Promise.resolve([]),
    includeAnalytics
      ? db
      .select({
        branch_id: loan_records.branch_id,
        total_collections: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(whereFrom(buildCollectionsContextFilters(access)))
      .groupBy(loan_records.branch_id)
      .catch(() => [])
      : Promise.resolve([]),
    includeAnalytics
      ? db
      .select({
        bucket: sql<string>`to_char(${expenses.expense_date}, 'YYYY-MM')`,
        payout_side: sql<string>`case when extract(day from ${expenses.expense_date}) <= 15 then 'mid' else 'end' end`,
        amount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
        expense_count: sql<number>`count(*)`,
      })
      .from(expenses)
      .where(whereFrom([...expenseFilters, eq(expenses.expense_category, "Salary")]))
      .groupBy(
        sql`to_char(${expenses.expense_date}, 'YYYY-MM')`,
        sql`case when extract(day from ${expenses.expense_date}) <= 15 then 'mid' else 'end' end`,
      )
      .orderBy(sql`to_char(${expenses.expense_date}, 'YYYY-MM')`)
      .catch(() => [])
      : Promise.resolve([]),
    includeAnalytics
      ? db
      .select({
        expense_date: expenses.expense_date,
        category: expenses.expense_category,
        amount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(whereFrom([...expenseFilters, inArray(expenses.expense_category, [...UTILITY_EXPENSE_CATEGORIES])]))
      .groupBy(expenses.expense_date, expenses.expense_category)
      .orderBy(asc(expenses.expense_date), expenses.expense_category)
      .catch(() => [])
      : Promise.resolve([]),
    includeAnalytics
      ? db
      .select({
        description: expenses.description,
        amount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
        expense_count: sql<number>`count(*)`,
      })
      .from(expenses)
      .where(
        whereFrom([
          ...expenseFilters,
          eq(expenses.expense_category, "Miscellaneous"),
          sql`nullif(btrim(${expenses.description}), '') is not null`,
        ]),
      )
      .groupBy(expenses.description)
      .orderBy(desc(sql`coalesce(sum(${expenses.amount}), 0)`), desc(sql`count(*)`), expenses.description)
      .limit(5)
      .catch(() => [])
      : Promise.resolve([]),
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

  if (!includeAnalytics) {
    return {
      expenses: expenseRows.map(toExpenseListRow),
      totalExpenses,
      totalAmount,
      page,
      pageSize,
      breakdownMode,
      breakdownRows,
      analytics: buildEmptyExpensesAnalyticsData(access),
    };
  }

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

  const categorySummaryRows = categoryTotalsRows.map((row) => ({
    category: row.category,
    amount: toNumber(row.amount),
    expenseCount: toNumber(row.expense_count),
  }));

  const fixedSummary = summarizeCategoryGroup({
    rows: categorySummaryRows,
    categories: FIXED_EXPENSE_CATEGORIES,
    totalAmount,
    totalExpenses,
    label: "Fixed spend",
  });
  const variableSummary = summarizeCategoryGroup({
    rows: categorySummaryRows,
    categories: VARIABLE_EXPENSE_CATEGORIES,
    totalAmount,
    totalExpenses,
    label: "Variable spend",
  });
  const recurringSummary = summarizeCategoryGroup({
    rows: categorySummaryRows,
    categories: RECURRING_EXPENSE_CATEGORIES,
    totalAmount,
    totalExpenses,
    label: "Recurring spend",
  });
  const adHocSummary = summarizeCategoryGroup({
    rows: categorySummaryRows,
    categories: AD_HOC_EXPENSE_CATEGORIES,
    totalAmount,
    totalExpenses,
    label: "Ad hoc spend",
  });
  const salarySummary = summarizeCategoryGroup({
    rows: categorySummaryRows,
    categories: ["Salary"],
    totalAmount,
    totalExpenses,
    label: "Salary",
  });
  const utilitySummary = summarizeCategoryGroup({
    rows: categorySummaryRows,
    categories: UTILITY_EXPENSE_CATEGORIES,
    totalAmount,
    totalExpenses,
    label: "Utilities",
  });
  const miscellaneousSummary = summarizeCategoryGroup({
    rows: categorySummaryRows,
    categories: ["Miscellaneous"],
    totalAmount,
    totalExpenses,
    label: "Miscellaneous",
  });

  const monthlyBuckets = buildTrendBuckets(access.dateRange, "month");
  const salaryRhythmLookup = new Map<
    string,
    { midMonthAmount: number; monthEndAmount: number; midMonthCount: number; monthEndCount: number }
  >();
  for (const row of salaryRhythmRows) {
    const existing = salaryRhythmLookup.get(row.bucket) ?? {
      midMonthAmount: 0,
      monthEndAmount: 0,
      midMonthCount: 0,
      monthEndCount: 0,
    };

    if (row.payout_side === "mid") {
      existing.midMonthAmount += toNumber(row.amount);
      existing.midMonthCount += toNumber(row.expense_count);
    } else {
      existing.monthEndAmount += toNumber(row.amount);
      existing.monthEndCount += toNumber(row.expense_count);
    }

    salaryRhythmLookup.set(row.bucket, existing);
  }

  const salaryRhythmRowsResolved = monthlyBuckets
    .map((bucket) => {
      const value = salaryRhythmLookup.get(bucket.key) ?? {
        midMonthAmount: 0,
        monthEndAmount: 0,
        midMonthCount: 0,
        monthEndCount: 0,
      };

      return {
        bucketKey: bucket.key,
        bucketLabel: bucket.label,
        midMonthAmount: value.midMonthAmount,
        monthEndAmount: value.monthEndAmount,
        midMonthCount: value.midMonthCount,
        monthEndCount: value.monthEndCount,
        deltaAmount: value.monthEndAmount - value.midMonthAmount,
      };
    })
    .filter((row) => row.midMonthAmount > 0 || row.monthEndAmount > 0);

  const salaryRhythmChart = buildMultiSeriesChartModel(
    salaryRhythmRowsResolved.map((row) => ({ key: row.bucketKey, label: row.bucketLabel })),
    [
      { key: "midMonth", label: "Mid-month", color: "#0ea5e9" },
      { key: "monthEnd", label: "Month-end", color: "#16a34a" },
    ],
    salaryRhythmRowsResolved.flatMap((row) => [
      { bucket: row.bucketKey, seriesKey: "midMonth", amount: row.midMonthAmount },
      { bucket: row.bucketKey, seriesKey: "monthEnd", amount: row.monthEndAmount },
    ]),
  );

  const utilitySourceRows = utilityTrendRows.map((row) => ({
    bucket: bucketKeyForExpenseDate(row.expense_date, access.dateRange.start, trendGranularity),
    seriesKey: row.category === "Electricity" ? "electricity" : "water",
    amount: toNumber(row.amount),
  }));
  const utilityChart = buildMultiSeriesChartModel(
    trendBuckets,
    [
      { key: "electricity", label: "Electricity", color: "#f97316" },
      { key: "water", label: "Water", color: "#0ea5e9" },
    ],
    utilitySourceRows,
  );

  const topCategoryRow = [...categorySummaryRows].sort((left, right) => right.amount - left.amount)[0] ?? null;

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

  const topMiscDescriptionRows: ExpenseMiscDescriptionItem[] = miscDescriptionRows.map((row) => ({
    label: row.description,
    amount: toNumber(row.amount),
    count: toNumber(row.expense_count),
  }));

  const topCategoryByBranch = new Map<string, string>();
  const categoryAmountsByBranch = new Map<
    string,
    Array<{ category: string; amount: number; expenseCount: number }>
  >();
  for (const row of branchCategoryRows) {
    if (!topCategoryByBranch.has(String(row.branch_id))) {
      topCategoryByBranch.set(String(row.branch_id), row.category);
    }

    const branchKey = String(row.branch_id);
    const branchRows = categoryAmountsByBranch.get(branchKey) ?? [];
    branchRows.push({
      category: row.category,
      amount: toNumber(row.amount),
      expenseCount: toNumber(row.expense_count),
    });
    categoryAmountsByBranch.set(branchKey, branchRows);
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

  const branchMixItems: ExpenseBranchMixItem[] = branchExpenseRows
    .map((row) => {
      const branchKey = String(row.branch_id);
      const amount = toNumber(row.amount);
      const branchCategoryRowsForItem = categoryAmountsByBranch.get(branchKey) ?? [];
      const fixedAmount = branchCategoryRowsForItem
        .filter((entry) => FIXED_EXPENSE_CATEGORIES.includes(entry.category as (typeof FIXED_EXPENSE_CATEGORIES)[number]))
        .reduce((sum, entry) => sum + entry.amount, 0);
      const variableAmount = branchCategoryRowsForItem
        .filter((entry) => VARIABLE_EXPENSE_CATEGORIES.includes(entry.category as (typeof VARIABLE_EXPENSE_CATEGORIES)[number]))
        .reduce((sum, entry) => sum + entry.amount, 0);
      const salaryAmount = branchCategoryRowsForItem
        .filter((entry) => entry.category === "Salary")
        .reduce((sum, entry) => sum + entry.amount, 0);
      const utilityAmount = branchCategoryRowsForItem
        .filter((entry) => UTILITY_EXPENSE_CATEGORIES.includes(entry.category as (typeof UTILITY_EXPENSE_CATEGORIES)[number]))
        .reduce((sum, entry) => sum + entry.amount, 0);
      const miscAmount = branchCategoryRowsForItem
        .filter((entry) => entry.category === "Miscellaneous")
        .reduce((sum, entry) => sum + entry.amount, 0);
      const recurringAmount = fixedAmount;
      const adHocAmount = variableAmount;
      const branchCollections = collectionsByBranch.get(row.branch_id) ?? 0;

      const miscellaneousShare = amount > 0 ? (miscAmount / amount) * 100 : 0;
      const variableShare = amount > 0 ? (variableAmount / amount) * 100 : 0;

      return {
        key: branchKey,
        label: row.branch_name,
        amount,
        expenseCount: toNumber(row.expense_count),
        share: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
        expenseToCollectionsRatio: branchCollections > 0 ? (amount / branchCollections) * 100 : null,
        topCategory: topCategoryByBranch.get(branchKey) ?? null,
        fixedShare: amount > 0 ? (fixedAmount / amount) * 100 : 0,
        variableShare,
        recurringShare: amount > 0 ? (recurringAmount / amount) * 100 : 0,
        adHocShare: amount > 0 ? (adHocAmount / amount) * 100 : 0,
        salaryShare: amount > 0 ? (salaryAmount / amount) * 100 : 0,
        utilityShare: amount > 0 ? (utilityAmount / amount) * 100 : 0,
        miscellaneousShare,
        disciplineLabel: disciplineLabelForBranch({
          miscellaneousShare,
          variableShare,
          expenseToCollectionsRatio: branchCollections > 0 ? (amount / branchCollections) * 100 : null,
        }),
      };
    })
    .sort((left, right) => right.amount - left.amount || left.label.localeCompare(right.label));

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
      highestSpendDayAmount: highestSpendDayCandidates[0]?.amount ?? 0,
      highestSpendDayDate: highestSpendDayCandidates[0]?.key ?? null,
      topCategory: topCategoryRow?.category ?? null,
      topCategoryShare: totalAmount > 0 && topCategoryRow ? (topCategoryRow.amount / totalAmount) * 100 : 0,
      totalFixedSpend: fixedSummary.amount,
      totalVariableSpend: variableSummary.amount,
      fixedSpendShare: fixedSummary.share,
      variableSpendShare: variableSummary.share,
      totalRecurringSpend: recurringSummary.amount,
      totalAdHocSpend: adHocSummary.amount,
      recurringSpendShare: recurringSummary.share,
      adHocSpendShare: adHocSummary.share,
      totalSalarySpend: salarySummary.amount,
      salaryShare: salarySummary.share,
      totalUtilitySpend: utilitySummary.amount,
      utilityShare: utilitySummary.share,
      miscellaneousSpend: miscellaneousSummary.amount,
      miscellaneousShare: miscellaneousSummary.share,
      miscellaneousCount: miscellaneousSummary.expenseCount,
    },
    structure: {
      fixed: fixedSummary,
      variable: variableSummary,
      recurring: recurringSummary,
      adHoc: adHocSummary,
    },
    salaryRhythm: {
      totalAmount: salarySummary.amount,
      share: salarySummary.share,
      midMonthTotal: salaryRhythmRowsResolved.reduce((sum, row) => sum + row.midMonthAmount, 0),
      monthEndTotal: salaryRhythmRowsResolved.reduce((sum, row) => sum + row.monthEndAmount, 0),
      midMonthCount: salaryRhythmRowsResolved.reduce((sum, row) => sum + row.midMonthCount, 0),
      monthEndCount: salaryRhythmRowsResolved.reduce((sum, row) => sum + row.monthEndCount, 0),
      monthEndHigherMonths: salaryRhythmRowsResolved.filter((row) => row.monthEndAmount > row.midMonthAmount).length,
      chart: salaryRhythmChart,
      rows: salaryRhythmRowsResolved,
    },
    utilities: {
      totalAmount: utilitySummary.amount,
      share: utilitySummary.share,
      electricityAmount: categorySummaryRows.find((row) => row.category === "Electricity")?.amount ?? 0,
      waterAmount: categorySummaryRows.find((row) => row.category === "Water")?.amount ?? 0,
      electricityShare:
        utilitySummary.amount > 0
          ? ((categorySummaryRows.find((row) => row.category === "Electricity")?.amount ?? 0) / utilitySummary.amount) * 100
          : 0,
      waterShare:
        utilitySummary.amount > 0
          ? ((categorySummaryRows.find((row) => row.category === "Water")?.amount ?? 0) / utilitySummary.amount) * 100
          : 0,
      chart: utilityChart,
    },
    miscellaneous: {
      totalAmount: miscellaneousSummary.amount,
      share: miscellaneousSummary.share,
      count: miscellaneousSummary.expenseCount,
      overuseFlag:
        miscellaneousSummary.share >= 15 ||
        (totalExpenses > 0 ? miscellaneousSummary.expenseCount / totalExpenses >= 0.2 : false),
      topDescriptions: topMiscDescriptionRows,
    },
    trend,
    topDrivers,
    branchMix: branchMixItems,
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
