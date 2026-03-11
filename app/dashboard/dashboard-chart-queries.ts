import "server-only";

import { and, asc, eq, gte, inArray, lte, ne, sql, type SQL, type SQLWrapper } from "drizzle-orm";
import { db } from "@/db";
import {
  branch,
  collections,
  expenses,
  incentive_payout_batches,
  incentive_payout_history,
  loan_records,
  roles,
} from "@/db/schema";
import { resolveDashboardChartConfig } from "@/app/dashboard/dashboard-chart-config";
import {
  parseDashboardChartFilters,
  resolveDashboardChartDateRange,
  resolveSelectedBranchId,
} from "@/app/dashboard/dashboard-chart-filters";
import type {
  DashboardChartData,
  DashboardChartDateRange,
  DashboardChartPageProps,
} from "@/app/dashboard/dashboard-chart-types";
import type { DashboardOverviewState } from "@/app/dashboard/overview-types";
import { formatDateShort, toNumber } from "@/app/dashboard/overview-format";
import type { AnalyticsChartRow } from "@/components/analytics/types";

type BucketValueRow = {
  bucket: string;
  value: number;
};

function whereFrom(conditions: SQL[]) {
  if (conditions.length === 0) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return and(...conditions);
}

function bucketExpression(column: SQLWrapper, granularity: DashboardChartDateRange["granularity"]) {
  if (granularity === "month") {
    return sql<string>`to_char(${column}, 'YYYY-MM')`;
  }

  return sql<string>`to_char(${column}, 'YYYY-MM-DD')`;
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

function formatMonthLabel(bucket: string) {
  const [year, month] = bucket.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
}

function buildBuckets(range: DashboardChartDateRange) {
  const buckets: Array<{ key: string; label: string }> = [];

  if (range.granularity === "month") {
    const startDate = parseIsoDate(range.start);
    const endDate = parseIsoDate(range.end);
    let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    const last = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));

    while (cursor.getTime() <= last.getTime()) {
      const key = cursor.toISOString().slice(0, 7);
      buckets.push({ key, label: formatMonthLabel(key) });
      cursor = addMonths(cursor, 1);
    }

    return buckets;
  }

  let cursor = parseIsoDate(range.start);
  const last = parseIsoDate(range.end);

  while (cursor.getTime() <= last.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.push({ key, label: formatDateShort(key) });
    cursor = addDays(cursor, 1);
  }

  return buckets;
}

async function loadBranchOptions(state: DashboardOverviewState) {
  if (state.auth.roleName === "Admin") {
    return db
      .select({ branchId: branch.branch_id, branchName: branch.branch_name })
      .from(branch)
      .orderBy(asc(branch.branch_name))
      .catch(() => []);
  }

  if (state.auth.roleName === "Auditor") {
    if (state.auth.assignedBranchIds.length === 0) {
      return [];
    }

    return db
      .select({ branchId: branch.branch_id, branchName: branch.branch_name })
      .from(branch)
      .where(inArray(branch.branch_id, state.auth.assignedBranchIds))
      .orderBy(asc(branch.branch_name))
      .catch(() => []);
  }

  return [];
}

function resolveScopedBranchIds(
  state: DashboardOverviewState,
  branchOptions: Array<{ branchId: number; branchName: string }>,
  selectedBranchRaw: string,
) {
  if (state.auth.roleName === "Admin" || state.auth.roleName === "Auditor") {
    const selectedBranchId = resolveSelectedBranchId(selectedBranchRaw);
    const allowedBranchIds = branchOptions.map((option) => option.branchId);

    if (selectedBranchId !== null && allowedBranchIds.includes(selectedBranchId)) {
      return [selectedBranchId];
    }

    return allowedBranchIds;
  }

  if (state.scope?.kind === "branches") {
    return state.scope.branchIds;
  }

  return [];
}

async function loadCollectionBuckets(
  state: DashboardOverviewState,
  scopedBranchIds: number[],
  range: DashboardChartDateRange,
) {
  const bucket = bucketExpression(collections.collection_date, range.granularity);
  const conditions: SQL[] = [
    gte(collections.collection_date, range.start),
    lte(collections.collection_date, range.end),
  ];

  if (state.auth.roleName === "Collector") {
    conditions.push(eq(loan_records.collector_id, state.auth.userId));
  } else if (scopedBranchIds.length === 0) {
    return [];
  } else {
    conditions.push(inArray(loan_records.branch_id, scopedBranchIds));
  }

  return db
    .select({
      bucket,
      value: sql<number>`coalesce(sum(${collections.amount}), 0)`,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(whereFrom(conditions))
    .groupBy(bucket)
    .orderBy(bucket)
    .then((rows) => rows.map((row) => ({ bucket: row.bucket, value: toNumber(row.value) })))
    .catch(() => []);
}

async function loadExpenseBuckets(scopedBranchIds: number[], range: DashboardChartDateRange) {
  if (scopedBranchIds.length === 0) {
    return [];
  }

  const bucket = bucketExpression(expenses.expense_date, range.granularity);

  return db
    .select({
      bucket,
      value: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
    })
    .from(expenses)
    .where(
      whereFrom([
        inArray(expenses.branch_id, scopedBranchIds),
        gte(expenses.expense_date, range.start),
        lte(expenses.expense_date, range.end),
      ]),
    )
    .groupBy(bucket)
    .orderBy(bucket)
    .then((rows) => rows.map((row) => ({ bucket: row.bucket, value: toNumber(row.value) })))
    .catch(() => []);
}

async function loadIncentiveBuckets(
  state: DashboardOverviewState,
  scopedBranchIds: number[],
  range: DashboardChartDateRange,
) {
  if (scopedBranchIds.length === 0) {
    return [];
  }

  const bucket = bucketExpression(incentive_payout_batches.period_end, range.granularity);
  const conditions: SQL[] = [
    inArray(incentive_payout_batches.branch_id, scopedBranchIds),
    gte(incentive_payout_batches.period_end, range.start),
    lte(incentive_payout_batches.period_end, range.end),
  ];

  if (state.auth.roleName === "Branch Manager") {
    conditions.push(ne(roles.role_name, "Branch Manager"));
  }

  return db
    .select({
      bucket,
      value: sql<number>`coalesce(sum(${incentive_payout_history.computed_incentive}), 0)`,
    })
    .from(incentive_payout_history)
    .innerJoin(
      incentive_payout_batches,
      eq(incentive_payout_batches.batch_id, incentive_payout_history.batch_id),
    )
    .innerJoin(roles, eq(roles.role_id, incentive_payout_history.role_id))
    .where(whereFrom(conditions))
    .groupBy(bucket)
    .orderBy(bucket)
    .then((rows) => rows.map((row) => ({ bucket: row.bucket, value: toNumber(row.value) })))
    .catch(() => []);
}

function mergeSeriesRows(
  buckets: Array<{ key: string; label: string }>,
  series: {
    collections: BucketValueRow[];
    expenses: BucketValueRow[];
    incentives: BucketValueRow[];
  },
) {
  const collectionMap = new Map(series.collections.map((row) => [row.bucket, row.value]));
  const expenseMap = new Map(series.expenses.map((row) => [row.bucket, row.value]));
  const incentiveMap = new Map(series.incentives.map((row) => [row.bucket, row.value]));

  return buckets.map<AnalyticsChartRow>((bucket) => ({
    bucket: bucket.label,
    values: {
      collections: collectionMap.get(bucket.key) ?? 0,
      expenses: expenseMap.get(bucket.key) ?? 0,
      incentives: incentiveMap.get(bucket.key) ?? 0,
    },
  }));
}

export async function loadDashboardChartData(
  state: DashboardOverviewState,
  params: Awaited<DashboardChartPageProps["searchParams"]>,
): Promise<DashboardChartData | null> {
  const filters = parseDashboardChartFilters(params);

  if (!state.scope || state.auth.roleName === "Borrower") {
    return null;
  }

  const branchOptions = await loadBranchOptions(state);
  const dateRange = resolveDashboardChartDateRange(filters);
  const scopedBranchIds = resolveScopedBranchIds(state, branchOptions, filters.selectedBranchRaw);
  const config = resolveDashboardChartConfig(state.auth, branchOptions, scopedBranchIds);

  if (config.view === "none") {
    return null;
  }

  const buckets = buildBuckets(dateRange);
  const [collectionsRows, expensesRows, incentivesRows] = await Promise.all([
    config.series.some((series) => series.key === "collections")
      ? loadCollectionBuckets(state, config.scopedBranchIds, dateRange)
      : Promise.resolve([]),
    config.series.some((series) => series.key === "expenses")
      ? loadExpenseBuckets(config.scopedBranchIds, dateRange)
      : Promise.resolve([]),
    config.series.some((series) => series.key === "incentives")
      ? loadIncentiveBuckets(state, config.scopedBranchIds, dateRange)
      : Promise.resolve([]),
  ]);

  const chartData = mergeSeriesRows(buckets, {
    collections: collectionsRows,
    expenses: expensesRows,
    incentives: incentivesRows,
  });

  return {
    title: config.title,
    description: config.description,
    filters,
    branchFilterLabel: config.branchFilterLabel,
    canChooseBranch: config.canChooseBranch,
    branchOptions: config.branchOptions,
    chart: {
      rows: chartData,
      series: config.series,
      noData: chartData.every((row) =>
        config.series.every((series) => toNumber(row.values[series.key]) === 0),
      ),
    },
    dateRangeLabel: dateRange.label,
  };
}
