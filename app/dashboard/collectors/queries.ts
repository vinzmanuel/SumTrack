import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lte,
  gte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  collections,
  employee_area_assignment,
  employee_info,
  loan_records,
  roles,
  users,
  branch,
} from "@/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { resolveCollectorsDateRange } from "@/app/dashboard/collectors/filters";
import {
  buildCollectorsFiltersForProfilePeriod,
  resolveCollectorProfilePeriodLabel,
} from "@/app/dashboard/collectors/profile-filters";
import type {
  CollectorProfilePeriodKey,
  CollectorAssignedLoansData,
  CollectorAssignedLoansFilters,
  CollectorsExecutionItem,
  CollectorPerformanceRow,
  CollectorProfileData,
  CollectorsAccessState,
  CollectorsAnalyticsData,
  CollectorsBranchOption,
  CollectorsComparisonItem,
  CollectorsDateRange,
  CollectorsFilterState,
  CollectorsTopPerformerItem,
} from "@/app/dashboard/collectors/types";
import type { AnalyticsChartModel } from "@/components/analytics/types";
import type { LoanListRow } from "@/app/dashboard/loans/types";

type AnalyticsAccess = Extract<CollectorsAccessState, { view: "analytics" }>;

const COLLECTORS_PAGE_SIZE = 12;
const COLLECTOR_ASSIGNED_LOANS_PAGE_SIZE = 12;
const borrowerUsers = alias(users, "collector_detail_borrower_users");

type BaseCollectorRow = {
  collectorId: string;
  companyId: string;
  username: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  status: "active" | "inactive";
  contactNo: string | null;
  email: string | null;
  dateCreated: string | null;
  branchId: number;
  branchName: string;
  areaId: number;
  areaNo: string;
  areaCode: string;
};

type LoanStatsRow = {
  collectorId: string | null;
  assignedActiveLoans: number;
  activePrincipalLoad: number;
  activeInterestPotential: number;
  portfolioAtRiskAmount: number;
  completedLoans: number;
  totalLoans: number;
  expectedCollections: number;
  firstLoanStart: string | null;
};

type CollectionStatsRow = {
  collectorId: string | null;
  totalCollected: number;
  averageCollectionAmount: number;
  collectionEntries: number;
  missedPaymentCount: number;
  collectionDays: number;
  activeWeeks: number;
};

type PeriodPortfolioStatsRow = {
  collectorId: string | null;
  periodPortfolioPrincipal: number;
  periodInterestPotential: number;
  periodPortfolioAtRiskAmount: number;
  dueLoans: number;
  completedDueLoans: number;
};

type CollectionTrendBucketRow = {
  bucketKey: string;
  totalCollected: number;
};

type CollectorRowMode = "window" | "career";

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

function fullNameOf(row: { firstName: string | null; middleName?: string | null; lastName: string | null; username?: string | null; collectorId?: string }) {
  const middleInitial = row.middleName?.trim() ? `${row.middleName.trim().charAt(0)}.` : "";
  const name = [row.firstName, middleInitial, row.lastName].filter(Boolean).join(" ").trim();
  return name || row.username || row.collectorId || "Unknown Collector";
}

function toCollectorLoanListRow(row: {
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

function buildCollectorBaseFilters(
  access: AnalyticsAccess,
  filters: CollectorsFilterState,
  collectorId?: string,
) {
  const conditions: SQL[] = [eq(roles.role_name, "Collector"), isNull(employee_area_assignment.end_date)];

  if (collectorId) {
    conditions.push(eq(users.user_id, collectorId));
  }

  if (access.selectedBranchId) {
    conditions.push(eq(areas.branch_id, access.selectedBranchId));
  } else if (access.allowedBranchIds.length > 0) {
    conditions.push(inArray(areas.branch_id, access.allowedBranchIds));
  } else {
    conditions.push(eq(areas.area_id, -1));
  }

  if (filters.searchQuery) {
    const pattern = `%${filters.searchQuery}%`;
    conditions.push(
      or(
        ilike(users.company_id, pattern),
        ilike(users.username, pattern),
        ilike(employee_info.first_name, pattern),
        ilike(employee_info.last_name, pattern),
        ilike(sql<string>`concat_ws(' ', ${employee_info.first_name}, ${employee_info.last_name})`, pattern),
      )!,
    );
  }

  return conditions;
}

function buildLoanScopeFilters(access: AnalyticsAccess, collectorIds: string[]) {
  const conditions: SQL[] = [inArray(loan_records.collector_id, collectorIds)];

  if (access.selectedBranchId) {
    conditions.push(eq(loan_records.branch_id, access.selectedBranchId));
  } else if (access.allowedBranchIds.length > 0) {
    conditions.push(inArray(loan_records.branch_id, access.allowedBranchIds));
  } else {
    conditions.push(eq(loan_records.loan_id, -1));
  }

  return conditions;
}

function buildCollectorAssignedLoansFilters(
  access: AnalyticsAccess,
  collectorId: string,
  filters: CollectorAssignedLoansFilters,
) {
  const conditions = buildLoanScopeFilters(access, [collectorId]);

  if (filters.status !== "all") {
    conditions.push(eq(loan_records.status, filters.status));
  }

  if (filters.query) {
    const pattern = `%${filters.query}%`;
    conditions.push(
      or(
        ilike(loan_records.loan_code, pattern),
        ilike(sql<string>`concat_ws(' ', ${borrower_info.first_name}, ${borrower_info.last_name})`, pattern),
        ilike(borrower_info.first_name, pattern),
        ilike(borrower_info.last_name, pattern),
      )!,
    );
  }

  return conditions;
}

function buildCollectionScopeFilters(
  access: AnalyticsAccess,
  collectorIds: string[],
  range: CollectorsDateRange,
) {
  return [
    ...buildLoanScopeFilters(access, collectorIds),
    gte(collections.collection_date, range.start),
    lte(collections.collection_date, range.end),
  ];
}

async function loadCollectorBaseRows(
  access: AnalyticsAccess,
  filters: CollectorsFilterState,
  collectorId?: string,
): Promise<BaseCollectorRow[]> {
  return db
    .select({
      collectorId: users.user_id,
      companyId: users.company_id,
      username: users.username,
      firstName: employee_info.first_name,
      middleName: employee_info.middle_name,
      lastName: employee_info.last_name,
      status: users.status,
      contactNo: users.contact_no,
      email: users.email,
      dateCreated: users.date_created,
      branchId: branch.branch_id,
      branchName: branch.branch_name,
      areaId: areas.area_id,
      areaNo: areas.area_no,
      areaCode: areas.area_code,
    })
    .from(employee_area_assignment)
    .innerJoin(users, eq(users.user_id, employee_area_assignment.employee_user_id))
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .innerJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
    .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
    .where(whereFrom(buildCollectorBaseFilters(access, filters, collectorId)))
    .orderBy(asc(branch.branch_name), asc(employee_info.last_name), asc(employee_info.first_name))
    .catch(() => []);
}

async function loadLoanStats(
  access: AnalyticsAccess,
  collectorIds: string[],
  range: CollectorsDateRange,
): Promise<Map<string, LoanStatsRow>> {
  if (collectorIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
        collectorId: loan_records.collector_id,
        assignedActiveLoans: sql<number>`sum(case when ${loan_records.status} in ('Active', 'Overdue') then 1 else 0 end)`,
        activePrincipalLoad: sql<number>`coalesce(sum(case when ${loan_records.status} in ('Active', 'Overdue') then ${loan_records.principal} else 0 end), 0)`,
        activeInterestPotential: sql<number>`coalesce(sum(case when ${loan_records.status} in ('Active', 'Overdue') then (${loan_records.principal} * ${loan_records.interest}) / 100 else 0 end), 0)`,
        portfolioAtRiskAmount: sql<number>`coalesce(sum(case when ${loan_records.status} = 'Overdue' then ${loan_records.principal} else 0 end), 0)`,
        completedLoans: sql<number>`sum(case when ${loan_records.status} = 'Completed' then 1 else 0 end)`,
        totalLoans: sql<number>`count(*)`,
        firstLoanStart: sql<string | null>`min(${loan_records.start_date})::text`,
        expectedCollections: sql<number>`
          coalesce(
            sum(
              (
                (${loan_records.principal} + ((${loan_records.principal} * ${loan_records.interest}) / 100))
                /
                greatest(
                  coalesce(${loan_records.term_days}, (${loan_records.due_date} - ${loan_records.start_date}) + 1),
                  1
                )
              )
              *
              greatest(
                least(${loan_records.due_date}, ${sql`${range.end}::date`}) - greatest(${loan_records.start_date}, ${sql`${range.start}::date`}) + 1,
                0
              )
            ),
            0
          )
        `,
      })
    .from(loan_records)
    .where(whereFrom(buildLoanScopeFilters(access, collectorIds)))
    .groupBy(loan_records.collector_id)
    .catch(() => []);

  const result = new Map<string, LoanStatsRow>();

  for (const row of rows) {
    if (!row.collectorId) {
      continue;
    }

    result.set(row.collectorId, {
      collectorId: row.collectorId,
      assignedActiveLoans: toNumber(row.assignedActiveLoans),
      activePrincipalLoad: toNumber(row.activePrincipalLoad),
      activeInterestPotential: toNumber(row.activeInterestPotential),
      portfolioAtRiskAmount: toNumber(row.portfolioAtRiskAmount),
      completedLoans: toNumber(row.completedLoans),
      totalLoans: toNumber(row.totalLoans),
      expectedCollections: toNumber(row.expectedCollections),
      firstLoanStart: row.firstLoanStart,
    });
  }

  return result;
}

async function loadCollectionStats(
  access: AnalyticsAccess,
  collectorIds: string[],
  range: CollectorsDateRange,
): Promise<Map<string, CollectionStatsRow>> {
  if (collectorIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      collectorId: loan_records.collector_id,
      totalCollected: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      averageCollectionAmount: sql<number>`coalesce(avg(${collections.amount}), 0)`,
      collectionEntries: sql<number>`count(*)`,
      missedPaymentCount: sql<number>`sum(case when ${collections.amount} = 0 then 1 else 0 end)`,
      collectionDays: sql<number>`count(distinct ${collections.collection_date})`,
      activeWeeks: sql<number>`count(distinct date_trunc('week', ${collections.collection_date}))`,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(whereFrom(buildCollectionScopeFilters(access, collectorIds, range)))
    .groupBy(loan_records.collector_id)
    .catch(() => []);

  const result = new Map<string, CollectionStatsRow>();

  for (const row of rows) {
    if (!row.collectorId) {
      continue;
    }

    result.set(row.collectorId, {
      collectorId: row.collectorId,
      totalCollected: toNumber(row.totalCollected),
      averageCollectionAmount: toNumber(row.averageCollectionAmount),
      collectionEntries: toNumber(row.collectionEntries),
      missedPaymentCount: toNumber(row.missedPaymentCount),
      collectionDays: toNumber(row.collectionDays),
      activeWeeks: toNumber(row.activeWeeks),
    });
  }

  return result;
}

async function loadPeriodPortfolioStats(
  access: AnalyticsAccess,
  collectorId: string,
  range: CollectorsDateRange | null,
): Promise<PeriodPortfolioStatsRow | null> {
  const collectorIds = [collectorId];

  if (range === null) {
    const rows = await db
      .select({
        collectorId: loan_records.collector_id,
        periodPortfolioPrincipal: sql<number>`coalesce(sum(${loan_records.principal}), 0)`,
        periodInterestPotential: sql<number>`coalesce(sum((${loan_records.principal} * ${loan_records.interest}) / 100), 0)`,
        periodPortfolioAtRiskAmount: sql<number>`coalesce(sum(case when ${loan_records.status} = 'Overdue' then ${loan_records.principal} else 0 end), 0)`,
        dueLoans: sql<number>`count(*)`,
        completedDueLoans: sql<number>`sum(case when ${loan_records.status} = 'Completed' then 1 else 0 end)`,
      })
      .from(loan_records)
      .where(whereFrom(buildLoanScopeFilters(access, collectorIds)))
      .groupBy(loan_records.collector_id)
      .catch(() => []);

    const row = rows[0];
    if (!row || !row.collectorId) {
      return null;
    }

    return {
      collectorId: row.collectorId,
      periodPortfolioPrincipal: toNumber(row.periodPortfolioPrincipal),
      periodInterestPotential: toNumber(row.periodInterestPotential),
      periodPortfolioAtRiskAmount: toNumber(row.periodPortfolioAtRiskAmount),
      dueLoans: toNumber(row.dueLoans),
      completedDueLoans: toNumber(row.completedDueLoans),
    };
  }

  const overlapDays = sql<number>`
    greatest(
      least(${loan_records.due_date}, ${sql`${range.end}::date`}) - greatest(${loan_records.start_date}, ${sql`${range.start}::date`}) + 1,
      0
    )
  `;
  const dueInRange = sql<boolean>`
    ${loan_records.due_date} >= ${sql`${range.start}::date`} and ${loan_records.due_date} <= ${sql`${range.end}::date`}
  `;

  const rows = await db
    .select({
      collectorId: loan_records.collector_id,
      periodPortfolioPrincipal: sql<number>`
        coalesce(sum(case when ${overlapDays} > 0 then ${loan_records.principal} else 0 end), 0)
      `,
      periodInterestPotential: sql<number>`
        coalesce(sum(case when ${overlapDays} > 0 then (${loan_records.principal} * ${loan_records.interest}) / 100 else 0 end), 0)
      `,
      periodPortfolioAtRiskAmount: sql<number>`
        coalesce(sum(case when ${overlapDays} > 0 and ${loan_records.status} = 'Overdue' then ${loan_records.principal} else 0 end), 0)
      `,
      dueLoans: sql<number>`sum(case when ${dueInRange} then 1 else 0 end)`,
      completedDueLoans: sql<number>`
        sum(case when ${dueInRange} and ${loan_records.status} = 'Completed' then 1 else 0 end)
      `,
    })
    .from(loan_records)
    .where(whereFrom(buildLoanScopeFilters(access, collectorIds)))
    .groupBy(loan_records.collector_id)
    .catch(() => []);

  const row = rows[0];
  if (!row || !row.collectorId) {
    return null;
  }

  return {
    collectorId: row.collectorId,
    periodPortfolioPrincipal: toNumber(row.periodPortfolioPrincipal),
    periodInterestPotential: toNumber(row.periodInterestPotential),
    periodPortfolioAtRiskAmount: toNumber(row.periodPortfolioAtRiskAmount),
    dueLoans: toNumber(row.dueLoans),
    completedDueLoans: toNumber(row.completedDueLoans),
  };
}

function chartGranularityForPeriod(periodKey: CollectorProfilePeriodKey) {
  return periodKey === "this-year" || periodKey === "lifetime" ? "month" : "day";
}

function startOfMonth(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function addMonths(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 10);
}

function formatBucketLabel(bucketKey: string, granularity: "day" | "month") {
  const date = new Date(`${bucketKey}T00:00:00.000Z`);

  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    month: "short",
    ...(granularity === "day" ? { day: "numeric" } : { year: "numeric" }),
  }).format(date);
}

function buildBucketKeys(range: CollectorsDateRange, granularity: "day" | "month") {
  if (granularity === "day") {
    const totalDays = daysInRange(range);
    return Array.from({ length: totalDays }, (_, index) => addDays(range.start, index));
  }

  const keys: string[] = [];
  let current = startOfMonth(range.start);
  const end = startOfMonth(range.end);

  while (current <= end) {
    keys.push(current);
    current = addMonths(current, 1);
  }

  return keys;
}

async function loadCollectionTrendBuckets(
  access: AnalyticsAccess,
  collectorId: string,
  range: CollectorsDateRange,
  granularity: "day" | "month",
): Promise<CollectionTrendBucketRow[]> {
  const collectorIds = [collectorId];
  const bucketExpression =
    granularity === "day"
      ? sql<string>`${collections.collection_date}::text`
      : sql<string>`to_char(date_trunc('month', ${collections.collection_date}), 'YYYY-MM-01')`;

  const rows = await db
    .select({
      bucketKey: bucketExpression,
      totalCollected: sql<number>`coalesce(sum(${collections.amount}), 0)`,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(whereFrom(buildCollectionScopeFilters(access, collectorIds, range)))
    .groupBy(bucketExpression)
    .orderBy(asc(bucketExpression))
    .catch(() => []);

  return rows.map((row) => ({
    bucketKey: row.bucketKey,
    totalCollected: toNumber(row.totalCollected),
  }));
}

function buildTrendChart(
  range: CollectorsDateRange,
  periodKey: CollectorProfilePeriodKey,
  totalCollected: number,
  expectedCollections: number,
  rows: CollectionTrendBucketRow[],
): AnalyticsChartModel {
  const granularity = chartGranularityForPeriod(periodKey);
  const bucketKeys = periodKey === "lifetime"
    ? rows.slice(-12).map((row) => row.bucketKey)
    : buildBucketKeys(range, granularity);
  const visibleBucketKeys = bucketKeys.length > 0 ? bucketKeys : rows.map((row) => row.bucketKey);
  const valueMap = new Map(rows.map((row) => [row.bucketKey, row.totalCollected]));
  const expectedPerBucket = visibleBucketKeys.length > 0 ? expectedCollections / visibleBucketKeys.length : 0;
  const chartRows = visibleBucketKeys.map((bucketKey) => ({
    bucket: formatBucketLabel(bucketKey, granularity),
    values: {
      collected: valueMap.get(bucketKey) ?? 0,
      expectedPace: expectedPerBucket,
    },
  }));

  return {
    rows: chartRows,
    series: [
      { key: "collected", label: "Collected", color: "#16a34a" },
      { key: "expectedPace", label: "Expected Pace", color: "#2563eb" },
    ],
    noData:
      chartRows.every((row) => Number(row.values.collected ?? 0) === 0) &&
      totalCollected <= 0 &&
      expectedCollections <= 0,
  };
}

function buildOutputComparisonChart(data: {
  totalCollected: number;
  expectedCollections: number;
  averageMonthlyCollections: number;
  lifetimeAverageMonthlyCollection: number;
}): AnalyticsChartModel {
  const rows = [
    { bucket: "Collected", values: { amount: data.totalCollected } },
    { bucket: "Expected", values: { amount: data.expectedCollections } },
    { bucket: "Monthly Pace", values: { amount: data.averageMonthlyCollections } },
    { bucket: "Lifetime Avg", values: { amount: data.lifetimeAverageMonthlyCollection } },
  ];

  return {
    rows,
    series: [{ key: "amount", label: "Amount", color: "#0ea5e9" }],
    noData: rows.every((row) => Number(row.values.amount ?? 0) === 0),
  };
}

function buildRateComparisonChart(data: {
  efficiencyRatio: number | null;
  portfolioYieldRate: number | null;
  portfolioAtRiskRate: number | null;
  completionRate: number;
  missedPaymentRate: number;
  delinquencyControl: number;
}): AnalyticsChartModel {
  const rows = [
    { bucket: "Efficiency", values: { value: data.efficiencyRatio ?? 0 } },
    { bucket: "Yield", values: { value: data.portfolioYieldRate ?? 0 } },
    { bucket: "PAR", values: { value: data.portfolioAtRiskRate ?? 0 } },
    { bucket: "Completion", values: { value: data.completionRate } },
    { bucket: "Missed Rate", values: { value: data.missedPaymentRate } },
    { bucket: "Control", values: { value: data.delinquencyControl } },
  ];

  return {
    rows,
    series: [{ key: "value", label: "Rate", color: "#7c3aed" }],
    noData: rows.every((row) => Number(row.values.value ?? 0) === 0),
  };
}

function buildLifetimeTrendChart(
  rows: CollectionTrendBucketRow[],
  lifetimeAverageMonthlyCollection: number,
): AnalyticsChartModel {
  const visibleRows = rows.slice(-12);
  const chartRows = visibleRows.map((row) => ({
    bucket: formatBucketLabel(row.bucketKey, "month"),
    values: {
      collected: row.totalCollected,
      lifetimeAverage: lifetimeAverageMonthlyCollection,
    },
  }));

  return {
    rows: chartRows,
    series: [
      { key: "collected", label: "Collected", color: "#16a34a" },
      { key: "lifetimeAverage", label: "Lifetime Avg", color: "#f59e0b" },
    ],
    noData: chartRows.every((row) => Number(row.values.collected ?? 0) === 0),
  };
}

function daysInRange(range: CollectorsDateRange) {
  return Math.max(
    1,
    Math.round(
      (new Date(`${range.end}T00:00:00.000Z`).getTime() -
        new Date(`${range.start}T00:00:00.000Z`).getTime()) /
        86_400_000,
    ) + 1,
  );
}

function addDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function daysBetweenInclusive(start: string, end: string) {
  return Math.max(
    1,
    Math.round(
      (new Date(`${end}T00:00:00.000Z`).getTime() -
        new Date(`${start}T00:00:00.000Z`).getTime()) /
        86_400_000,
    ) + 1,
  );
}

function monthsBetweenInclusive(start: string, end: string) {
  const [startYear, startMonth] = start.split("-").map(Number);
  const [endYear, endMonth] = end.split("-").map(Number);
  return Math.max((endYear - startYear) * 12 + (endMonth - startMonth) + 1, 1);
}

function previousEquivalentRange(range: CollectorsDateRange): CollectorsDateRange {
  const totalDays = daysInRange(range);
  return {
    start: addDays(range.start, -totalDays),
    end: addDays(range.start, -1),
    label: "previous equivalent period",
  };
}

function percentChange(current: number, previous: number) {
  if (previous <= 0) {
    return current > 0 ? null : 0;
  }

  return ((current - previous) / previous) * 100;
}

function normalizeRadarScore(value: number, max: number) {
  if (max <= 0) {
    return 0;
  }

  return Math.min((value / max) * 100, 100);
}

function percentOf(value: number, denominator: number) {
  if (denominator <= 0) {
    return null;
  }

  return (value / denominator) * 100;
}

function buildCollectorRows(
  baseRows: BaseCollectorRow[],
  loanStatsMap: Map<string, LoanStatsRow>,
  collectionStatsMap: Map<string, CollectionStatsRow>,
  previousCollectionStatsMap: Map<string, CollectionStatsRow>,
  range: CollectorsDateRange,
  mode: CollectorRowMode = "window",
): CollectorPerformanceRow[] {
  const sharedVisibleDays = daysInRange(range);
  const sharedVisibleWeeks = Math.max(Math.ceil(sharedVisibleDays / 7), 1);
  const sharedVisibleMonths = Math.max(sharedVisibleDays / 30.4375, 0.25);

  const combined = baseRows.map((row) => {
    const loanStats = loanStatsMap.get(row.collectorId);
    const collectionStats = collectionStatsMap.get(row.collectorId);
    const previousCollectionStats = previousCollectionStatsMap.get(row.collectorId);
    const normalizedStart =
      mode === "career" && loanStats?.firstLoanStart
        ? loanStats.firstLoanStart
        : range.start;
    const visibleDays =
      mode === "career"
        ? daysBetweenInclusive(normalizedStart, range.end)
        : sharedVisibleDays;
    const visibleWeeks =
      mode === "career"
        ? Math.max(Math.ceil(visibleDays / 7), 1)
        : sharedVisibleWeeks;
    const visibleMonths =
      mode === "career"
        ? Math.max(monthsBetweenInclusive(normalizedStart, range.end), 1)
        : sharedVisibleMonths;
    const assignedActiveLoans = loanStats?.assignedActiveLoans ?? 0;
    const activePrincipalLoad = loanStats?.activePrincipalLoad ?? 0;
    const activeInterestPotential = loanStats?.activeInterestPotential ?? 0;
    const portfolioAtRiskAmount = loanStats?.portfolioAtRiskAmount ?? 0;
    const completedLoans = loanStats?.completedLoans ?? 0;
    const totalLoans = loanStats?.totalLoans ?? 0;
    const expectedCollections = loanStats?.expectedCollections ?? 0;
    const totalCollected = collectionStats?.totalCollected ?? 0;
    const previousTotalCollected = previousCollectionStats?.totalCollected ?? 0;
    const averageCollectionAmount = collectionStats?.averageCollectionAmount ?? 0;
    const averageMonthlyCollections = totalCollected > 0 ? totalCollected / visibleMonths : 0;
    const collectionEntries = collectionStats?.collectionEntries ?? 0;
    const productivityCount = collectionEntries;
    const missedPaymentCount = collectionStats?.missedPaymentCount ?? 0;
    const missedPaymentRate = collectionEntries > 0 ? (missedPaymentCount / collectionEntries) * 100 : 0;
    const collectionDays = collectionStats?.collectionDays ?? 0;
    const activeWeeks = collectionStats?.activeWeeks ?? 0;
    const completionRate = totalLoans > 0 ? (completedLoans / totalLoans) * 100 : 0;
    const consistencyScore = Math.min((activeWeeks / visibleWeeks) * 100, 100);
    const delinquencyControl = Math.max(0, 100 - missedPaymentRate);
    const portfolioRecoveryRate = percentOf(totalCollected, activePrincipalLoad) ?? 0;
    const efficiencyRatio = percentOf(totalCollected, expectedCollections);
    const portfolioYieldRate = percentOf(activeInterestPotential, activePrincipalLoad);
    const portfolioAtRiskRate = percentOf(portfolioAtRiskAmount, activePrincipalLoad);
    const periodChangePercent = percentChange(totalCollected, previousTotalCollected);

    return {
      collectorId: row.collectorId,
      fullName: fullNameOf(row),
      companyId: row.companyId,
      roleName: "Collector" as const,
      branchId: row.branchId,
      branchName: row.branchName,
      areaId: row.areaId,
      areaCode: row.areaCode,
      areaLabel: `Area ${row.areaNo} (${row.areaCode})`,
      status: row.status,
      contactNo: row.contactNo,
      email: row.email,
      dateCreated: row.dateCreated,
      assignedActiveLoans,
      activePrincipalLoad,
      totalCollected,
      averageCollectionAmount,
      averageMonthlyCollections,
      expectedCollections,
      efficiencyRatio,
      productivityCount,
      completedLoans,
      missedPaymentCount,
      missedPaymentRate,
      collectionEntries,
      collectionDays,
      activeWeeks,
      completionRate,
      consistencyScore,
      delinquencyControl,
      portfolioRecoveryRate,
      activeInterestPotential,
      portfolioYieldRate,
      portfolioAtRiskAmount,
      portfolioAtRiskRate,
      nationwideRank: 0,
      branchRank: 0,
      visibleCollectorCount: 0,
      branchCollectorCount: 0,
      previousTotalCollected,
      periodChangePercent,
      rank: 0,
      radarMetrics: [],
    };
  });

  const sorted = combined.sort((left, right) => {
    if (right.averageMonthlyCollections !== left.averageMonthlyCollections) {
      return right.averageMonthlyCollections - left.averageMonthlyCollections;
    }
    if (right.totalCollected !== left.totalCollected) {
      return right.totalCollected - left.totalCollected;
    }
    if (right.productivityCount !== left.productivityCount) {
      return right.productivityCount - left.productivityCount;
    }
    if (right.completedLoans !== left.completedLoans) {
      return right.completedLoans - left.completedLoans;
    }
    if (right.assignedActiveLoans !== left.assignedActiveLoans) {
      return right.assignedActiveLoans - left.assignedActiveLoans;
    }
    return left.fullName.localeCompare(right.fullName);
  });

  const maxima = {
    totalCollected: Math.max(...sorted.map((row) => row.totalCollected), 0),
    completionRate: Math.max(...sorted.map((row) => row.completionRate), 0),
    consistencyScore: Math.max(...sorted.map((row) => row.consistencyScore), 0),
    averageMonthlyCollections: Math.max(...sorted.map((row) => row.averageMonthlyCollections), 0),
    portfolioRecoveryRate: Math.max(...sorted.map((row) => row.portfolioRecoveryRate), 0),
    delinquencyControl: Math.max(...sorted.map((row) => row.delinquencyControl), 0),
  };
  const totalVisibleCollectors = sorted.length;
  const branchCollectorCounts = new Map<number, number>();
  const branchRanks = new Map<string, number>();

  for (const row of sorted) {
    branchCollectorCounts.set(row.branchId, (branchCollectorCounts.get(row.branchId) ?? 0) + 1);
  }

  const sortedByBranch = [...sorted].sort((left, right) => {
    if (left.branchId !== right.branchId) {
      return left.branchId - right.branchId;
    }
    if (right.averageMonthlyCollections !== left.averageMonthlyCollections) {
      return right.averageMonthlyCollections - left.averageMonthlyCollections;
    }
    if (right.totalCollected !== left.totalCollected) {
      return right.totalCollected - left.totalCollected;
    }
    return left.fullName.localeCompare(right.fullName);
  });

  for (const row of sortedByBranch) {
    const key = `${row.branchId}:${row.collectorId}`;
    const currentRank = (branchRanks.get(String(row.branchId)) ?? 0) + 1;
    branchRanks.set(String(row.branchId), currentRank);
    branchRanks.set(key, currentRank);
  }

  return sorted.map((row, index) => ({
    ...row,
    nationwideRank: index + 1,
    branchRank: branchRanks.get(`${row.branchId}:${row.collectorId}`) ?? index + 1,
    visibleCollectorCount: totalVisibleCollectors,
    branchCollectorCount: branchCollectorCounts.get(row.branchId) ?? 1,
    rank: index + 1,
    radarMetrics: [
      {
        label: "Collection Output",
        value: normalizeRadarScore(row.totalCollected, maxima.totalCollected),
        description: "Shows how much this collector was able to collect in the selected period.",
      },
      {
        label: "Recovery Efficiency",
        value: normalizeRadarScore(row.portfolioRecoveryRate, maxima.portfolioRecoveryRate),
        description: "Shows how well this collector turned assigned accounts into collected payments.",
      },
      {
        label: "Consistency",
        value: normalizeRadarScore(row.consistencyScore, maxima.consistencyScore),
        description: "Shows how steady this collector was in doing collections across the period.",
      },
      {
        label: "Delinquency Control",
        value: normalizeRadarScore(row.delinquencyControl, maxima.delinquencyControl),
        description: "Shows how well this collector handled accounts with missed or difficult payments.",
      },
      {
        label: "Closure Rate",
        value: normalizeRadarScore(row.completionRate, maxima.completionRate),
        description: "Shows how often this collector helped accounts finish paying completely.",
      },
      {
        label: "Monthly Pace",
        value: normalizeRadarScore(row.averageMonthlyCollections, maxima.averageMonthlyCollections),
        description: "Shows this collector's usual monthly collection pace.",
      },
    ],
  }));
}

function takeTrendValues(rows: CollectorPerformanceRow[], selector: (row: CollectorPerformanceRow) => number) {
  const values = rows.slice(0, 7).map((row) => selector(row));
  return values.length > 0 ? values : [0];
}

function buildOutputChart(rows: CollectorPerformanceRow[]): AnalyticsChartModel {
  const chartRows = rows.slice(0, 6).map((row) => ({
    bucket: `#${row.rank}`,
    values: {
      totalCollected: row.totalCollected,
      averageMonthlyCollections: row.averageMonthlyCollections,
    },
  }));

  return {
    rows: chartRows,
    series: [
      { key: "totalCollected", label: "Total Collected", color: "#16a34a" },
      { key: "averageMonthlyCollections", label: "Avg Monthly", color: "#0ea5e9" },
    ],
    noData: chartRows.length === 0,
  };
}

function buildExecutionChart(rows: CollectorPerformanceRow[]): AnalyticsChartModel {
  const chartRows = rows.slice(0, 6).map((row) => ({
    bucket: `#${row.rank}`,
    values: {
      completionRate: row.completionRate,
      consistencyScore: row.consistencyScore,
      delinquencyControl: row.delinquencyControl,
    },
  }));

  return {
    rows: chartRows,
    series: [
      { key: "completionRate", label: "Completion Rate", color: "#2563eb" },
      { key: "consistencyScore", label: "Consistency", color: "#7c3aed" },
      { key: "delinquencyControl", label: "Delinquency Control", color: "#ea580c" },
    ],
    noData: chartRows.length === 0,
  };
}

function buildTopPerformers(rows: CollectorPerformanceRow[]): CollectorsTopPerformerItem[] {
  return rows.slice(0, 3).map((row) => ({
    collectorId: row.collectorId,
    fullName: row.fullName,
    branchName: row.branchName,
    areaLabel: row.areaLabel,
    totalCollected: row.totalCollected,
    completedLoans: row.completedLoans,
    assignedActiveLoans: row.assignedActiveLoans,
    rank: row.rank,
  }));
}

function buildComparisonRows(rows: CollectorPerformanceRow[]): CollectorsComparisonItem[] {
  return [...rows]
    .sort((left, right) => {
      if (right.assignedActiveLoans !== left.assignedActiveLoans) {
        return right.assignedActiveLoans - left.assignedActiveLoans;
      }
      return right.totalCollected - left.totalCollected;
    })
    .slice(0, 6)
    .map((row) => ({
      collectorId: row.collectorId,
      fullName: row.fullName,
      branchName: row.branchName,
      areaLabel: row.areaLabel,
      rank: row.rank,
      assignedActiveLoans: row.assignedActiveLoans,
      activePrincipalLoad: row.activePrincipalLoad,
      totalCollected: row.totalCollected,
      portfolioRecoveryRate: row.portfolioRecoveryRate,
    }));
}

function buildExecutionRows(rows: CollectorPerformanceRow[]): CollectorsExecutionItem[] {
  return [...rows]
    .sort((left, right) => {
      const leftScore = left.completionRate + left.consistencyScore + left.delinquencyControl;
      const rightScore = right.completionRate + right.consistencyScore + right.delinquencyControl;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return right.totalCollected - left.totalCollected;
    })
    .slice(0, 6)
    .map((row) => ({
      collectorId: row.collectorId,
      fullName: row.fullName,
      rank: row.rank,
      completionRate: row.completionRate,
      consistencyScore: row.consistencyScore,
      delinquencyControl: row.delinquencyControl,
      missedPaymentRate: row.missedPaymentRate,
      periodChangePercent: row.periodChangePercent,
      collectionDays: row.collectionDays,
    }));
}

async function loadAllCollectorRows(
  access: AnalyticsAccess,
  filters: CollectorsFilterState,
  collectorId?: string,
  options?: {
    includePrevious?: boolean;
    mode?: CollectorRowMode;
  },
) {
  const range = resolveCollectorsDateRange(filters);
  const includePrevious = options?.includePrevious ?? true;
  const mode = options?.mode ?? "window";
  const previousRange = includePrevious ? previousEquivalentRange(range) : range;
  const baseRows = await loadCollectorBaseRows(access, filters, collectorId);
  const collectorIds = baseRows.map((row) => row.collectorId);
  const [loanStatsMap, collectionStatsMap, previousCollectionStatsMap] = await Promise.all([
    loadLoanStats(access, collectorIds, range),
    loadCollectionStats(access, collectorIds, range),
    includePrevious ? loadCollectionStats(access, collectorIds, previousRange) : Promise.resolve(new Map<string, CollectionStatsRow>()),
  ]);

  return {
    range,
    previousRange,
    rows: buildCollectorRows(baseRows, loanStatsMap, collectionStatsMap, previousCollectionStatsMap, range, mode),
  };
}

export async function loadCollectorsBranchOptions(
  access: AnalyticsAccess,
): Promise<CollectorsBranchOption[]> {
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

export async function loadCollectorsAnalyticsData(
  access: AnalyticsAccess,
  filters: CollectorsFilterState,
): Promise<CollectorsAnalyticsData> {
  const { rows, range } = await loadAllCollectorRows(access, filters);
  const totalCount = rows.length;
  const pageSize = COLLECTORS_PAGE_SIZE;
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
  const page = Math.min(Math.max(filters.page, 1), totalPages);
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const totalCollectionsAttributed = rows.reduce((sum, row) => sum + row.totalCollected, 0);
  const previousTotalCollectionsAttributed = rows.reduce((sum, row) => sum + row.previousTotalCollected, 0);
  const activeCollectors = rows.length;
  const averagePortfolioRecoveryRate =
    activeCollectors > 0 ? rows.reduce((sum, row) => sum + row.portfolioRecoveryRate, 0) / activeCollectors : 0;
  const totalCollectionsChangePercent = percentChange(totalCollectionsAttributed, previousTotalCollectionsAttributed);
  const topCollector = rows[0];
  const highestPortfolio = [...rows].sort((left, right) => {
    if (right.assignedActiveLoans !== left.assignedActiveLoans) {
      return right.assignedActiveLoans - left.assignedActiveLoans;
    }
    return right.totalCollected - left.totalCollected;
  })[0];
  const bestRecovery = [...rows]
    .filter((row) => row.activePrincipalLoad > 0)
    .sort((left, right) => right.portfolioRecoveryRate - left.portfolioRecoveryRate)[0];

  return {
    filters: {
      ...filters,
      page,
    },
    dateRangeLabel: range.label,
    summary: {
      activeCollectors,
      totalCollectionsAttributed,
      totalCollectionsChangePercent,
      averagePortfolioRecoveryRate,
      topCollectorName: topCollector?.fullName ?? "No collector data",
      topCollectorAmount: topCollector?.totalCollected ?? 0,
    },
    summaryTrends: {
      activeCollectors: takeTrendValues(rows, (row) => row.assignedActiveLoans),
      totalCollectionsAttributed: takeTrendValues(rows, (row) => row.totalCollected),
      averagePortfolioRecoveryRate: takeTrendValues(rows, (row) => row.portfolioRecoveryRate),
      topCollector: takeTrendValues(rows, (row) => row.totalCollected),
    },
    rows: pageRows,
    topPerformers: buildTopPerformers(rows),
    comparison: buildComparisonRows(rows),
    execution: buildExecutionRows(rows),
    outputChart: buildOutputChart(rows),
    executionChart: buildExecutionChart(rows),
    insight: topCollector
      ? {
          eyebrow: "Pace leader",
          title: `${topCollector.fullName} leads the monthly ranking`,
          description: `${topCollector.fullName} is currently #1 by average monthly collections, posting \u20B1${topCollector.averageMonthlyCollections.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} per month and \u20B1${topCollector.totalCollected.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}${topCollector.periodChangePercent !== null ? ` (${topCollector.periodChangePercent >= 0 ? "+" : ""}${topCollector.periodChangePercent.toLocaleString("en-PH", { maximumFractionDigits: 0 })}% vs previous period)` : " with new activity vs the previous period"}. ${highestPortfolio ? `${highestPortfolio.fullName} is carrying the heaviest live portfolio at \u20B1${highestPortfolio.activePrincipalLoad.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.` : ""}${bestRecovery ? ` ${bestRecovery.fullName} is posting the strongest portfolio recovery rate at ${bestRecovery.portfolioRecoveryRate.toLocaleString("en-PH", { maximumFractionDigits: 1 })}%.` : ""}`,
        }
      : {
          eyebrow: "No collector activity",
          title: "No collectors matched the selected filters",
          description: "Adjust the branch, date range, or search query to inspect collector performance.",
        },
    page,
    pageSize,
    totalCount,
  };
}

export async function loadCollectorProfileData(
  access: AnalyticsAccess,
  collectorId: string,
  periodKey: CollectorProfilePeriodKey,
): Promise<CollectorProfileData | null> {
  const periodFilters = buildCollectorsFiltersForProfilePeriod(periodKey);
  const lifetimeFilters = buildCollectorsFiltersForProfilePeriod("lifetime");
  const periodOptions = {
    includePrevious: periodKey !== "lifetime",
    mode: periodKey === "lifetime" ? ("career" as const) : ("window" as const),
  };
  const [periodResult, lifetimeResult, periodPortfolioStats, periodTrendRows, lifetimeTrendRows] = await Promise.all([
    loadAllCollectorRows(access, periodFilters, undefined, periodOptions),
    periodKey === "lifetime"
      ? Promise.resolve(null)
      : loadAllCollectorRows(access, lifetimeFilters, collectorId, {
          includePrevious: false,
          mode: "career",
        }),
    loadPeriodPortfolioStats(
      access,
      collectorId,
      periodKey === "lifetime" ? null : resolveCollectorsDateRange(periodFilters),
    ),
    loadCollectionTrendBuckets(
      access,
      collectorId,
      resolveCollectorsDateRange(periodFilters),
      chartGranularityForPeriod(periodKey),
    ),
    loadCollectionTrendBuckets(
      access,
      collectorId,
      resolveCollectorsDateRange(lifetimeFilters),
      "month",
    ),
  ]);
  const periodRow = periodResult.rows.find((item) => item.collectorId === collectorId);
  const lifetimeRow = periodKey === "lifetime"
    ? periodRow
    : lifetimeResult?.rows.find((item) => item.collectorId === collectorId);

  if (!periodRow || !lifetimeRow) {
    return null;
  }

  const periodPortfolioPrincipal = periodPortfolioStats?.periodPortfolioPrincipal ?? 0;
  const periodInterestPotential = periodPortfolioStats?.periodInterestPotential ?? 0;
  const periodPortfolioAtRiskAmount = periodPortfolioStats?.periodPortfolioAtRiskAmount ?? 0;
  const periodDueLoans = periodPortfolioStats?.dueLoans ?? 0;
  const periodCompletedLoans = periodPortfolioStats?.completedDueLoans ?? 0;
  const completionRate = periodDueLoans > 0 ? (periodCompletedLoans / periodDueLoans) * 100 : 0;
  const portfolioYieldRate = percentOf(periodInterestPotential, periodPortfolioPrincipal);
  const portfolioAtRiskRate = percentOf(periodPortfolioAtRiskAmount, periodPortfolioPrincipal);
  const portfolioRecoveryRate = percentOf(periodRow.totalCollected, periodPortfolioPrincipal) ?? 0;
  const periodLabel = resolveCollectorProfilePeriodLabel(periodKey);

  return {
    collectorId: periodRow.collectorId,
    fullName: periodRow.fullName,
    companyId: periodRow.companyId,
    roleName: periodRow.roleName,
    branchName: periodRow.branchName,
    areaCode: periodRow.areaCode,
    areaLabel: periodRow.areaLabel,
    periodKey,
    periodLabel,
    status: periodRow.status,
    contactNo: periodRow.contactNo,
    email: periodRow.email,
    dateCreated: periodRow.dateCreated,
    rank: periodRow.rank,
    periodPortfolioPrincipal,
    periodInterestPotential,
    periodPortfolioAtRiskAmount,
    periodDueLoans,
    periodCompletedLoans,
    activePrincipalLoad: periodRow.activePrincipalLoad,
    totalCollected: periodRow.totalCollected,
    averageCollectionAmount: periodRow.averageCollectionAmount,
    averageMonthlyCollections: periodRow.averageMonthlyCollections,
    expectedCollections: periodRow.expectedCollections,
    efficiencyRatio: periodRow.efficiencyRatio,
    productivityCount: periodRow.productivityCount,
    assignedActiveLoans: periodRow.assignedActiveLoans,
    completedLoans: periodRow.completedLoans,
    missedPaymentCount: periodRow.missedPaymentCount,
    missedPaymentRate: periodRow.missedPaymentRate,
    collectionEntries: periodRow.collectionEntries,
    collectionDays: periodRow.collectionDays,
    activeWeeks: periodRow.activeWeeks,
    completionRate,
    consistencyScore: periodRow.consistencyScore,
    delinquencyControl: periodRow.delinquencyControl,
    portfolioRecoveryRate,
    activeInterestPotential: periodRow.activeInterestPotential,
    portfolioYieldRate,
    portfolioAtRiskAmount: periodRow.portfolioAtRiskAmount,
    portfolioAtRiskRate,
    nationwideRank: periodRow.nationwideRank,
    branchRank: periodRow.branchRank,
    visibleCollectorCount: periodRow.visibleCollectorCount,
    branchCollectorCount: periodRow.branchCollectorCount,
    previousTotalCollected: periodRow.previousTotalCollected,
    periodChangePercent: periodKey === "lifetime" ? null : periodRow.periodChangePercent,
    radarMetrics: periodRow.radarMetrics,
    lifetimeMetrics: {
      lifetimeCollectionAmount: lifetimeRow.totalCollected,
      lifetimeAverageMonthlyCollection: lifetimeRow.averageMonthlyCollections,
      lifetimeAverageCollectedPerDay:
        lifetimeRow.collectionDays > 0 ? lifetimeRow.totalCollected / lifetimeRow.collectionDays : 0,
      lifetimeAverageAmountPerCollection: lifetimeRow.averageCollectionAmount,
      lifetimeMissedPaymentRatio: lifetimeRow.missedPaymentRate,
      lifetimeCollectionEntries: lifetimeRow.collectionEntries,
      lifetimeCollectionDays: lifetimeRow.collectionDays,
    },
    periodTrendChart: periodKey === "lifetime"
      ? buildLifetimeTrendChart(periodTrendRows, lifetimeRow.averageMonthlyCollections)
      : buildTrendChart(
          resolveCollectorsDateRange(periodFilters),
          periodKey,
          periodRow.totalCollected,
          periodRow.expectedCollections,
          periodTrendRows,
        ),
    lifetimeTrendChart: buildLifetimeTrendChart(
      lifetimeTrendRows,
      lifetimeRow.averageMonthlyCollections,
    ),
    outputComparisonChart: buildOutputComparisonChart({
      totalCollected: periodRow.totalCollected,
      expectedCollections: periodRow.expectedCollections,
      averageMonthlyCollections: periodRow.averageMonthlyCollections,
      lifetimeAverageMonthlyCollection: lifetimeRow.averageMonthlyCollections,
    }),
    rateComparisonChart: buildRateComparisonChart({
      efficiencyRatio: periodRow.efficiencyRatio,
      portfolioYieldRate,
      portfolioAtRiskRate,
      completionRate,
      missedPaymentRate: periodRow.missedPaymentRate,
      delinquencyControl: periodRow.delinquencyControl,
    }),
  };
}

export async function loadCollectorAssignedLoansData(
  access: AnalyticsAccess,
  collectorId: string,
  filters: CollectorAssignedLoansFilters,
): Promise<CollectorAssignedLoansData> {
  const whereCondition = whereFrom(buildCollectorAssignedLoansFilters(access, collectorId, filters));
  const requestedPage = Math.max(filters.page, 1);

  const totalCount = await db
    .select({ value: sql<number>`count(*)` })
    .from(loan_records)
    .innerJoin(branch, eq(branch.branch_id, loan_records.branch_id))
    .innerJoin(borrowerUsers, eq(borrowerUsers.user_id, loan_records.borrower_id))
    .leftJoin(borrower_info, eq(borrower_info.user_id, loan_records.borrower_id))
    .leftJoin(employee_info, eq(employee_info.user_id, loan_records.collector_id))
    .where(whereCondition)
    .then((rows) => Number(rows[0]?.value) || 0)
    .catch(() => 0);

  const totalPages = Math.max(Math.ceil(totalCount / COLLECTOR_ASSIGNED_LOANS_PAGE_SIZE), 1);
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * COLLECTOR_ASSIGNED_LOANS_PAGE_SIZE;

  const rows = await db
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
      collector_username: users.username,
    })
    .from(loan_records)
    .innerJoin(branch, eq(branch.branch_id, loan_records.branch_id))
    .innerJoin(borrowerUsers, eq(borrowerUsers.user_id, loan_records.borrower_id))
    .leftJoin(borrower_info, eq(borrower_info.user_id, loan_records.borrower_id))
    .leftJoin(users, eq(users.user_id, loan_records.collector_id))
    .leftJoin(employee_info, eq(employee_info.user_id, loan_records.collector_id))
    .where(whereCondition)
    .orderBy(desc(loan_records.loan_id))
    .limit(COLLECTOR_ASSIGNED_LOANS_PAGE_SIZE)
    .offset(offset)
    .catch(() => []);

  return {
    loans: rows.map(toCollectorLoanListRow),
    page,
    pageSize: COLLECTOR_ASSIGNED_LOANS_PAGE_SIZE,
    totalCount,
  };
}
