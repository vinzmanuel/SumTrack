import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { ACTIVE_LOAN_STATUSES } from "@/app/dashboard/loans/active-statuses";
import {
  buildActiveLoansSummarySnapshot,
  buildBranchPerformanceComparisonSnapshot,
  buildBorrowerLoanScheduleSnapshot,
  buildCollectionReceiptSnapshot,
  buildFinancialOverviewSnapshot,
  buildLoanReceiptSummarySnapshot,
  buildMonthlyCollectionsSummarySnapshot,
} from "@/app/dashboard/reports/snapshot-builders";
import {
  buildAnalyticsTemplateOptions,
  getAnalyticsTemplateDefinition,
  getOperationalDocumentTemplateDefinition,
  resolveReportTemplateLabel,
} from "@/app/dashboard/reports/templates";
import type {
  AnalyticsReportTemplateKey,
  OperationalDocumentTemplateKey,
  ReportsBranchOption,
  ReportsLibraryFilterState,
  ReportsLibraryPageData,
  ReportsLibraryRow,
  ReportsPageData,
  ReportsReadyAccessState,
  ReportsViewerPageData,
  SavedReportSnapshot,
} from "@/app/dashboard/reports/types";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  branch,
  collections,
  employee_info,
  expenses,
  incentive_payout_batches,
  incentive_payout_history,
  loan_records,
  reports,
  roles,
  users,
} from "@/db/schema";

type GenerateAnalyticsReportInput = {
  title: string;
  templateKey: AnalyticsReportTemplateKey;
  branchIds: number[];
  dateFrom: string | null;
  dateTo: string | null;
  month: string | null;
};

type GenerateOperationalDocumentInput = {
  templateKey: OperationalDocumentTemplateKey;
  sourceEntityId: number;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateLoanDurationDays(startDate: string, dueDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const due = new Date(`${dueDate}T00:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) {
    return null;
  }

  const diff = Math.ceil((due.getTime() - start.getTime()) / 86400000);
  return diff > 0 ? diff : null;
}

function isLoanReceiptSummaryEligible(status: string, outstandingBalance: number) {
  return (status === "Completed" || status === "Archived") && outstandingBalance <= 0.01;
}

type DateBucketMode = "day" | "month";

function countInclusiveDays(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }

  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function resolveDateBucketMode(dateFrom: string, dateTo: string): DateBucketMode {
  return countInclusiveDays(dateFrom, dateTo) <= 45 ? "day" : "month";
}

function bucketKeyForIsoDate(date: string, mode: DateBucketMode) {
  return mode === "day" ? date : date.slice(0, 7);
}

function bucketLabelFromKey(bucketKey: string, mode: DateBucketMode) {
  if (mode === "day") {
    const parsed = new Date(`${bucketKey}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      return bucketKey;
    }

    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "2-digit",
      timeZone: "UTC",
    }).format(parsed);
  }

  const parsed = new Date(`${bucketKey}-01T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return bucketKey;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function enumerateBucketLabels(dateFrom: string, dateTo: string, mode: DateBucketMode) {
  const start = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [] as Array<{ key: string; label: string }>;
  }

  const rows: Array<{ key: string; label: string }> = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const year = cursor.getUTCFullYear();
    const month = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const day = String(cursor.getUTCDate()).padStart(2, "0");
    const key = mode === "day" ? `${year}-${month}-${day}` : `${year}-${month}`;

    if (!rows.some((row) => row.key === key)) {
      rows.push({
        key,
        label: bucketLabelFromKey(key, mode),
      });
    }

    if (mode === "day") {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    } else {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    }
  }

  return rows;
}

function getReportSeriesColor(index: number) {
  const palette = ["#16a34a", "#0ea5e9", "#f59e0b", "#6366f1", "#ef4444", "#0f172a"] as const;
  return palette[index % palette.length];
}

function enumerateIsoDates(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [] as string[];
  }

  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function buildUserDisplayName(params: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  username?: string | null;
  fallback?: string | null;
}) {
  const fullName = [params.firstName, params.middleName, params.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || params.username || params.fallback || "Unknown";
}

function sortBranchIds(branchIds: number[]) {
  return Array.from(new Set(branchIds)).sort((left, right) => left - right);
}

function formatIsoDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatMoney(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function resolveMonthWindow(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 1 || monthIndex > 12) {
    return null;
  }

  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 0));

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat("en-PH", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(start),
  };
}

function buildScopeLabel(branchNames: string[]) {
  if (branchNames.length === 0) {
    return "No branch scope";
  }

  if (branchNames.length === 1) {
    return branchNames[0];
  }

  return `${branchNames.length} selected branches`;
}

function buildDateRangeLabel(dateFrom: string, dateTo: string) {
  if (dateFrom === dateTo) {
    return formatIsoDate(dateFrom);
  }

  return `${formatIsoDate(dateFrom)} to ${formatIsoDate(dateTo)}`;
}

function buildReportsLibraryScopeWhere(access: ReportsReadyAccessState) {
  if (access.roleName === "Admin") {
    return undefined;
  }

  const conditions: SQL[] = [];

  if (access.roleName === "Auditor") {
    conditions.push(eq(reports.report_category, "analytics"));
  }

  if (access.roleName === "Secretary") {
    conditions.push(eq(reports.report_category, "document"));
  }

  if (access.fixedBranchId !== null) {
    conditions.push(sql`array_position(${reports.branch_scope}, ${access.fixedBranchId}) is not null`);
  } else if (access.allowedBranchIds.length > 0) {
    const branchScopeConditions = access.allowedBranchIds.map((branchId) =>
      sql`array_position(${reports.branch_scope}, ${branchId}) is not null`,
    );
    const branchScopeWhere =
      branchScopeConditions.length === 1
        ? branchScopeConditions[0]
        : or(...branchScopeConditions);

    if (branchScopeWhere) {
      conditions.push(branchScopeWhere);
    }
  } else {
    conditions.push(eq(reports.report_id, -1));
  }

  if (conditions.length === 0) {
    return undefined;
  }

  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

function buildReportsLibraryRow(row: {
  reportId: number;
  title: string;
  reportCategory: "analytics" | "document";
  templateKey: string;
  generatedType: "user" | "system";
  generatedAt: string;
  status: "active" | "archived";
  generatedByUserId: string;
  generatedByName: string;
  generatedByRoleName: string | null;
  branchScope: number[];
  dateFrom: string | null;
  dateTo: string | null;
  sourceEntityType: "loan" | "collection" | null;
  sourceEntityId: number | null;
}): ReportsLibraryRow {
  return {
    reportId: row.reportId,
    title: row.title,
    reportCategory: row.reportCategory,
    templateKey: row.templateKey,
    templateLabel: resolveReportTemplateLabel(row.templateKey),
    generatedType: row.generatedType,
    generatedAt: row.generatedAt,
    status: row.status,
    generatedByUserId: row.generatedByUserId,
    generatedByName: row.generatedByName,
    generatedByRoleName: row.generatedByRoleName,
    branchScope: row.branchScope,
    dateFrom: row.dateFrom,
    dateTo: row.dateTo,
    sourceEntityType: row.sourceEntityType,
    sourceEntityId: row.sourceEntityId,
  };
}

function buildReportUserOptionLabel(params: {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  companyId: string | null;
  username: string | null;
}) {
  const first = params.firstName?.trim() ?? "";
  const middle = params.middleName?.trim() ?? "";
  const last = params.lastName?.trim() ?? "";
  const middleInitial = middle ? `${middle[0].toUpperCase()}.` : "";
  const fullName = [first, middleInitial, last].filter(Boolean).join(" ").trim();
  const identity = fullName || params.username || "Unknown User";
  const company = params.companyId?.trim() || "N/A";

  return `${identity} (${company})`;
}

async function loadVisibleLibraryBranchOptions(
  access: ReportsReadyAccessState,
): Promise<ReportsBranchOption[]> {
  if (access.roleName === "Admin") {
    return db
      .select({
        branchId: branch.branch_id,
        branchName: branch.branch_name,
      })
      .from(branch)
      .orderBy(asc(branch.branch_name))
      .catch(() => []);
  }

  if (access.allowedBranchIds.length === 0) {
    return [];
  }

  return db
    .select({
      branchId: branch.branch_id,
      branchName: branch.branch_name,
    })
    .from(branch)
    .where(inArray(branch.branch_id, access.allowedBranchIds))
    .orderBy(asc(branch.branch_name))
    .catch(() => []);
}

async function loadVisibleBranchOptions(access: ReportsReadyAccessState): Promise<ReportsBranchOption[]> {
  if (!access.canAccessAnalytics || access.allowedBranchIds.length === 0) {
    return [];
  }

  return db
    .select({
      branchId: branch.branch_id,
      branchName: branch.branch_name,
    })
    .from(branch)
    .where(inArray(branch.branch_id, access.allowedBranchIds))
    .orderBy(asc(branch.branch_name))
    .catch(() => []);
}

async function loadSelectedBranchRows(branchIds: number[]) {
  if (branchIds.length === 0) {
    return [];
  }

  return db
    .select({
      branchId: branch.branch_id,
      branchName: branch.branch_name,
    })
    .from(branch)
    .where(inArray(branch.branch_id, branchIds))
    .orderBy(asc(branch.branch_name))
    .catch(() => []);
}

async function loadLiveLoanBranchMetrics(branchIds: number[]) {
  const safeBranchIds = sortBranchIds(branchIds);
  if (safeBranchIds.length === 0) {
    return new Map<number, {
      activeLoans: number;
      overdueLoans: number;
      principalExposure: number;
      totalPayableActive: number;
      outstandingBalance: number;
    }>();
  }

  const [loanRows, paymentRows] = await Promise.all([
    db
      .select({
        branchId: loan_records.branch_id,
        activeLoans: sql<number>`sum(case when ${loan_records.status} = 'Active' then 1 else 0 end)`,
        overdueLoans: sql<number>`sum(case when ${loan_records.status} = 'Overdue' then 1 else 0 end)`,
        principalExposure: sql<number>`coalesce(sum(case when ${loan_records.status} in ('Active', 'Overdue') then ${loan_records.principal} else 0 end), 0)`,
        totalPayableActive: sql<number>`coalesce(sum(case when ${loan_records.status} in ('Active', 'Overdue') then ${loan_records.principal} + (${loan_records.principal} * ${loan_records.interest} / 100) else 0 end), 0)`,
      })
      .from(loan_records)
      .where(inArray(loan_records.branch_id, safeBranchIds))
      .groupBy(loan_records.branch_id)
      .catch(() => []),
    db
      .select({
        branchId: loan_records.branch_id,
        paidAgainstActive: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        and(
          inArray(loan_records.branch_id, safeBranchIds),
          inArray(loan_records.status, [...ACTIVE_LOAN_STATUSES]),
        ),
      )
      .groupBy(loan_records.branch_id)
      .catch(() => []),
  ]);

  const paidMap = new Map(paymentRows.map((row) => [row.branchId, toNumber(row.paidAgainstActive)]));

  return new Map(
    loanRows.map((row) => {
      const totalPayableActive = toNumber(row.totalPayableActive);
      const paidAgainstActive = paidMap.get(row.branchId) ?? 0;

      return [
        row.branchId,
        {
          activeLoans: toNumber(row.activeLoans),
          overdueLoans: toNumber(row.overdueLoans),
          principalExposure: toNumber(row.principalExposure),
          totalPayableActive,
          outstandingBalance: Math.max(totalPayableActive - paidAgainstActive, 0),
        },
      ];
    }),
  );
}

async function loadFinancialOverviewData(branchRows: Array<{ branchId: number; branchName: string }>, dateFrom: string, dateTo: string) {
  const branchIds = branchRows.map((row) => row.branchId);
  const bucketMode = resolveDateBucketMode(dateFrom, dateTo);
  const bucketLabels = enumerateBucketLabels(dateFrom, dateTo, bucketMode);
  const liveLoanMetrics = await loadLiveLoanBranchMetrics(branchIds);

  const [collectionRows, expenseRows, incentiveRows] = await Promise.all([
    db
      .select({
        branchId: loan_records.branch_id,
        activityDate: collections.collection_date,
        totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        and(
          inArray(loan_records.branch_id, branchIds),
          gte(collections.collection_date, dateFrom),
          lte(collections.collection_date, dateTo),
        ),
      )
      .groupBy(loan_records.branch_id, collections.collection_date)
      .catch(() => []),
    db
      .select({
        branchId: expenses.branch_id,
        activityDate: expenses.expense_date,
        totalAmount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(
        and(
          inArray(expenses.branch_id, branchIds),
          gte(expenses.expense_date, dateFrom),
          lte(expenses.expense_date, dateTo),
        ),
      )
      .groupBy(expenses.branch_id, expenses.expense_date)
      .catch(() => []),
    db
      .select({
        branchId: incentive_payout_batches.branch_id,
        activityDate: incentive_payout_batches.period_end,
        totalAmount: sql<number>`coalesce(sum(${incentive_payout_history.computed_incentive}), 0)`,
      })
      .from(incentive_payout_history)
      .innerJoin(
        incentive_payout_batches,
        eq(incentive_payout_batches.batch_id, incentive_payout_history.batch_id),
      )
      .where(
        and(
          inArray(incentive_payout_batches.branch_id, branchIds),
          gte(incentive_payout_batches.period_end, dateFrom),
          lte(incentive_payout_batches.period_end, dateTo),
        ),
      )
      .groupBy(incentive_payout_batches.branch_id, incentive_payout_batches.period_end)
      .catch(() => []),
  ]);

  const collectionTotals = new Map<number, number>();
  const expenseTotals = new Map<number, number>();
  const incentiveTotals = new Map<number, number>();
  const bucketCollectionTotals = new Map<string, number>();
  const bucketExpenseTotals = new Map<string, number>();
  const bucketIncentiveTotals = new Map<string, number>();

  for (const row of collectionRows) {
    const amount = toNumber(row.totalAmount);
    collectionTotals.set(row.branchId, (collectionTotals.get(row.branchId) ?? 0) + amount);
    const bucketKey = bucketKeyForIsoDate(row.activityDate, bucketMode);
    bucketCollectionTotals.set(bucketKey, (bucketCollectionTotals.get(bucketKey) ?? 0) + amount);
  }

  for (const row of expenseRows) {
    const amount = toNumber(row.totalAmount);
    expenseTotals.set(row.branchId, (expenseTotals.get(row.branchId) ?? 0) + amount);
    const bucketKey = bucketKeyForIsoDate(row.activityDate, bucketMode);
    bucketExpenseTotals.set(bucketKey, (bucketExpenseTotals.get(bucketKey) ?? 0) + amount);
  }

  for (const row of incentiveRows) {
    const amount = toNumber(row.totalAmount);
    incentiveTotals.set(row.branchId, (incentiveTotals.get(row.branchId) ?? 0) + amount);
    const bucketKey = bucketKeyForIsoDate(row.activityDate, bucketMode);
    bucketIncentiveTotals.set(bucketKey, (bucketIncentiveTotals.get(bucketKey) ?? 0) + amount);
  }

  const branchSummaryRows = branchRows.map((row) => {
    const collectionsAmount = collectionTotals.get(row.branchId) ?? 0;
    const expensesAmount = expenseTotals.get(row.branchId) ?? 0;
    const incentivesAmount = incentiveTotals.get(row.branchId) ?? 0;
    const loanMetrics = liveLoanMetrics.get(row.branchId) ?? {
      activeLoans: 0,
      overdueLoans: 0,
      principalExposure: 0,
      totalPayableActive: 0,
      outstandingBalance: 0,
    };

    return {
      branchName: row.branchName,
      collectionsAmount,
      expensesAmount,
      incentivesAmount,
      netAmount: collectionsAmount - expensesAmount - incentivesAmount,
      activeLoans: loanMetrics.activeLoans,
      overdueLoans: loanMetrics.overdueLoans,
      outstandingBalance: loanMetrics.outstandingBalance,
    };
  });

  const periodRows = bucketLabels.map((bucket) => {
    const collectionsAmount = bucketCollectionTotals.get(bucket.key) ?? 0;
    const expensesAmount = bucketExpenseTotals.get(bucket.key) ?? 0;
    const incentivesAmount = bucketIncentiveTotals.get(bucket.key) ?? 0;

    return {
      bucket: bucket.label,
      collectionsAmount,
      expensesAmount,
      incentivesAmount,
      netAmount: collectionsAmount - expensesAmount - incentivesAmount,
    };
  });

  const summary = branchSummaryRows.reduce(
    (totals, row) => ({
      collectionsTotal: totals.collectionsTotal + row.collectionsAmount,
      expensesTotal: totals.expensesTotal + row.expensesAmount,
      incentivesTotal: totals.incentivesTotal + row.incentivesAmount,
      netTotal: totals.netTotal + row.netAmount,
    }),
    {
      collectionsTotal: 0,
      expensesTotal: 0,
      incentivesTotal: 0,
      netTotal: 0,
    },
  );

  return {
    summary,
    periodRows,
    branchRows: branchSummaryRows,
  };
}

async function loadMonthlyCollectionsSummaryData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string,
  dateTo: string,
) {
  const branchIds = branchRows.map((row) => row.branchId);
  const dayLabels = enumerateBucketLabels(dateFrom, dateTo, "day");
  const [summaryRows, trendRows, branchBreakdownRows] = await Promise.all([
    db
      .select({
        totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
        totalEntries: sql<number>`count(*)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        and(
          inArray(loan_records.branch_id, branchIds),
          gte(collections.collection_date, dateFrom),
          lte(collections.collection_date, dateTo),
        ),
      )
      .limit(1)
      .catch(() => []),
    db
      .select({
        branchId: loan_records.branch_id,
        bucket: collections.collection_date,
        totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        and(
          inArray(loan_records.branch_id, branchIds),
          gte(collections.collection_date, dateFrom),
          lte(collections.collection_date, dateTo),
        ),
      )
      .groupBy(loan_records.branch_id, collections.collection_date)
      .orderBy(collections.collection_date, loan_records.branch_id)
      .catch(() => []),
    db
      .select({
        branchId: loan_records.branch_id,
        totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
        totalEntries: sql<number>`count(*)`,
        averageAmount: sql<number>`coalesce(avg(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        and(
          inArray(loan_records.branch_id, branchIds),
          gte(collections.collection_date, dateFrom),
          lte(collections.collection_date, dateTo),
        ),
      )
      .groupBy(loan_records.branch_id)
      .catch(() => []),
  ]);

  const summaryRow = summaryRows[0];
  const branchNameMap = new Map(branchRows.map((row) => [row.branchId, row.branchName]));
  const branchSeries = branchRows.map((row, index) => ({
    key: `branch_${row.branchId}`,
    label: row.branchName,
    color: getReportSeriesColor(index),
  }));
  const rawColumns: Array<{ key: string; label: string; format?: "currency" | "number" | "text" }> = [
    { key: "bucket", label: "Date" },
    ...branchSeries.map((series) => ({
      key: series.key,
      label: series.label,
      format: "currency" as const,
    })),
    { key: "totalAmount", label: "Total Collections", format: "currency" as const },
  ];
  const trendLookup = new Map<string, Record<string, number>>();

  for (const row of trendRows) {
    const bucketKey = row.bucket;
    const branchKey = `branch_${row.branchId}`;
    const existing = trendLookup.get(bucketKey) ?? {};
    existing[branchKey] = toNumber(row.totalAmount);
    trendLookup.set(bucketKey, existing);
  }

  let highestBucketLabel = "N/A";
  let highestBucketAmount = 0;

  const normalizedTrendRows = dayLabels.map((dayLabel) => {
    const values = trendLookup.get(dayLabel.key) ?? {};
    let totalAmount = 0;

    for (const series of branchSeries) {
      totalAmount += values[series.key] ?? 0;
    }

    if (totalAmount > highestBucketAmount) {
      highestBucketAmount = totalAmount;
      highestBucketLabel = `${dayLabel.label} (${formatMoney(totalAmount)})`;
    }

    return {
      bucket: dayLabel.label,
      values: branchSeries.length > 1 ? values : { collections: totalAmount },
    };
  });

  return {
    summary: {
      totalAmount: toNumber(summaryRow?.totalAmount),
      totalEntries: toNumber(summaryRow?.totalEntries),
      averagePerDay:
        dayLabels.length > 0 ? toNumber(summaryRow?.totalAmount) / dayLabels.length : 0,
      highestCollectionDay: highestBucketLabel,
    },
    chartSeries:
      branchSeries.length > 1
        ? branchSeries
        : [{ key: "collections", label: "Collections", color: "#16a34a" }],
    trendRows: normalizedTrendRows,
    rawColumns,
    rawRows: dayLabels.map((dayLabel) => {
      const values = trendLookup.get(dayLabel.key) ?? {};

      return {
        bucket: dayLabel.key,
        ...Object.fromEntries(branchSeries.map((series) => [series.key, values[series.key] ?? 0])),
        totalAmount: branchSeries.reduce((sum, series) => sum + (values[series.key] ?? 0), 0),
      };
    }),
    branchRows: branchBreakdownRows
      .map((row) => ({
        branchName: branchNameMap.get(row.branchId) ?? `Branch ${row.branchId}`,
        totalAmount: toNumber(row.totalAmount),
        totalEntries: toNumber(row.totalEntries),
        averageAmount: toNumber(row.averageAmount),
      }))
      .sort((left, right) => left.branchName.localeCompare(right.branchName)),
  };
}

async function loadActiveLoansSummaryData(branchRows: Array<{ branchId: number; branchName: string }>) {
  const branchIds = branchRows.map((row) => row.branchId);
  const liveLoanMetrics = await loadLiveLoanBranchMetrics(branchIds);

  const [collectorRows, borrowerRows] = await Promise.all([
    db
    .select({
      userId: users.user_id,
      username: users.username,
      firstName: employee_info.first_name,
      middleName: employee_info.middle_name,
      lastName: employee_info.last_name,
      liveLoanCount: sql<number>`count(*)`,
      overdueLoanCount: sql<number>`sum(case when ${loan_records.status} = 'Overdue' then 1 else 0 end)`,
      principalExposure: sql<number>`coalesce(sum(${loan_records.principal}), 0)`,
      totalPayableActive: sql<number>`coalesce(sum(${loan_records.principal} + (${loan_records.principal} * ${loan_records.interest} / 100)), 0)`,
      paidAgainstActive: sql<number>`coalesce(sum((
        select coalesce(sum(c.amount), 0)
        from collections c
        where c.loan_id = ${loan_records.loan_id}
      )), 0)`,
    })
    .from(loan_records)
    .leftJoin(users, eq(users.user_id, loan_records.collector_id))
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .where(
      and(
        inArray(loan_records.branch_id, branchIds),
        inArray(loan_records.status, [...ACTIVE_LOAN_STATUSES]),
      ),
    )
    .groupBy(
      users.user_id,
      users.username,
      employee_info.first_name,
      employee_info.middle_name,
      employee_info.last_name,
    )
    .orderBy(desc(sql<number>`count(*)`), asc(users.username))
    .catch(() => []),
    db
      .select({
        branchId: loan_records.branch_id,
        borrowerCount: sql<number>`count(distinct ${loan_records.borrower_id})`,
      })
      .from(loan_records)
      .where(
        and(
          inArray(loan_records.branch_id, branchIds),
          inArray(loan_records.status, [...ACTIVE_LOAN_STATUSES]),
        ),
      )
      .groupBy(loan_records.branch_id)
      .catch(() => []),
  ]);

  const borrowerMap = new Map(
    borrowerRows.map((row) => [row.branchId, toNumber(row.borrowerCount)]),
  );

  const branchSummaryRows = branchRows.map((row) => {
    const loanMetrics = liveLoanMetrics.get(row.branchId) ?? {
      activeLoans: 0,
      overdueLoans: 0,
      principalExposure: 0,
      totalPayableActive: 0,
      outstandingBalance: 0,
    };
    const liveLoanCount = loanMetrics.activeLoans + loanMetrics.overdueLoans;

    return {
      branchName: row.branchName,
      borrowerCount: borrowerMap.get(row.branchId) ?? 0,
      activeLoans: loanMetrics.activeLoans,
      overdueLoans: loanMetrics.overdueLoans,
      principalExposure: loanMetrics.principalExposure,
      outstandingBalance: loanMetrics.outstandingBalance,
      averageOutstandingPerLoan: liveLoanCount > 0 ? loanMetrics.outstandingBalance / liveLoanCount : 0,
    };
  });

  const summary = branchSummaryRows.reduce(
    (totals, row) => ({
      activeLoanCount: totals.activeLoanCount + row.activeLoans,
      overdueLoanCount: totals.overdueLoanCount + row.overdueLoans,
      outstandingBalance: totals.outstandingBalance + row.outstandingBalance,
      borrowerCount: totals.borrowerCount + row.borrowerCount,
    }),
    {
      activeLoanCount: 0,
      overdueLoanCount: 0,
      outstandingBalance: 0,
      borrowerCount: 0,
    },
  );
  const liveLoanCount = summary.activeLoanCount + summary.overdueLoanCount;

  return {
    summary: {
      ...summary,
      averageOutstandingPerLoan: liveLoanCount > 0 ? summary.outstandingBalance / liveLoanCount : 0,
    },
    chartRows: branchSummaryRows.map((row) => ({
      bucket: row.branchName,
      values: {
        activeLoans: row.activeLoans,
      },
    })),
    branchRows: branchSummaryRows,
    collectorRows: collectorRows.map((row) => ({
      collectorName:
        [row.firstName, row.middleName, row.lastName].filter(Boolean).join(" ").trim() ||
        row.username ||
        "Unassigned",
      liveLoanCount: toNumber(row.liveLoanCount),
      overdueLoanCount: toNumber(row.overdueLoanCount),
      principalExposure: toNumber(row.principalExposure),
      outstandingBalance: Math.max(
        toNumber(row.totalPayableActive) - toNumber(row.paidAgainstActive),
        0,
      ),
    })),
  };
}

async function loadBranchPerformanceComparisonData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string,
  dateTo: string,
) {
  const branchIds = branchRows.map((row) => row.branchId);

  const [
    borrowerCountRows,
    loanCountRows,
    collectionRows,
    expenseRows,
    incentiveRows,
  ] = await Promise.all([
    db
      .select({
        branchId: areas.branch_id,
        borrowerCount: sql<number>`count(distinct ${borrower_info.user_id})`,
      })
      .from(borrower_info)
      .innerJoin(users, eq(users.user_id, borrower_info.user_id))
      .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
      .where(and(inArray(areas.branch_id, branchIds), eq(users.status, "active")))
      .groupBy(areas.branch_id)
      .catch(() => []),
    db
      .select({
        branchId: loan_records.branch_id,
        activeLoanCount: sql<number>`sum(case when ${loan_records.status} = 'Active' then 1 else 0 end)`,
        overdueLoanCount: sql<number>`sum(case when ${loan_records.status} = 'Overdue' then 1 else 0 end)`,
        completedLoanCount: sql<number>`sum(case when ${loan_records.status} in ('Completed', 'Archived') then 1 else 0 end)`,
      })
      .from(loan_records)
      .where(inArray(loan_records.branch_id, branchIds))
      .groupBy(loan_records.branch_id)
      .catch(() => []),
    db
      .select({
        branchId: loan_records.branch_id,
        collectionsThisMonth: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        and(
          inArray(loan_records.branch_id, branchIds),
          gte(collections.collection_date, dateFrom),
          lte(collections.collection_date, dateTo),
        ),
      )
      .groupBy(loan_records.branch_id)
      .catch(() => []),
    db
      .select({
        branchId: expenses.branch_id,
        expensesAmount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(
        and(
          inArray(expenses.branch_id, branchIds),
          gte(expenses.expense_date, dateFrom),
          lte(expenses.expense_date, dateTo),
        ),
      )
      .groupBy(expenses.branch_id)
      .catch(() => []),
    db
      .select({
        branchId: incentive_payout_batches.branch_id,
        incentivesAmount: sql<number>`coalesce(sum(${incentive_payout_history.computed_incentive}), 0)`,
      })
      .from(incentive_payout_history)
      .innerJoin(
        incentive_payout_batches,
        eq(incentive_payout_batches.batch_id, incentive_payout_history.batch_id),
      )
      .where(
        and(
          inArray(incentive_payout_batches.branch_id, branchIds),
          gte(incentive_payout_batches.period_end, dateFrom),
          lte(incentive_payout_batches.period_end, dateTo),
        ),
      )
      .groupBy(incentive_payout_batches.branch_id)
      .catch(() => []),
  ]);

  const borrowerMap = new Map(borrowerCountRows.map((row) => [row.branchId, toNumber(row.borrowerCount)]));
  const loanMap = new Map(
    loanCountRows.map((row) => [
      row.branchId,
      {
        activeLoanCount: toNumber(row.activeLoanCount),
        overdueLoanCount: toNumber(row.overdueLoanCount),
        completedLoanCount: toNumber(row.completedLoanCount),
      },
    ]),
  );
  const collectionMap = new Map(collectionRows.map((row) => [row.branchId, toNumber(row.collectionsThisMonth)]));
  const expenseMap = new Map(expenseRows.map((row) => [row.branchId, toNumber(row.expensesAmount)]));
  const incentiveMap = new Map(incentiveRows.map((row) => [row.branchId, toNumber(row.incentivesAmount)]));

  const comparisonRows = branchRows.map((row) => {
    const collectionsAmount = collectionMap.get(row.branchId) ?? 0;
    const expensesAmount = expenseMap.get(row.branchId) ?? 0;
    const incentivesAmount = incentiveMap.get(row.branchId) ?? 0;

    return {
      branchName: row.branchName,
      borrowerCount: borrowerMap.get(row.branchId) ?? 0,
      collectionsAmount,
      expensesAmount,
      incentivesAmount,
      netAmount: collectionsAmount - expensesAmount - incentivesAmount,
      activeLoanCount: loanMap.get(row.branchId)?.activeLoanCount ?? 0,
      overdueLoanCount: loanMap.get(row.branchId)?.overdueLoanCount ?? 0,
      completedLoanCount: loanMap.get(row.branchId)?.completedLoanCount ?? 0,
    };
  });

  return {
    summary: {
      branchesCompared: comparisonRows.length,
      totalBorrowers: comparisonRows.reduce((sum, row) => sum + row.borrowerCount, 0),
      totalCollections: comparisonRows.reduce((sum, row) => sum + row.collectionsAmount, 0),
      totalExpenses: comparisonRows.reduce((sum, row) => sum + row.expensesAmount, 0),
      totalIncentives: comparisonRows.reduce((sum, row) => sum + row.incentivesAmount, 0),
      totalNet: comparisonRows.reduce((sum, row) => sum + row.netAmount, 0),
      totalActiveLoans: comparisonRows.reduce((sum, row) => sum + row.activeLoanCount, 0),
      totalOverdueLoans: comparisonRows.reduce((sum, row) => sum + row.overdueLoanCount, 0),
      totalCompletedLoans: comparisonRows.reduce((sum, row) => sum + row.completedLoanCount, 0),
    },
    branchRows: comparisonRows,
  };
}

function buildDefaultTitle(
  templateKey: AnalyticsReportTemplateKey,
  scopeLabel: string,
  dateLabel: string | null,
) {
  const template = getAnalyticsTemplateDefinition(templateKey);
  const baseLabel = template?.label ?? "Analytics Report";

  if (dateLabel) {
    return `${baseLabel} - ${dateLabel} - ${scopeLabel}`;
  }

  return `${baseLabel} - ${scopeLabel}`;
}

export async function loadReportsPageData(access: ReportsReadyAccessState): Promise<ReportsPageData> {
  const branchOptions = await loadVisibleBranchOptions(access);

  return {
    branchOptions,
    analyticsTemplates: buildAnalyticsTemplateOptions(branchOptions.length, access.canAccessAnalytics),
  };
}

export async function loadReportsLibraryPageData(
  access: ReportsReadyAccessState,
  filters: ReportsLibraryFilterState,
): Promise<ReportsLibraryPageData> {
  const [rows, visibleBranchOptions] = await Promise.all([
      db
        .select({
          reportId: reports.report_id,
          title: reports.title,
          reportCategory: reports.report_category,
          templateKey: reports.template_key,
          generatedType: reports.generated_type,
          generatedAt: reports.generated_at,
          status: reports.status,
          generatedByUserId: reports.generated_by,
          generatedByName: sql<string>`coalesce(nullif(trim(concat_ws(' ', ${employee_info.first_name}, ${employee_info.middle_name}, ${employee_info.last_name})), ''), ${users.username})`,
          generatedByFirstName: employee_info.first_name,
          generatedByMiddleName: employee_info.middle_name,
          generatedByLastName: employee_info.last_name,
          generatedByUsername: users.username,
          generatedByCompanyId: users.company_id,
          generatedByRoleName: roles.role_name,
          branchScope: reports.branch_scope,
          dateFrom: reports.date_from,
          dateTo: reports.date_to,
          sourceEntityType: reports.source_entity_type,
          sourceEntityId: reports.source_entity_id,
        })
        .from(reports)
        .innerJoin(users, eq(users.user_id, reports.generated_by))
        .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
        .leftJoin(roles, eq(roles.role_id, users.role_id))
        .where(buildReportsLibraryScopeWhere(access))
        .orderBy(desc(reports.generated_at), desc(reports.report_id))
        .catch(() => []),
      loadVisibleLibraryBranchOptions(access),
    ]);

  const visibleRows = rows.map((row) =>
    buildReportsLibraryRow({
      reportId: row.reportId,
      title: row.title,
      reportCategory: row.reportCategory,
      templateKey: row.templateKey,
      generatedType: row.generatedType,
      generatedAt: row.generatedAt,
      status: row.status,
      generatedByUserId: row.generatedByUserId,
      generatedByName: row.generatedByName,
      generatedByRoleName: row.generatedByRoleName,
      branchScope: row.branchScope,
      dateFrom: row.dateFrom,
      dateTo: row.dateTo,
      sourceEntityType: row.sourceEntityType,
      sourceEntityId: row.sourceEntityId,
    }),
  );
  const generatedByRoles = Array.from(
    new Map(
      rows
        .filter((row) => Boolean(row.generatedByRoleName))
        .map((row) => [
          row.generatedByRoleName as string,
          {
            roleName: row.generatedByRoleName as string,
          },
        ] as const)
        .sort((left, right) => left[1].roleName.localeCompare(right[1].roleName)),
    ).values(),
  );
  const generatedByUsers = Array.from(
    new Map(
      rows
        .map((row) => [
          row.generatedByUserId,
          {
            userId: row.generatedByUserId,
            displayName: buildReportUserOptionLabel({
              firstName: row.generatedByFirstName,
              middleName: row.generatedByMiddleName,
              lastName: row.generatedByLastName,
              companyId: row.generatedByCompanyId,
              username: row.generatedByUsername,
            }),
            roleName: row.generatedByRoleName,
          },
        ] as const)
        .sort((left, right) => left[1].displayName.localeCompare(right[1].displayName)),
    ).values(),
  );
  const templates = Array.from(
    new Map(
      visibleRows
        .map((row) => [
          row.templateKey,
          {
            templateKey: row.templateKey,
            label: row.templateLabel,
          },
        ] as const)
        .sort((left, right) => left[1].label.localeCompare(right[1].label)),
    ).values(),
  );

  const advancedFilteredRows = visibleRows.filter((row) => {
    if (filters.templateKey && row.templateKey !== filters.templateKey) {
      return false;
    }

      if (filters.generatedType !== "all" && row.generatedType !== filters.generatedType) {
        return false;
      }

      if (filters.generatedByRoleName && row.generatedByRoleName !== filters.generatedByRoleName) {
        return false;
      }

      if (filters.generatedByUserId && row.generatedByUserId !== filters.generatedByUserId) {
        return false;
      }

    if (
      filters.branchIds.length > 0 &&
      !filters.branchIds.some((branchId) => row.branchScope.includes(branchId))
    ) {
      return false;
    }

    if (filters.generatedDateFrom && row.generatedAt.slice(0, 10) < filters.generatedDateFrom) {
      return false;
    }

    if (filters.generatedDateTo && row.generatedAt.slice(0, 10) > filters.generatedDateTo) {
      return false;
    }

    if (filters.coverageDateFrom && (!row.dateTo || row.dateTo < filters.coverageDateFrom)) {
      return false;
    }

    if (filters.coverageDateTo && (!row.dateFrom || row.dateFrom > filters.coverageDateTo)) {
      return false;
    }

    return true;
  });

  const categoryScopedRows = advancedFilteredRows.filter((row) =>
    filters.category === "all"
      ? true
      : filters.category === "documents"
        ? row.reportCategory === "document"
        : row.reportCategory === "analytics",
  );

  const filteredRows = categoryScopedRows.filter((row) => row.status === filters.status);

  return {
    filters,
    rows: filteredRows,
    counts: {
      all: advancedFilteredRows.length,
      analytics: advancedFilteredRows.filter((row) => row.reportCategory === "analytics").length,
      documents: advancedFilteredRows.filter((row) => row.reportCategory === "document").length,
      active: categoryScopedRows.filter((row) => row.status === "active").length,
      archived: categoryScopedRows.filter((row) => row.status === "archived").length,
    },
    filterOptions: {
      templates,
      generatedByRoles,
      generatedByUsers,
      branches: visibleBranchOptions,
    },
  };
}

type LoadReportViewerResult =
  | {
      ok: true;
      data: ReportsViewerPageData;
    }
  | {
      ok: false;
      code: "not_found" | "ineligible";
      message: string;
    };

export async function loadReportViewerData(
  access: ReportsReadyAccessState,
  reportId: number,
): Promise<LoadReportViewerResult> {
  const scopeWhere = buildReportsLibraryScopeWhere(access);
  const reportRow = await db
    .select({
      reportId: reports.report_id,
      title: reports.title,
      reportCategory: reports.report_category,
      templateKey: reports.template_key,
      generatedType: reports.generated_type,
      generatedAt: reports.generated_at,
      status: reports.status,
      generatedByName: sql<string>`coalesce(nullif(trim(concat_ws(' ', ${employee_info.first_name}, ${employee_info.middle_name}, ${employee_info.last_name})), ''), ${users.username})`,
      generatedByRoleName: roles.role_name,
      branchScope: reports.branch_scope,
      dateFrom: reports.date_from,
      dateTo: reports.date_to,
      sourceEntityType: reports.source_entity_type,
      sourceEntityId: reports.source_entity_id,
      snapshot: reports.snapshot,
    })
    .from(reports)
    .innerJoin(users, eq(users.user_id, reports.generated_by))
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .leftJoin(roles, eq(roles.role_id, users.role_id))
    .where(scopeWhere ? and(eq(reports.report_id, reportId), scopeWhere) : eq(reports.report_id, reportId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!reportRow) {
    return {
      ok: false,
      code: "not_found",
      message: "This saved report is not available in your current reporting scope.",
    };
  }

  if (
    reportRow.templateKey === "loan_receipt_summary" &&
    reportRow.sourceEntityType === "loan" &&
    reportRow.sourceEntityId !== null
  ) {
    const loanSource = await loadLoanDocumentSource(access, reportRow.sourceEntityId);
    if (!loanSource || !isLoanReceiptSummaryEligible(loanSource.status, loanSource.outstandingBalance)) {
      return {
        ok: false,
        code: "ineligible",
        message:
          "Loan receipt summaries are only viewable for loans that are completed or archived with zero remaining balance.",
      };
    }
  }

  const branchScopeNames =
    reportRow.branchScope.length > 0
      ? await db
          .select({
            branchId: branch.branch_id,
            branchName: branch.branch_name,
          })
          .from(branch)
          .where(inArray(branch.branch_id, reportRow.branchScope))
          .orderBy(asc(branch.branch_name))
          .then((rows) => rows.map((row) => row.branchName))
          .catch(() => [])
      : [];

  return {
    ok: true,
    data: {
      reportId: reportRow.reportId,
      title: reportRow.title,
      reportCategory: reportRow.reportCategory,
      templateKey: reportRow.templateKey,
      templateLabel: resolveReportTemplateLabel(reportRow.templateKey),
      generatedType: reportRow.generatedType,
      generatedAt: reportRow.generatedAt,
      generatedByName: reportRow.generatedByName,
      generatedByRoleName: reportRow.generatedByRoleName,
      status: reportRow.status,
      branchScopeIds: reportRow.branchScope,
      branchScopeNames,
      dateFrom: reportRow.dateFrom,
      dateTo: reportRow.dateTo,
      sourceEntityType: reportRow.sourceEntityType,
      sourceEntityId: reportRow.sourceEntityId,
      snapshot: reportRow.snapshot as SavedReportSnapshot,
    },
  };
}

export async function generateAnalyticsReport(
  access: ReportsReadyAccessState,
  input: GenerateAnalyticsReportInput,
) {
  if (!access.canAccessAnalytics) {
    return {
      ok: false as const,
      message: "Analytical report generation is not available for your current role.",
    };
  }

  const template = getAnalyticsTemplateDefinition(input.templateKey);
  if (!template) {
    return {
      ok: false as const,
      message: "Select a valid analytics template.",
    };
  }

  const normalizedBranchIds = sortBranchIds(
    access.fixedBranchId !== null ? [access.fixedBranchId] : input.branchIds,
  );

  if (normalizedBranchIds.length === 0) {
    return {
      ok: false as const,
      message: "Select at least one branch before generating a report.",
    };
  }

  if (normalizedBranchIds.some((branchId) => !access.allowedBranchIds.includes(branchId))) {
    return {
      ok: false as const,
      message: "One or more selected branches are outside your reporting scope.",
    };
  }

  if (normalizedBranchIds.length < template.minBranchCount) {
    return {
      ok: false as const,
      message:
        template.minBranchCount > 1
          ? "Branch Performance Comparison requires at least two selected branches."
          : "Select a valid branch scope for this report.",
    };
  }

  const selectedBranchRows = await loadSelectedBranchRows(normalizedBranchIds);
  if (selectedBranchRows.length !== normalizedBranchIds.length) {
    return {
      ok: false as const,
      message: "Unable to resolve the selected branch scope.",
    };
  }

  const scopeLabel = buildScopeLabel(selectedBranchRows.map((row) => row.branchName));
  let dateFrom: string | null = null;
  let dateTo: string | null = null;
  let generatedLabel: string;
  let dateLabel: string | null = null;

  if (template.dateMode === "range") {
    if (!input.dateFrom || !input.dateTo) {
      return {
        ok: false as const,
        message: "Select a valid date range for this report.",
      };
    }

    if (input.dateTo < input.dateFrom) {
      return {
        ok: false as const,
        message: "End date cannot be earlier than start date.",
      };
    }

    dateFrom = input.dateFrom;
    dateTo = input.dateTo;
    dateLabel = buildDateRangeLabel(dateFrom, dateTo);
    generatedLabel = `Reporting window: ${dateLabel}`;
  } else if (template.dateMode === "month") {
    if (!input.month) {
      return {
        ok: false as const,
        message: "Select a valid month for this report.",
      };
    }

    const monthWindow = resolveMonthWindow(input.month);
    if (!monthWindow) {
      return {
        ok: false as const,
        message: "Selected month is invalid.",
      };
    }

    dateFrom = monthWindow.start;
    dateTo = monthWindow.end;
    dateLabel = monthWindow.label;
    generatedLabel = `Reporting month: ${monthWindow.label}`;
  } else {
    generatedLabel = "Snapshot generated from the current live-loan state.";
  }

  const resolvedTitle = input.title.trim() || buildDefaultTitle(template.key, scopeLabel, dateLabel);

  let snapshot: unknown;

  if (template.key === "financial_overview") {
    const reportData = await loadFinancialOverviewData(selectedBranchRows, dateFrom!, dateTo!);
    snapshot = buildFinancialOverviewSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      periodRows: reportData.periodRows,
      branchRows: reportData.branchRows,
    });
  } else if (template.key === "monthly_collections_summary") {
    const reportData = await loadMonthlyCollectionsSummaryData(selectedBranchRows, dateFrom!, dateTo!);
    snapshot = buildMonthlyCollectionsSummarySnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      chartSeries: reportData.chartSeries,
      trendRows: reportData.trendRows,
      rawColumns: reportData.rawColumns,
      rawRows: reportData.rawRows,
      branchRows: reportData.branchRows,
    });
  } else if (template.key === "active_loans_summary") {
    const reportData = await loadActiveLoansSummaryData(selectedBranchRows);
    snapshot = buildActiveLoansSummarySnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      chartRows: reportData.chartRows,
      branchRows: reportData.branchRows,
      collectorRows: reportData.collectorRows,
    });
  } else {
    const reportData = await loadBranchPerformanceComparisonData(selectedBranchRows, dateFrom!, dateTo!);
    snapshot = buildBranchPerformanceComparisonSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      branchRows: reportData.branchRows,
    });
  }

  const insertedReport = await db
    .insert(reports)
    .values({
      title: resolvedTitle,
      report_category: "analytics",
      template_key: template.key,
      generated_type: "user",
      generated_by: access.userId,
      filters: {
        branchIds: normalizedBranchIds,
        month: input.month,
        dateFrom,
        dateTo,
      },
      branch_scope: normalizedBranchIds,
      date_from: dateFrom,
      date_to: dateTo,
      snapshot,
      status: "active",
    })
    .returning({
      reportId: reports.report_id,
      title: reports.title,
      generatedAt: reports.generated_at,
    })
    .catch(() => []);

  const reportRow = insertedReport[0];
  if (!reportRow) {
    return {
      ok: false as const,
      message: "Unable to save the generated report right now.",
    };
  }

  return {
    ok: true as const,
    reportId: reportRow.reportId,
    title: reportRow.title,
    generatedAt: reportRow.generatedAt,
    templateLabel: template.label,
    templateKey: template.key,
    branchCount: normalizedBranchIds.length,
    dateFrom,
    dateTo,
  };
}

async function loadUserDisplayRows(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return [];
  }

  return db
    .select({
      userId: users.user_id,
      username: users.username,
      firstName: employee_info.first_name,
      middleName: employee_info.middle_name,
      lastName: employee_info.last_name,
    })
    .from(users)
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .where(inArray(users.user_id, uniqueIds))
    .catch(() => []);
}

function buildLoanScheduleRows(params: {
  startDate: string;
  dueDate: string;
  totalPayable: number;
  estimatedDailyPayment: number | null;
  collectionRows: Array<{
    collectionDate: string;
    amount: number;
    note: string;
    collectorName: string;
    outstandingBalance: number;
  }>;
}) {
  const rowsByDate = new Map<
    string,
    {
      amount: number;
      notes: string[];
      collectors: string[];
      outstandingBalance: number;
    }
  >();

  for (const row of params.collectionRows) {
    const existing = rowsByDate.get(row.collectionDate) ?? {
      amount: 0,
      notes: [],
      collectors: [],
      outstandingBalance: params.totalPayable,
    };
    existing.amount += row.amount;
    if (row.note.trim()) {
      existing.notes.push(row.note.trim());
    }
    if (row.collectorName.trim()) {
      existing.collectors.push(row.collectorName.trim());
    }
    existing.outstandingBalance = row.outstandingBalance;
    rowsByDate.set(row.collectionDate, existing);
  }

  let lastOutstandingBalance = params.totalPayable;

  return enumerateIsoDates(params.startDate, params.dueDate).map((date) => {
    const current = rowsByDate.get(date);
    if (current) {
      lastOutstandingBalance = current.outstandingBalance;
    }

      return {
        date,
        principalPlusInterest: params.totalPayable,
        dailyPayment: params.estimatedDailyPayment ?? 0,
        outstandingBalance: lastOutstandingBalance,
        amount: current ? current.amount : "-",
        collector: current?.collectors.length
          ? Array.from(new Set(current.collectors)).join(", ")
          : "-",
        note: current?.notes.length
        ? Array.from(new Set(current.notes)).join("; ")
        : "-",
    };
  });
}

async function loadLoanDocumentSource(access: ReportsReadyAccessState, loanId: number) {
  const loan = await db
    .select({
      loanId: loan_records.loan_id,
      loanCode: loan_records.loan_code,
      borrowerId: loan_records.borrower_id,
      principal: loan_records.principal,
      interest: loan_records.interest,
      collectorId: loan_records.collector_id,
      startDate: loan_records.start_date,
      dueDate: loan_records.due_date,
      termDays: loan_records.term_days,
      branchId: loan_records.branch_id,
      status: loan_records.status,
    })
    .from(loan_records)
    .where(eq(loan_records.loan_id, loanId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!loan) {
    return null;
  }

  if (!access.canAccessOperationalDocuments || !access.allowedBranchIds.includes(loan.branchId)) {
    return null;
  }

  const [branchRow, borrowerRow, collectorRow, collectionRows] = await Promise.all([
    db
      .select({
        branchName: branch.branch_name,
        branchAddress: branch.branch_address,
      })
      .from(branch)
      .where(eq(branch.branch_id, loan.branchId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
    db
      .select({
        borrowerId: borrower_info.user_id,
        firstName: borrower_info.first_name,
        middleName: borrower_info.middle_name,
        lastName: borrower_info.last_name,
        address: borrower_info.address,
        areaCode: areas.area_code,
        companyId: users.company_id,
        username: users.username,
      })
      .from(borrower_info)
      .innerJoin(users, eq(users.user_id, borrower_info.user_id))
      .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
      .where(eq(borrower_info.user_id, loan.borrowerId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
    loan.collectorId
      ? db
          .select({
            username: users.username,
            firstName: employee_info.first_name,
            middleName: employee_info.middle_name,
            lastName: employee_info.last_name,
          })
          .from(users)
          .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
          .where(eq(users.user_id, loan.collectorId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
          .catch(() => null)
      : Promise.resolve(null),
    db
      .select({
        collectionId: collections.collection_id,
        collectionCode: collections.collection_code,
        collectionDate: collections.collection_date,
        amount: collections.amount,
        note: collections.note,
        collectorId: collections.collector_id,
      })
      .from(collections)
      .where(eq(collections.loan_id, loan.loanId))
      .orderBy(asc(collections.collection_date), asc(collections.collection_id))
      .catch(() => []),
  ]);

  if (!branchRow || !borrowerRow) {
    return null;
  }

  const collectionUserRows = await loadUserDisplayRows(
    collectionRows
      .map((row) => row.collectorId)
      .filter((value): value is string => Boolean(value)),
  );
  const userDisplayMap = new Map(
    collectionUserRows.map((row) => [
      row.userId,
      buildUserDisplayName({
        firstName: row.firstName,
        middleName: row.middleName,
        lastName: row.lastName,
        username: row.username,
      }),
    ]),
  );

  const borrowerName =
    [borrowerRow.firstName, borrowerRow.middleName, borrowerRow.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    borrowerRow.username ||
    loan.borrowerId;
  const collectorName = collectorRow
    ? buildUserDisplayName({
        firstName: collectorRow.firstName,
        middleName: collectorRow.middleName,
        lastName: collectorRow.lastName,
        username: collectorRow.username,
      })
    : "Unassigned";

  const principal = toNumber(loan.principal);
  const interestRate = toNumber(loan.interest);
  const totalPayable = principal + (principal * interestRate) / 100;
  const termDays = loan.termDays ?? calculateLoanDurationDays(loan.startDate, loan.dueDate);

  let runningPaid = 0;
  const normalizedCollectionRows = collectionRows.map((row) => {
    const amount = toNumber(row.amount);
    runningPaid += amount;

    return {
      collectionId: row.collectionId,
      collectionCode: row.collectionCode,
      collectionDate: row.collectionDate,
      amount,
      note: row.note ?? "",
      collectorName:
        (row.collectorId ? userDisplayMap.get(row.collectorId) : null) ?? collectorName,
      outstandingBalance: Math.max(totalPayable - runningPaid, 0),
    };
  });

  const totalPaid = normalizedCollectionRows.reduce((sum, row) => sum + row.amount, 0);
  const outstandingBalance =
    normalizedCollectionRows.length > 0
      ? normalizedCollectionRows[normalizedCollectionRows.length - 1].outstandingBalance
      : totalPayable;
  const scheduleRows = buildLoanScheduleRows({
    startDate: loan.startDate,
    dueDate: loan.dueDate,
    totalPayable,
    estimatedDailyPayment: termDays ? totalPayable / termDays : null,
    collectionRows: normalizedCollectionRows,
  });

  return {
    loanId: loan.loanId,
    loanCode: loan.loanCode,
    branchId: loan.branchId,
    branchName: branchRow.branchName,
    branchAddress: branchRow.branchAddress,
    borrowerName,
    borrowerCompanyId: borrowerRow.companyId || borrowerRow.username || loan.borrowerId,
    borrowerAddress: borrowerRow.address || "N/A",
    areaCode: borrowerRow.areaCode || "N/A",
    collectorName,
    status: loan.status,
    startDate: loan.startDate,
    dueDate: loan.dueDate,
    termDays,
    principal,
    interestRate,
    totalPayable,
    estimatedDailyPayment: termDays ? totalPayable / termDays : null,
    totalPaid,
    outstandingBalance,
    completionDate:
      normalizedCollectionRows[normalizedCollectionRows.length - 1]?.collectionDate ?? loan.dueDate,
    scheduleRows,
    collectionRows: normalizedCollectionRows,
  };
}

async function loadCollectionDocumentSource(
  access: ReportsReadyAccessState,
  collectionId: number,
) {
  const collectionRow = await db
    .select({
      collectionId: collections.collection_id,
      collectionCode: collections.collection_code,
      collectionDate: collections.collection_date,
      amount: collections.amount,
      note: collections.note,
      collectorId: collections.collector_id,
      encodedBy: collections.encoded_by,
      loanId: loan_records.loan_id,
      loanCode: loan_records.loan_code,
      branchId: loan_records.branch_id,
      borrowerId: loan_records.borrower_id,
      principal: loan_records.principal,
      interest: loan_records.interest,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(eq(collections.collection_id, collectionId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!collectionRow) {
    return null;
  }

  if (!access.canAccessOperationalDocuments || !access.allowedBranchIds.includes(collectionRow.branchId)) {
    return null;
  }

  const [branchRow, borrowerRow, userRows] = await Promise.all([
    db
      .select({
        branchName: branch.branch_name,
        branchAddress: branch.branch_address,
      })
      .from(branch)
      .where(eq(branch.branch_id, collectionRow.branchId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
    db
      .select({
        firstName: borrower_info.first_name,
        middleName: borrower_info.middle_name,
        lastName: borrower_info.last_name,
        companyId: users.company_id,
        username: users.username,
      })
      .from(borrower_info)
      .innerJoin(users, eq(users.user_id, borrower_info.user_id))
      .where(eq(borrower_info.user_id, collectionRow.borrowerId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
    loadUserDisplayRows(
      [collectionRow.collectorId, collectionRow.encodedBy].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ]);

  if (!branchRow || !borrowerRow) {
    return null;
  }

  const userDisplayMap = new Map(
    userRows.map((row) => [
      row.userId,
      buildUserDisplayName({
        firstName: row.firstName,
        middleName: row.middleName,
        lastName: row.lastName,
        username: row.username,
      }),
    ]),
  );

  const loanCollections = await db
    .select({
      collectionId: collections.collection_id,
      collectionDate: collections.collection_date,
      amount: collections.amount,
    })
    .from(collections)
    .where(eq(collections.loan_id, collectionRow.loanId))
    .orderBy(asc(collections.collection_date), asc(collections.collection_id))
    .catch(() => []);

  const totalPayable =
    toNumber(collectionRow.principal) +
    (toNumber(collectionRow.principal) * toNumber(collectionRow.interest)) / 100;
  let runningPaid = 0;
  let remainingBalanceAfterPayment = totalPayable;

  for (const row of loanCollections) {
    runningPaid += toNumber(row.amount);
    if (row.collectionId === collectionRow.collectionId) {
      remainingBalanceAfterPayment = Math.max(totalPayable - runningPaid, 0);
      break;
    }
  }

  return {
    collectionId: collectionRow.collectionId,
    collectionCode: collectionRow.collectionCode,
    collectionDate: collectionRow.collectionDate,
    amount: toNumber(collectionRow.amount),
    note: collectionRow.note ?? null,
    loanId: collectionRow.loanId,
    loanCode: collectionRow.loanCode,
    branchId: collectionRow.branchId,
    branchName: branchRow.branchName,
    borrowerName:
      [borrowerRow.firstName, borrowerRow.middleName, borrowerRow.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      borrowerRow.username ||
      collectionRow.borrowerId,
    borrowerCompanyId:
      borrowerRow.companyId || borrowerRow.username || collectionRow.borrowerId,
    collectorName:
      (collectionRow.collectorId
        ? userDisplayMap.get(collectionRow.collectorId)
        : null) ?? "Unassigned",
    encodedByName:
      userDisplayMap.get(collectionRow.encodedBy) ?? collectionRow.encodedBy,
    branchAddress: branchRow.branchAddress,
    remainingBalanceAfterPayment,
  };
}

export async function generateOperationalDocument(
  access: ReportsReadyAccessState,
  input: GenerateOperationalDocumentInput,
) {
  if (!access.canAccessOperationalDocuments) {
    return {
      ok: false as const,
      message: "Operational document generation is not available for your current role.",
    };
  }

  const template = getOperationalDocumentTemplateDefinition(input.templateKey);
  if (!template) {
    return {
      ok: false as const,
      message: "Select a valid document template.",
    };
  }

  let title: string;
  let branchScope: number[];
  let filters: Record<string, number>;
  let sourceEntityType: "loan" | "collection";
  let sourceEntityId: number;
  let snapshot: unknown;

  if (template.sourceEntityType === "loan") {
    const loanSource = await loadLoanDocumentSource(access, input.sourceEntityId);
    if (!loanSource) {
      return {
        ok: false as const,
        message: "You are not allowed to generate this loan document.",
      };
    }

    branchScope = [loanSource.branchId];
    filters = { loanId: loanSource.loanId };
    sourceEntityType = "loan";
    sourceEntityId = loanSource.loanId;

    if (template.key === "borrower_loan_schedule") {
      title = `Borrower Loan Schedule - ${loanSource.loanCode}`;
      snapshot = buildBorrowerLoanScheduleSnapshot({
        title,
        generatedLabel: `Loan schedule snapshot for ${loanSource.loanCode}`,
        scopeLabel: loanSource.branchName,
        borrowerName: loanSource.borrowerName,
        borrowerCompanyId: loanSource.borrowerCompanyId,
        borrowerAddress: loanSource.borrowerAddress,
        branchName: loanSource.branchName,
        branchAddress: loanSource.branchAddress,
        areaCode: loanSource.areaCode,
        collectorName: loanSource.collectorName,
        loanCode: loanSource.loanCode,
        startDate: loanSource.startDate,
        dueDate: loanSource.dueDate,
        termDays: loanSource.termDays,
        status: loanSource.status,
        principal: loanSource.principal,
        interestRate: loanSource.interestRate,
        totalPayable: loanSource.totalPayable,
        estimatedDailyPayment: loanSource.estimatedDailyPayment,
        totalPaid: loanSource.totalPaid,
        outstandingBalance: loanSource.outstandingBalance,
        scheduleRows: loanSource.scheduleRows,
      });
    } else {
      if (!isLoanReceiptSummaryEligible(loanSource.status, loanSource.outstandingBalance)) {
        return {
          ok: false as const,
          message:
            "Loan receipt summaries are only available for loans that are completed or archived with zero remaining balance.",
        };
      }

      title = `Loan Receipt Summary - ${loanSource.loanCode}`;
      snapshot = buildLoanReceiptSummarySnapshot({
        title,
        generatedLabel: `Loan payment snapshot for ${loanSource.loanCode}`,
        scopeLabel: loanSource.branchName,
        loanCode: loanSource.loanCode,
        borrowerName: loanSource.borrowerName,
        borrowerCompanyId: loanSource.borrowerCompanyId,
        branchName: loanSource.branchName,
        areaCode: loanSource.areaCode,
        collectorName: loanSource.collectorName,
        status: loanSource.status,
        startDate: loanSource.startDate,
        completionDate: loanSource.completionDate,
        principal: loanSource.principal,
        interestRate: loanSource.interestRate,
        totalPayable: loanSource.totalPayable,
        totalPaid: loanSource.totalPaid,
        outstandingBalance: loanSource.outstandingBalance,
        collectionRows: loanSource.collectionRows.map((row) => ({
          collectionCode: row.collectionCode,
          collectionDate: row.collectionDate,
          amount: row.amount,
          collectorName: row.collectorName,
          note: row.note || "-",
          outstandingBalance: row.outstandingBalance,
        })),
      });
    }
  } else {
    const collectionSource = await loadCollectionDocumentSource(access, input.sourceEntityId);
    if (!collectionSource) {
      return {
        ok: false as const,
        message: "You are not allowed to generate this collection receipt.",
      };
    }

    title = `Collection Receipt - ${collectionSource.collectionCode}`;
    branchScope = [collectionSource.branchId];
    filters = {
      collectionId: collectionSource.collectionId,
      loanId: collectionSource.loanId,
    };
    sourceEntityType = "collection";
    sourceEntityId = collectionSource.collectionId;
    snapshot = buildCollectionReceiptSnapshot({
      title,
      generatedLabel: `Collection receipt for ${collectionSource.collectionCode}`,
      scopeLabel: collectionSource.branchName,
      collectionCode: collectionSource.collectionCode,
      collectionDate: collectionSource.collectionDate,
      amount: collectionSource.amount,
      note: collectionSource.note,
      loanCode: collectionSource.loanCode,
      borrowerName: collectionSource.borrowerName,
      borrowerCompanyId: collectionSource.borrowerCompanyId,
      branchName: collectionSource.branchName,
      collectorName: collectionSource.collectorName,
      encodedByName: collectionSource.encodedByName,
      branchAddress: collectionSource.branchAddress,
      remainingBalanceAfterPayment: collectionSource.remainingBalanceAfterPayment,
    });
  }

  const insertedReport = await db
    .insert(reports)
    .values({
      title,
      report_category: "document",
      template_key: template.key,
      generated_type: "user",
      generated_by: access.userId,
      filters,
      branch_scope: branchScope,
      source_entity_type: sourceEntityType,
      source_entity_id: sourceEntityId,
      snapshot,
      status: "active",
    })
    .returning({
      reportId: reports.report_id,
      title: reports.title,
      generatedAt: reports.generated_at,
    })
    .catch(() => []);

  const reportRow = insertedReport[0];
  if (!reportRow) {
    return {
      ok: false as const,
      message: "Unable to save the generated document right now.",
    };
  }

  return {
    ok: true as const,
    reportId: reportRow.reportId,
    title: reportRow.title,
    generatedAt: reportRow.generatedAt,
    templateLabel: template.label,
    templateKey: template.key,
    sourceEntityType,
    sourceEntityId,
  };
}
