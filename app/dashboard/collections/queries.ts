import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import { db } from "@/db";
import { branch, collections, loan_records } from "@/db/schema";
import { formatCollectionsCurrency, formatCollectionsDisplayDate, formatCollectionsMonthLabel, formatCollectionsShortDate } from "@/app/dashboard/collections/format";
import { resolveCollectionsDateRange } from "@/app/dashboard/collections/filters";
import type {
  CollectionsAnalyticsAccessState,
  CollectionsAnalyticsData,
  CollectionsBranchOption,
  CollectionsDateRange,
  CollectionsFilterState,
  CollectionsRankedCardData,
  CollectionsRankedItem,
} from "@/app/dashboard/collections/types";
import type { AnalyticsChartModel, AnalyticsChartRow } from "@/components/analytics/types";

type AnalyticsAccess = Extract<CollectionsAnalyticsAccessState, { view: "analytics" }>;

type BucketValueRow = {
  bucket: string;
  value: number;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function buildScopedConditions(access: AnalyticsAccess, range: CollectionsDateRange) {
  const conditions: SQL[] = [
    gte(collections.collection_date, range.start),
    lte(collections.collection_date, range.end),
  ];

  if (access.selectedBranchId) {
    conditions.push(eq(loan_records.branch_id, access.selectedBranchId));
  } else if (access.allowedBranchIds.length > 0) {
    conditions.push(inArray(loan_records.branch_id, access.allowedBranchIds));
  } else {
    conditions.push(eq(loan_records.loan_id, -1));
  }

  return conditions;
}

function bucketExpression(column: SQLWrapper, granularity: CollectionsDateRange["granularity"]) {
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

function buildBuckets(range: CollectionsDateRange) {
  const buckets: Array<{ key: string; label: string }> = [];

  if (range.granularity === "month") {
    let cursor = new Date(Date.UTC(parseIsoDate(range.start).getUTCFullYear(), parseIsoDate(range.start).getUTCMonth(), 1));
    const end = new Date(Date.UTC(parseIsoDate(range.end).getUTCFullYear(), parseIsoDate(range.end).getUTCMonth(), 1));

    while (cursor.getTime() <= end.getTime()) {
      const key = cursor.toISOString().slice(0, 7);
      buckets.push({ key, label: formatCollectionsMonthLabel(key) });
      cursor = addMonths(cursor, 1);
    }

    return buckets;
  }

  let cursor = parseIsoDate(range.start);
  const end = parseIsoDate(range.end);

  while (cursor.getTime() <= end.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.push({ key, label: formatCollectionsShortDate(key) });
    cursor = addDays(cursor, 1);
  }

  return buckets;
}

function buildChartModel(
  buckets: Array<{ key: string; label: string }>,
  sourceRows: BucketValueRow[],
  series: AnalyticsChartModel["series"],
): AnalyticsChartModel {
  const lookup = new Map(sourceRows.map((row) => [row.bucket, row.value]));
  const rows = buckets.map<AnalyticsChartRow>((bucket) => ({
    bucket: bucket.label,
    values: {
      [series[0].key]: lookup.get(bucket.key) ?? 0,
    },
  }));

  return {
    rows,
    series,
    noData: rows.every((row) => toNumber(row.values[series[0].key]) === 0),
  };
}

export async function loadCollectionsBranchOptions(
  access: AnalyticsAccess,
): Promise<CollectionsBranchOption[]> {
  if (!access.canChooseBranch) {
    return [];
  }

  const rows = await db
    .select({
      value: sql<string>`${branch.branch_id}::text`,
      label: branch.branch_name,
    })
    .from(branch)
    .where(
      access.allowedBranchIds.length > 0
        ? inArray(branch.branch_id, access.allowedBranchIds)
        : eq(branch.branch_id, -1),
    )
    .orderBy(asc(branch.branch_name))
    .catch(() => []);

  return [{ value: "all", label: "All visible branches" }, ...rows];
}

async function loadSummary(access: AnalyticsAccess, range: CollectionsDateRange) {
  const conditions = buildScopedConditions(access, range);

  return db
    .select({
      totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      totalEntries: sql<number>`count(*)`,
      averageAmount: sql<number>`coalesce(avg(${collections.amount}), 0)`,
      missedPayments: sql<number>`sum(case when ${collections.amount} = 0 then 1 else 0 end)`,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(whereFrom(conditions))
    .limit(1)
    .then((rows) => ({
      totalAmount: toNumber(rows[0]?.totalAmount),
      totalEntries: toNumber(rows[0]?.totalEntries),
      averageAmount: toNumber(rows[0]?.averageAmount),
      missedPayments: toNumber(rows[0]?.missedPayments),
    }))
    .catch(() => ({
      totalAmount: 0,
      totalEntries: 0,
      averageAmount: 0,
      missedPayments: 0,
    }));
}

async function loadCollectionsTrend(access: AnalyticsAccess, range: CollectionsDateRange) {
  const bucket = bucketExpression(collections.collection_date, range.granularity);

  return db
    .select({
      bucket,
      value: sql<number>`coalesce(sum(${collections.amount}), 0)`,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(whereFrom(buildScopedConditions(access, range)))
    .groupBy(bucket)
    .orderBy(bucket)
    .then((rows) => rows.map((row) => ({ bucket: row.bucket, value: toNumber(row.value) })))
    .catch(() => []);
}

async function loadMissedPaymentsTrend(access: AnalyticsAccess, range: CollectionsDateRange) {
  const bucket = bucketExpression(collections.collection_date, range.granularity);

  return db
    .select({
      bucket,
      value: sql<number>`sum(case when ${collections.amount} = 0 then 1 else 0 end)`,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(whereFrom(buildScopedConditions(access, range)))
    .groupBy(bucket)
    .orderBy(bucket)
    .then((rows) => rows.map((row) => ({ bucket: row.bucket, value: toNumber(row.value) })))
    .catch(() => []);
}

async function loadCollectionsByBranch(access: AnalyticsAccess, range: CollectionsDateRange): Promise<CollectionsRankedItem[]> {
  const sumExpression = sql<number>`coalesce(sum(${collections.amount}), 0)`;
  const countExpression = sql<number>`count(*)`;

  return db
    .select({
      label: branch.branch_name,
      value: sumExpression,
      secondaryValue: countExpression,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .innerJoin(branch, eq(branch.branch_id, loan_records.branch_id))
    .where(whereFrom(buildScopedConditions(access, range)))
    .groupBy(branch.branch_id, branch.branch_name)
    .orderBy(desc(sumExpression), asc(branch.branch_name))
    .limit(6)
    .then((rows) =>
      rows.map((row) => ({
        label: row.label,
        value: toNumber(row.value),
        secondaryValue: toNumber(row.secondaryValue),
      })),
    )
    .catch(() => []);
}

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function loadCollectionsByWeekday(access: AnalyticsAccess, range: CollectionsDateRange): Promise<CollectionsRankedItem[]> {
  const dayOrder = sql<number>`extract(dow from ${collections.collection_date})::int`;
  const sumExpression = sql<number>`coalesce(sum(${collections.amount}), 0)`;
  const countExpression = sql<number>`count(*)`;

  return db
    .select({
      dayOrder,
      value: sumExpression,
      secondaryValue: countExpression,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(whereFrom(buildScopedConditions(access, range)))
    .groupBy(dayOrder)
    .orderBy(dayOrder)
    .then((rows) =>
      rows.map((row) => ({
        label: WEEKDAY_LABELS[toNumber(row.dayOrder)] ?? "Unknown",
        value: toNumber(row.value),
        secondaryValue: toNumber(row.secondaryValue),
      })),
    )
    .catch(() => []);
}

async function loadCollectionSizeBuckets(access: AnalyticsAccess, range: CollectionsDateRange): Promise<CollectionsRankedItem[]> {
  const bucketOrder = sql<number>`case
    when ${collections.amount} = 0 then 0
    when ${collections.amount} <= 500 then 1
    when ${collections.amount} <= 1500 then 2
    when ${collections.amount} <= 5000 then 3
    else 4
  end`;
  const bucketLabel = sql<string>`case
    when ${collections.amount} = 0 then 'Missed / Zero'
    when ${collections.amount} <= 500 then 'Up to ₱500'
    when ${collections.amount} <= 1500 then '₱501 to ₱1,500'
    when ${collections.amount} <= 5000 then '₱1,501 to ₱5,000'
    else 'Above ₱5,000'
  end`;
  const countExpression = sql<number>`count(*)`;
  const sumExpression = sql<number>`coalesce(sum(${collections.amount}), 0)`;

  return db
    .select({
      label: bucketLabel,
      bucketOrder,
      value: countExpression,
      secondaryValue: sumExpression,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(whereFrom(buildScopedConditions(access, range)))
    .groupBy(bucketLabel, bucketOrder)
    .orderBy(bucketOrder)
    .then((rows) =>
      rows.map((row) => ({
        label: row.label,
        value: toNumber(row.value),
        secondaryValue: toNumber(row.secondaryValue),
      })),
    )
    .catch(() => []);
}

async function loadTopCollectionDay(access: AnalyticsAccess, range: CollectionsDateRange) {
  const sumExpression = sql<number>`coalesce(sum(${collections.amount}), 0)`;
  const countExpression = sql<number>`count(*)`;

  return db
    .select({
      collectionDate: collections.collection_date,
      totalAmount: sumExpression,
      totalEntries: countExpression,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(whereFrom(buildScopedConditions(access, range)))
    .groupBy(collections.collection_date)
    .orderBy(desc(sumExpression), desc(countExpression), desc(collections.collection_date))
    .limit(1)
    .then((rows) => {
      const row = rows[0];
      return row
        ? {
            collectionDate: row.collectionDate,
            totalAmount: toNumber(row.totalAmount),
            totalEntries: toNumber(row.totalEntries),
          }
        : null;
    })
    .catch(() => null);
}

async function loadTopMissedPaymentDay(access: AnalyticsAccess, range: CollectionsDateRange) {
  const countExpression = sql<number>`count(*)`;

  return db
    .select({
      collectionDate: collections.collection_date,
      missedPayments: countExpression,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(
      whereFrom([...buildScopedConditions(access, range), eq(collections.amount, "0")]),
    )
    .groupBy(collections.collection_date)
    .orderBy(desc(countExpression), desc(collections.collection_date))
    .limit(1)
    .then((rows) => {
      const row = rows[0];
      return row
        ? {
            collectionDate: row.collectionDate,
            missedPayments: toNumber(row.missedPayments),
          }
        : null;
    })
    .catch(() => null);
}

function buildComparisonCard(
  access: AnalyticsAccess,
  filters: CollectionsFilterState,
  branchItems: CollectionsRankedItem[],
  weekdayItems: CollectionsRankedItem[],
): CollectionsRankedCardData {
  const shouldShowBranchComparison =
    access.canChooseBranch &&
    !access.selectedBranchId &&
    access.allowedBranchIds.length > 1 &&
    branchItems.length > 1;

  if (shouldShowBranchComparison) {
    return {
      title: "Collections by Branch",
      description: "Compare total collected amount across the branches currently in scope.",
      valueLabel: "Collected",
      secondaryLabel: "Entries",
      items: branchItems,
      emptyMessage: "No branch comparison data is available for the selected period.",
    };
  }

  return {
    title: "Collections by Weekday",
    description:
      access.roleName === "Branch Manager"
        ? `See which weekdays deliver the strongest collection volume in ${access.fixedBranchName ?? "your branch"}.`
        : "See which weekdays drive the strongest collection volume in the selected branch scope.",
    valueLabel: "Collected",
    secondaryLabel: "Entries",
    items: weekdayItems,
    emptyMessage: "No weekday collection pattern is available for the selected period.",
  };
}

function buildBreakdownCard(items: CollectionsRankedItem[]): CollectionsRankedCardData {
  return {
    title: "Collection Breakdown",
    description: "Distribution of collection entries by amount band, including missed-payment records.",
    valueLabel: "Entries",
    secondaryLabel: "Amount",
    items,
    emptyMessage: "No collection breakdown is available for the selected period.",
  };
}

function buildInsightCard(
  comparison: CollectionsRankedCardData,
  topCollectionDay: { collectionDate: string; totalAmount: number; totalEntries: number } | null,
  topMissedPaymentDay: { collectionDate: string; missedPayments: number } | null,
) {
  if (comparison.title === "Collections by Branch" && comparison.items[0]) {
    const topBranch = comparison.items[0];
    const missedSuffix = topMissedPaymentDay
      ? ` Highest missed-payment day was ${formatCollectionsDisplayDate(topMissedPaymentDay.collectionDate)} with ${topMissedPaymentDay.missedPayments} cases.`
      : "";

    return {
      eyebrow: "Branch peak",
      title: `${topBranch.label} led the selected period`,
      description: `${topBranch.label} produced ${formatCollectionsCurrency(topBranch.value)} across ${topBranch.secondaryValue.toLocaleString("en-PH")} entries.${missedSuffix}`,
    };
  }

  if (topCollectionDay) {
    const missedSuffix = topMissedPaymentDay
      ? ` Highest missed-payment day was ${formatCollectionsDisplayDate(topMissedPaymentDay.collectionDate)} with ${topMissedPaymentDay.missedPayments} cases.`
      : "";

    return {
      eyebrow: "Best collection day",
      title: `${formatCollectionsDisplayDate(topCollectionDay.collectionDate)} was the strongest day`,
      description: `The team collected ${formatCollectionsCurrency(topCollectionDay.totalAmount)} across ${topCollectionDay.totalEntries.toLocaleString("en-PH")} entries.${missedSuffix}`,
    };
  }

  if (topMissedPaymentDay) {
    return {
      eyebrow: "Missed payment alert",
      title: `${formatCollectionsDisplayDate(topMissedPaymentDay.collectionDate)} needs follow-up`,
      description: `${topMissedPaymentDay.missedPayments.toLocaleString("en-PH")} missed-payment entries were recorded on the highest-risk day in the selected period.`,
    };
  }

  return {
    eyebrow: "No activity",
    title: "No collection activity matched the selected period",
    description: "Adjust the filters to inspect another period or branch scope.",
  };
}

export async function loadCollectionsAnalyticsData(
  access: AnalyticsAccess,
  filters: CollectionsFilterState,
): Promise<CollectionsAnalyticsData> {
  const dateRange = resolveCollectionsDateRange(filters);
  const buckets = buildBuckets(dateRange);

  const [
    summary,
    collectionTrendRows,
    missedTrendRows,
    branchItems,
    weekdayItems,
    bucketItems,
    topCollectionDay,
    topMissedPaymentDay,
  ] = await Promise.all([
    loadSummary(access, dateRange),
    loadCollectionsTrend(access, dateRange),
    loadMissedPaymentsTrend(access, dateRange),
    loadCollectionsByBranch(access, dateRange),
    loadCollectionsByWeekday(access, dateRange),
    loadCollectionSizeBuckets(access, dateRange),
    loadTopCollectionDay(access, dateRange),
    loadTopMissedPaymentDay(access, dateRange),
  ]);

  const comparison = buildComparisonCard(access, filters, branchItems, weekdayItems);
  const breakdown = buildBreakdownCard(bucketItems);

  return {
    filters,
    dateRangeLabel: dateRange.label,
    summary,
    collectionsTrend: buildChartModel(buckets, collectionTrendRows, [
      { key: "collections", label: "Collections", color: "#22c55e" },
    ]),
    missedPaymentsTrend: buildChartModel(buckets, missedTrendRows, [
      { key: "missed", label: "Missed Payments", color: "#f59e0b" },
    ]),
    comparison,
    breakdown,
    insight: buildInsightCard(comparison, topCollectionDay, topMissedPaymentDay),
  };
}
