import "server-only";

import {
  and,
  asc,
  eq,
  gte,
  inArray,
  lt,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import { branch, collections, loan_records } from "@/db/schema";
import { formatCollectionsMonthLabel, formatCollectionsShortDate } from "@/app/dashboard/collections/format";
import { resolveCollectionsDateRange } from "@/app/dashboard/collections/filters";
import type {
  CollectionsAnalyticsAccessState,
  CollectionsAnalyticsData,
  CollectionsBranchOption,
  CollectionsComparisonData,
  CollectionsComparisonItem,
  CollectionsDateRange,
  CollectionsFilterState,
} from "@/app/dashboard/collections/types";
import type { AnalyticsChartModel, AnalyticsChartRow } from "@/components/analytics/types";
import {
  calculateLoanInterestCap,
  calculateLoanPrincipalRecoveredAsOf,
  calculateLoanRealizedInterestAsOf,
} from "@/app/dashboard/loans/loan-state";

type AnalyticsAccess = Extract<CollectionsAnalyticsAccessState, { view: "analytics" }>;

type BucketValueRow = {
  bucket: string;
  value: number;
};

type BucketSeriesRow = {
  bucket: string;
  values: Record<string, number>;
};

type ScopedLoanMeta = {
  loanId: number;
  branchId: number;
  principal: number;
  interestCap: number;
};

type GroupedCollectionRow = {
  loanId: number;
  branchId: number;
  activityDate: string;
  totalAmount: number;
  entryCount: number;
  missedPayments: number;
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

function buildScopedLoanConditions(access: AnalyticsAccess) {
  const conditions: SQL[] = [];

  if (access.selectedBranchId) {
    conditions.push(eq(loan_records.branch_id, access.selectedBranchId));
  } else if (access.allowedBranchIds.length > 0) {
    conditions.push(inArray(loan_records.branch_id, access.allowedBranchIds));
  } else {
    conditions.push(eq(loan_records.loan_id, -1));
  }

  return conditions;
}

function buildScopedConditions(access: AnalyticsAccess, range: CollectionsDateRange) {
  return [
    ...buildScopedLoanConditions(access),
    gte(collections.collection_date, range.start),
    lte(collections.collection_date, range.end),
  ];
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

function buildMultiSeriesChartModel(
  buckets: Array<{ key: string; label: string }>,
  sourceRows: BucketSeriesRow[],
  series: AnalyticsChartModel["series"],
): AnalyticsChartModel {
  const lookup = new Map(sourceRows.map((row) => [row.bucket, row.values]));
  const rows = buckets.map<AnalyticsChartRow>((bucket) => ({
    bucket: bucket.label,
    values: Object.fromEntries(
      series.map((definition) => [definition.key, Number(lookup.get(bucket.key)?.[definition.key] ?? 0)]),
    ),
  }));

  return {
    rows,
    series,
    noData: rows.every((row) =>
      series.every((definition) => toNumber(row.values[definition.key]) === 0),
    ),
  };
}

function bucketKeyForCollectionDate(value: string, granularity: CollectionsDateRange["granularity"]) {
  if (granularity === "month") {
    return value.slice(0, 7);
  }

  return value;
}

function weekdayIndexForCollectionDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCDay();
}

function calculateCollectionsRecoveryDelta(params: {
  amountCollectedBefore: number;
  amountCollectedAfter: number;
  principal: number;
  interestCap: number;
}) {
  const principalRecoveredBefore = calculateLoanPrincipalRecoveredAsOf(
    params.amountCollectedBefore,
    params.principal,
  );
  const principalRecoveredAfter = calculateLoanPrincipalRecoveredAsOf(
    params.amountCollectedAfter,
    params.principal,
  );
  const realizedInterestBefore = calculateLoanRealizedInterestAsOf(
    params.amountCollectedBefore,
    params.principal,
    params.interestCap,
  );
  const realizedInterestAfter = calculateLoanRealizedInterestAsOf(
    params.amountCollectedAfter,
    params.principal,
    params.interestCap,
  );

  return {
    principalRecovered: Math.max(principalRecoveredAfter - principalRecoveredBefore, 0),
    realizedInterest: Math.max(realizedInterestAfter - realizedInterestBefore, 0),
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
const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* Legacy distribution/insight helpers kept nearby for reference during future analytics expansion.
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
*/

function buildComparisonCard(
  access: AnalyticsAccess,
  branchItems: CollectionsComparisonItem[],
): CollectionsComparisonData {
  const shouldShowBranchComparison =
    access.canChooseBranch &&
    !access.selectedBranchId &&
    access.allowedBranchIds.length > 1 &&
    branchItems.length > 1;

  if (shouldShowBranchComparison) {
    return {
      mode: "branch",
      title: "Collections by Branch",
      description: "Compare collection mix across the branches currently in scope, with principal recovery and realized interest called out directly.",
      items: branchItems,
      emptyMessage: "No branch comparison data is available for the selected period.",
    };
  }

  return {
    mode: "branch",
    title: "Collections by Branch",
    description: "Branch comparison becomes available when multiple branches are in scope.",
    items: [],
    emptyMessage: "No branch comparison data is available for the selected period.",
  };
}

/* Legacy secondary analytics surfaces intentionally removed from the active Collections page.
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
*/

export async function loadCollectionsAnalyticsData(
  access: AnalyticsAccess,
  filters: CollectionsFilterState,
): Promise<CollectionsAnalyticsData> {
  const dateRange = resolveCollectionsDateRange(filters);
  const buckets = buildBuckets(dateRange);
  const branchConditions: SQL[] = [];

  if (access.selectedBranchId) {
    branchConditions.push(eq(loan_records.branch_id, access.selectedBranchId));
  } else if (access.allowedBranchIds.length > 0) {
    branchConditions.push(inArray(loan_records.branch_id, access.allowedBranchIds));
  } else {
    branchConditions.push(eq(loan_records.loan_id, -1));
  }

  const loanRows = await db
    .select({
      loanId: loan_records.loan_id,
      branchId: loan_records.branch_id,
      principal: loan_records.principal,
      interest: loan_records.interest,
    })
    .from(loan_records)
    .where(whereFrom(branchConditions))
    .catch(() => []);

  const scopedLoans = new Map<number, ScopedLoanMeta>(
    loanRows.map((row) => {
      const principal = toNumber(row.principal);
      const interest = toNumber(row.interest);

      return [
        row.loanId,
        {
          loanId: row.loanId,
          branchId: row.branchId,
          principal,
          interestCap: calculateLoanInterestCap(principal, interest),
        },
      ] as const;
    }),
  );

  const scopedLoanIds = Array.from(scopedLoans.keys());

  const summary = {
    totalAmount: 0,
    principalRecovered: 0,
    realizedInterest: 0,
    totalEntries: 0,
    averageAmount: 0,
    missedPayments: 0,
    missedPaymentRate: 0,
    activeCollectionDays: 0,
    averagePerActiveDay: 0,
  };
  let compositionTrend = buildMultiSeriesChartModel(buckets, [], [
    { key: "principalRecovered", label: "Principal Recovered", color: "#16a34a" },
    { key: "realizedInterest", label: "Realized Interest", color: "#0ea5e9" },
  ]);
  let missedPaymentsTrend = buildChartModel(buckets, [], [
    { key: "missed", label: "Missed Payments", color: "#f59e0b" },
  ]);
  let comparison = buildComparisonCard(access, []);

  if (scopedLoanIds.length > 0) {
    const [priorCollectionRows, inPeriodRows, branchNameRows] = await Promise.all([
      db
        .select({
          loanId: collections.loan_id,
          totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
        })
        .from(collections)
        .where(and(inArray(collections.loan_id, scopedLoanIds), lt(collections.collection_date, dateRange.start)))
        .groupBy(collections.loan_id)
        .catch(() => []),
      db
        .select({
          loanId: collections.loan_id,
          branchId: loan_records.branch_id,
          activityDate: collections.collection_date,
          totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
          entryCount: sql<number>`count(*)`,
          missedPayments: sql<number>`coalesce(sum(case when ${collections.amount} = 0 then 1 else 0 end), 0)`,
        })
        .from(collections)
        .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
        .where(whereFrom(buildScopedConditions(access, dateRange)))
        .groupBy(collections.loan_id, loan_records.branch_id, collections.collection_date)
        .orderBy(asc(collections.loan_id), asc(collections.collection_date))
        .catch(() => []),
      db
        .select({
          branchId: branch.branch_id,
          branchName: branch.branch_name,
        })
        .from(branch)
        .where(
          access.allowedBranchIds.length > 0
            ? inArray(branch.branch_id, access.allowedBranchIds)
            : eq(branch.branch_id, -1),
        )
        .catch(() => []),
    ]);

    const priorCollectedByLoan = new Map(
      priorCollectionRows.map((row) => [row.loanId, toNumber(row.totalAmount)] as const),
    );
    const cumulativeByLoan = new Map(priorCollectedByLoan);
    const branchNameById = new Map(branchNameRows.map((row) => [row.branchId, row.branchName] as const));
    const bucketCompositionTotals = new Map<string, { principalRecovered: number; realizedInterest: number }>();
    const bucketMissedTotals = new Map<string, number>();
    const branchComparison = new Map<string, CollectionsComparisonItem>();
    const weekdayComparison = new Map<string, CollectionsComparisonItem>();
    const activeCollectionDays = new Set<string>();

    for (const rawRow of inPeriodRows) {
      const row: GroupedCollectionRow = {
        loanId: rawRow.loanId,
        branchId: rawRow.branchId,
        activityDate: rawRow.activityDate,
        totalAmount: toNumber(rawRow.totalAmount),
        entryCount: toNumber(rawRow.entryCount),
        missedPayments: toNumber(rawRow.missedPayments),
      };
      const loanMeta = scopedLoans.get(row.loanId);
      if (!loanMeta) {
        continue;
      }

      const amountCollectedBefore = cumulativeByLoan.get(row.loanId) ?? 0;
      const amountCollectedAfter = amountCollectedBefore + row.totalAmount;
      cumulativeByLoan.set(row.loanId, amountCollectedAfter);

      const recoveryDelta = calculateCollectionsRecoveryDelta({
        amountCollectedBefore,
        amountCollectedAfter,
        principal: loanMeta.principal,
        interestCap: loanMeta.interestCap,
      });
      const bucketKey = bucketKeyForCollectionDate(row.activityDate, dateRange.granularity);
      const bucketEntry = bucketCompositionTotals.get(bucketKey) ?? {
        principalRecovered: 0,
        realizedInterest: 0,
      };
      bucketEntry.principalRecovered += recoveryDelta.principalRecovered;
      bucketEntry.realizedInterest += recoveryDelta.realizedInterest;
      bucketCompositionTotals.set(bucketKey, bucketEntry);
      bucketMissedTotals.set(bucketKey, (bucketMissedTotals.get(bucketKey) ?? 0) + row.missedPayments);

      summary.totalAmount += row.totalAmount;
      summary.principalRecovered += recoveryDelta.principalRecovered;
      summary.realizedInterest += recoveryDelta.realizedInterest;
      summary.totalEntries += row.entryCount;
      summary.missedPayments += row.missedPayments;

      if (row.totalAmount > 0) {
        activeCollectionDays.add(row.activityDate);
      }

      const branchLabel = branchNameById.get(row.branchId) ?? `Branch ${row.branchId}`;
      const branchEntry = branchComparison.get(branchLabel) ?? {
        label: branchLabel,
        totalAmount: 0,
        principalRecovered: 0,
        realizedInterest: 0,
        entryCount: 0,
        missedPayments: 0,
        missedPaymentRate: 0,
      };
      branchEntry.totalAmount += row.totalAmount;
      branchEntry.principalRecovered += recoveryDelta.principalRecovered;
      branchEntry.realizedInterest += recoveryDelta.realizedInterest;
      branchEntry.entryCount += row.entryCount;
      branchEntry.missedPayments += row.missedPayments;
      branchEntry.missedPaymentRate =
        branchEntry.entryCount > 0 ? (branchEntry.missedPayments / branchEntry.entryCount) * 100 : 0;
      branchComparison.set(branchLabel, branchEntry);

      const weekdayLabel = WEEKDAY_LABELS[weekdayIndexForCollectionDate(row.activityDate)] ?? "Unknown";
      const weekdayEntry = weekdayComparison.get(weekdayLabel) ?? {
        label: weekdayLabel,
        totalAmount: 0,
        principalRecovered: 0,
        realizedInterest: 0,
        entryCount: 0,
        missedPayments: 0,
        missedPaymentRate: 0,
      };
      weekdayEntry.totalAmount += row.totalAmount;
      weekdayEntry.principalRecovered += recoveryDelta.principalRecovered;
      weekdayEntry.realizedInterest += recoveryDelta.realizedInterest;
      weekdayEntry.entryCount += row.entryCount;
      weekdayEntry.missedPayments += row.missedPayments;
      weekdayEntry.missedPaymentRate =
        weekdayEntry.entryCount > 0 ? (weekdayEntry.missedPayments / weekdayEntry.entryCount) * 100 : 0;
      weekdayComparison.set(weekdayLabel, weekdayEntry);
    }

    summary.averageAmount = summary.totalEntries > 0 ? summary.totalAmount / summary.totalEntries : 0;
    summary.missedPaymentRate =
      summary.totalEntries > 0 ? (summary.missedPayments / summary.totalEntries) * 100 : 0;
    summary.activeCollectionDays = activeCollectionDays.size;
    summary.averagePerActiveDay =
      summary.activeCollectionDays > 0 ? summary.totalAmount / summary.activeCollectionDays : 0;

    const compositionRows: BucketSeriesRow[] = Array.from(bucketCompositionTotals.entries()).map(([bucket, values]) => ({
      bucket,
      values,
    }));
    const missedRows: BucketValueRow[] = Array.from(bucketMissedTotals.entries()).map(([bucket, value]) => ({
      bucket,
      value,
    }));

    compositionTrend = buildMultiSeriesChartModel(buckets, compositionRows, [
      { key: "principalRecovered", label: "Principal Recovered", color: "#16a34a" },
      { key: "realizedInterest", label: "Realized Interest", color: "#0ea5e9" },
    ]);
    missedPaymentsTrend = buildChartModel(buckets, missedRows, [
      { key: "missed", label: "Missed Payments", color: "#f59e0b" },
    ]);
    comparison = buildComparisonCard(
      access,
      Array.from(branchComparison.values()).sort(
        (left, right) => right.totalAmount - left.totalAmount || left.label.localeCompare(right.label),
      ).slice(0, 6),
    );
  }

  return {
    filters,
    dateRangeLabel: dateRange.label,
    summary,
    compositionTrend,
    missedPaymentsTrend,
    comparison,
  };
}
