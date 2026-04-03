import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  notInArray,
  lte,
  gte,
  or,
  sql,
  type SQL,
  type Subquery,
} from "drizzle-orm";
import {
  buildLoanDerivedMetricsSubquery,
  LIVE_STORED_LOAN_STATUSES,
  buildStoredLoanStatusEqualsSql,
  buildStoredLoanStatusInSql,
} from "@/app/dashboard/loans/loan-derived-status-sql";
import {
  calculateLoanRemainingBalance,
  calculateLoanTotalPayable,
  getVisibleLoanStatusFromStoredStatus,
  getManilaTodayDateString,
  normalizeStoredLoanStatus,
  type StoredLoanStatus,
} from "@/app/dashboard/loans/loan-state";
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
import {
  isCollectorsSpecificPeriodSelection,
  resolveCollectorsDateRange,
} from "@/app/dashboard/collectors/filters";
import {
  buildCollectorProfileMonthPeriod,
  buildCollectorProfileYearPeriod,
  buildCollectorsFiltersForProfilePeriod,
  isCollectorProfileYearPeriod,
  resolveCollectorProfilePeriodLabel,
} from "@/app/dashboard/collectors/profile-filters";
import type {
  CollectorProfilePeriodKey,
  CollectorProfilePeriodAvailability,
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
import type { AnalyticsChartModel, AnalyticsDateRangeKey } from "@/components/analytics/types";
import type { LoanListRow } from "@/app/dashboard/loans/types";

type AnalyticsAccess = Extract<CollectorsAccessState, { view: "analytics" }>;

const COLLECTORS_PAGE_SIZE = 12;
const COLLECTOR_ASSIGNED_LOANS_PAGE_SIZE = 12;
const borrowerUsers = alias(users, "collector_detail_borrower_users");
const COLLECTOR_ASSIGNED_LOAN_ARCHIVED_STORED_VALUES = [
  "archived",
  "abandoned",
] as const satisfies readonly StoredLoanStatus[];
const COLLECTOR_PERIOD_COMPLETED_STORED_VALUES = [
  "completed",
  "archived",
] as const satisfies readonly StoredLoanStatus[];
const collectorAssignedLoanCollectionStats = db
  .select({
    loanId: collections.loan_id,
    totalCollected: sql<number>`coalesce(sum(${collections.amount}), 0)`.as("total_collected"),
  })
  .from(collections)
  .groupBy(collections.loan_id)
  .as("collector_assigned_loan_collection_stats");

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
  provinceName: string;
  areaId: number;
  areaNo: string;
  areaCode: string;
};

type LoanStatsRow = {
  collectorId: string | null;
  assignedActiveLoans: number;
  activePrincipalLoad: number;
  activeInterestPotential: number;
  activeCollected: number;
  portfolioAtRiskAmount: number;
  completedLoans: number;
  totalLoans: number;
  expectedCollections: number;
  activeExpectedCollections: number;
  firstLoanStart: string | null;
};

type CollectionStatsRow = {
  collectorId: string | null;
  totalCollected: number;
  averageCollectionAmount: number;
  collectionEntries: number;
  borrowersHandledCount: number;
  missedPaymentCount: number;
  collectionDays: number;
  activeWeeks: number;
  firstCollectionDate: string | null;
  lastCollectionDate: string | null;
};

type PeriodPortfolioStatsRow = {
  collectorId: string | null;
  periodPortfolioPrincipal: number;
  periodInterestPotential: number;
  periodPortfolioAtRiskAmount: number;
  dueLoans: number;
  completedDueLoans: number;
};

type CollectorLoanPortfolioCountsRow = {
  collectorId: string | null;
  active: number;
  overdue: number;
  completed: number;
  archived: number;
  abandoned: number;
};

type CollectionTrendBucketRow = {
  bucketKey: string;
  totalCollected: number;
};

type CollectorRowMode = "window" | "career";
type CollectorLeaderboardRow = Omit<CollectorPerformanceRow, "radarMetrics">;
type CollectorRadarMaxima = {
  totalCollected: number;
  completionRate: number;
  consistencyScore: number;
  averageMonthlyCollections: number;
  portfolioRecoveryRate: number;
  delinquencyControl: number;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function logCollectorsAnalyticsDebug(params: {
  access: AnalyticsAccess;
  filters: CollectorsFilterState;
  totalCount: number;
  summaryQueryFailed: boolean;
  summaryQueryError: string | null;
  baseCollectors: Subquery<string, Record<string, unknown>>;
}) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const [baseCollectorSummary, baseCollectorSamples] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(params.baseCollectors)
      .then((rows) => rows[0] ?? { count: 0 })
      .catch(() => ({ count: 0 })),
    db
      .select({
        collectorId: sql<string>`cast(${sql.raw("collector_analytics_base.collector_id")} as text)`,
      })
      .from(params.baseCollectors)
      .limit(5)
      .then((rows) => rows.map((row) => row.collectorId))
      .catch(() => []),
  ]);

  console.log("[sumtrack][collectors-analytics-debug] START");
  console.log(
    JSON.stringify(
      {
        access: {
          roleName: params.access.roleName,
          allowedBranchIds: params.access.allowedBranchIds,
          selectedBranchId: params.access.selectedBranchId,
          canChooseBranch: params.access.canChooseBranch,
          fixedBranchName: params.access.fixedBranchName,
        },
        filters: params.filters,
        totalCount: params.totalCount,
        summaryQueryFailed: params.summaryQueryFailed,
        summaryQueryError: params.summaryQueryError,
        baseCollectorCount: toNumber(baseCollectorSummary.count),
        baseCollectorSampleIds: baseCollectorSamples,
      },
      null,
      2,
    ),
  );
  console.log("[sumtrack][collectors-analytics-debug] END");
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

function toCollectorLoanListRow(
  row: {
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
  total_collected: number;
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
  const storedStatus = normalizeStoredLoanStatus(row.status);
  const totalPayable = calculateLoanTotalPayable(Number(row.principal) || 0, Number(row.interest) || 0);
  const totalCollected = Number(row.total_collected) || 0;
  const remainingBalance = calculateLoanRemainingBalance(totalPayable, totalCollected);

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
    storedStatus,
    visibleStatus: getVisibleLoanStatusFromStoredStatus(storedStatus),
    totalPayable,
    totalCollected,
    remainingBalance,
    collectionCount: 0,
    canArchive: false,
    canDelete: false,
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

function buildCollectorAssignedLoanVisibleStatusWhere(
  statusFilter: CollectorAssignedLoansFilters["status"],
) {
  if (statusFilter === "all") {
    return undefined;
  }

  if (statusFilter === "Active") {
    return eq(loan_records.status, "active");
  }

  if (statusFilter === "Overdue") {
    return eq(loan_records.status, "overdue");
  }

  if (statusFilter === "Completed") {
    return eq(loan_records.status, "completed");
  }

  if (statusFilter === "Archived") {
    return eq(loan_records.status, "archived");
  }

  return eq(loan_records.status, "abandoned");
}

function mapLeaderboardRangeToProfilePeriod(params: {
  rangeKey: AnalyticsDateRangeKey;
  fromRaw?: string;
  toRaw?: string;
}): CollectorProfilePeriodKey | null {
  const { rangeKey, fromRaw = "", toRaw = "" } = params;
  if (
    rangeKey === "this-month" ||
    rangeKey === "last-30-days" ||
    rangeKey === "past-3-months" ||
    rangeKey === "past-6-months" ||
    rangeKey === "this-year"
  ) {
    return rangeKey;
  }

  if (
    rangeKey === "custom" &&
    /^\d{4}-\d{2}-01$/.test(fromRaw) &&
    /^\d{4}-\d{2}-\d{2}$/.test(toRaw) &&
    fromRaw.slice(0, 7) === toRaw.slice(0, 7)
  ) {
    const [year, month] = fromRaw.slice(0, 7).split("-").map(Number);

    if (Number.isInteger(year) && Number.isInteger(month)) {
      return buildCollectorProfileMonthPeriod(year, month);
    }
  }

  if (
    rangeKey === "custom" &&
    /^\d{4}-01-01$/.test(fromRaw) &&
    /^\d{4}-\d{2}-\d{2}$/.test(toRaw) &&
    fromRaw.slice(0, 4) === toRaw.slice(0, 4)
  ) {
    const year = Number(fromRaw.slice(0, 4));

    if (Number.isInteger(year)) {
      return buildCollectorProfileYearPeriod(year);
    }
  }

  return null;
}

function buildCollectionScopeFilters(
  access: AnalyticsAccess,
  collectorIds: string[],
  range: CollectorsDateRange,
) {
  const conditions: SQL[] = [inArray(collections.collector_id, collectorIds)];

  if (access.selectedBranchId) {
    conditions.push(eq(loan_records.branch_id, access.selectedBranchId));
  } else if (access.allowedBranchIds.length > 0) {
    conditions.push(inArray(loan_records.branch_id, access.allowedBranchIds));
  } else {
    conditions.push(eq(loan_records.loan_id, -1));
  }

  conditions.push(gte(collections.collection_date, range.start));
  conditions.push(lte(collections.collection_date, range.end));

  return conditions;
}

function buildCollectorAnalyticsLoanScopeFilters(access: AnalyticsAccess) {
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

function buildCollectorAnalyticsCollectionScopeFilters(
  access: AnalyticsAccess,
  range: CollectorsDateRange,
) {
  const conditions: SQL[] = [];

  if (access.selectedBranchId) {
    conditions.push(eq(loan_records.branch_id, access.selectedBranchId));
  } else if (access.allowedBranchIds.length > 0) {
    conditions.push(inArray(loan_records.branch_id, access.allowedBranchIds));
  } else {
    conditions.push(eq(loan_records.loan_id, -1));
  }

  conditions.push(gte(collections.collection_date, range.start));
  conditions.push(lte(collections.collection_date, range.end));

  return conditions;
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
      provinceName: branch.province_name,
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

  const currentDate = getManilaTodayDateString();
  const loanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "collector_loan_stats_metrics",
    currentDate,
    where: whereFrom(buildLoanScopeFilters(access, collectorIds)),
  });

  const rows = await db
    .select({
        collectorId: loanMetrics.collectorId,
        assignedActiveLoans: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusInSql(loanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)} then 1 else 0 end), 0)`,
        activePrincipalLoad: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusInSql(loanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)} then ${loanMetrics.principal} else 0 end), 0)`,
        activeInterestPotential: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusInSql(loanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)} then (${loanMetrics.principal} * ${loanMetrics.interest}) / 100 else 0 end), 0)`,
        activeCollected: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusInSql(loanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)} then ${loanMetrics.totalCollected} else 0 end), 0)`,
        portfolioAtRiskAmount: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusEqualsSql(loanMetrics.storedStatus, "overdue")} then ${loanMetrics.principal} else 0 end), 0)`,
        completedLoans: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusEqualsSql(loanMetrics.storedStatus, "completed")} then 1 else 0 end), 0)`,
        totalLoans: sql<number>`count(*)`,
        firstLoanStart: sql<string | null>`min(${loanMetrics.startDate})::text`,
        expectedCollections: sql<number>`
          coalesce(
            sum(
              (
                (${loanMetrics.principal} + ((${loanMetrics.principal} * ${loanMetrics.interest}) / 100))
                /
                greatest(
                  coalesce(${loanMetrics.termDays}, (${loanMetrics.dueDate} - ${loanMetrics.startDate}) + 1),
                  1
                )
              )
              *
              greatest(
                least(${loanMetrics.dueDate}, ${sql`${range.end}::date`}) - greatest(${loanMetrics.startDate}, ${sql`${range.start}::date`}) + 1,
                0
              )
            ),
            0
          )
        `,
        activeExpectedCollections: sql<number>`
          coalesce(
            sum(
              case
                when ${buildStoredLoanStatusInSql(loanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)}
                  then (
                (${loanMetrics.principal} + ((${loanMetrics.principal} * ${loanMetrics.interest}) / 100))
                    /
                    greatest(
                      coalesce(${loanMetrics.termDays}, (${loanMetrics.dueDate} - ${loanMetrics.startDate}) + 1),
                      1
                    )
                  )
                  *
                  greatest(
                    least(${loanMetrics.dueDate}, ${sql`${currentDate}::date`}) - ${loanMetrics.startDate} + 1,
                    0
                  )
                else 0
              end
            ),
            0
          )
        `,
      })
    .from(loanMetrics)
    .groupBy(loanMetrics.collectorId)
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
      activeCollected: toNumber(row.activeCollected),
      portfolioAtRiskAmount: toNumber(row.portfolioAtRiskAmount),
      completedLoans: toNumber(row.completedLoans),
      totalLoans: toNumber(row.totalLoans),
      expectedCollections: toNumber(row.expectedCollections),
      activeExpectedCollections: toNumber(row.activeExpectedCollections),
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
      collectorId: collections.collector_id,
      totalCollected: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      averageCollectionAmount: sql<number>`coalesce(avg(${collections.amount}), 0)`,
      collectionEntries: sql<number>`count(*)`,
      borrowersHandledCount: sql<number>`count(distinct ${loan_records.borrower_id})`,
      missedPaymentCount: sql<number>`sum(case when ${collections.amount} = 0 then 1 else 0 end)`,
      collectionDays: sql<number>`count(distinct ${collections.collection_date})`,
      activeWeeks: sql<number>`count(distinct date_trunc('week', ${collections.collection_date}))`,
      firstCollectionDate: sql<string | null>`min(${collections.collection_date})::text`,
      lastCollectionDate: sql<string | null>`max(${collections.collection_date})::text`,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(whereFrom(buildCollectionScopeFilters(access, collectorIds, range)))
    .groupBy(collections.collector_id)
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
      borrowersHandledCount: toNumber(row.borrowersHandledCount),
      missedPaymentCount: toNumber(row.missedPaymentCount),
      collectionDays: toNumber(row.collectionDays),
      activeWeeks: toNumber(row.activeWeeks),
      firstCollectionDate: row.firstCollectionDate,
      lastCollectionDate: row.lastCollectionDate,
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
  const loanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "collector_period_portfolio_metrics",
    currentDate: getManilaTodayDateString(),
    where: whereFrom(buildLoanScopeFilters(access, collectorIds)),
  });

  if (range === null) {
    const rows = await db
      .select({
        collectorId: loanMetrics.collectorId,
        periodPortfolioPrincipal: sql<number>`coalesce(sum(${loanMetrics.principal}), 0)`,
        periodInterestPotential: sql<number>`coalesce(sum((${loanMetrics.principal} * ${loanMetrics.interest}) / 100), 0)`,
        periodPortfolioAtRiskAmount: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusEqualsSql(loanMetrics.storedStatus, "overdue")} then ${loanMetrics.principal} else 0 end), 0)`,
        dueLoans: sql<number>`count(*)`,
        completedDueLoans: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusInSql(loanMetrics.storedStatus, COLLECTOR_PERIOD_COMPLETED_STORED_VALUES)} then 1 else 0 end), 0)`,
      })
      .from(loanMetrics)
      .groupBy(loanMetrics.collectorId)
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
      least(${loanMetrics.dueDate}, ${sql`${range.end}::date`}) - greatest(${loanMetrics.startDate}, ${sql`${range.start}::date`}) + 1,
      0
    )
  `;
  const dueInRange = sql<boolean>`
    ${loanMetrics.dueDate} >= ${sql`${range.start}::date`} and ${loanMetrics.dueDate} <= ${sql`${range.end}::date`}
  `;

  const rows = await db
    .select({
      collectorId: loanMetrics.collectorId,
      periodPortfolioPrincipal: sql<number>`
        coalesce(sum(case when ${overlapDays} > 0 then ${loanMetrics.principal} else 0 end), 0)
      `,
      periodInterestPotential: sql<number>`
        coalesce(sum(case when ${overlapDays} > 0 then (${loanMetrics.principal} * ${loanMetrics.interest}) / 100 else 0 end), 0)
      `,
      periodPortfolioAtRiskAmount: sql<number>`
        coalesce(sum(case when ${overlapDays} > 0 and ${buildStoredLoanStatusEqualsSql(loanMetrics.storedStatus, "overdue")} then ${loanMetrics.principal} else 0 end), 0)
      `,
      dueLoans: sql<number>`sum(case when ${dueInRange} then 1 else 0 end)`,
      completedDueLoans: sql<number>`
        coalesce(sum(case when ${dueInRange} and ${buildStoredLoanStatusInSql(loanMetrics.storedStatus, COLLECTOR_PERIOD_COMPLETED_STORED_VALUES)} then 1 else 0 end), 0)
      `,
    })
    .from(loanMetrics)
    .groupBy(loanMetrics.collectorId)
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

async function loadCollectorLoanPortfolioCounts(
  access: AnalyticsAccess,
  collectorId: string,
) {
  const loanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "collector_profile_loan_portfolio_metrics",
    currentDate: getManilaTodayDateString(),
    where: whereFrom(buildLoanScopeFilters(access, [collectorId])),
  });

  const rows = await db
    .select({
      collectorId: loanMetrics.collectorId,
      active: sql<number>`
        coalesce(sum(case when ${buildStoredLoanStatusEqualsSql(loanMetrics.storedStatus, "active")} then 1 else 0 end), 0)
      `,
      overdue: sql<number>`
        coalesce(sum(case when ${buildStoredLoanStatusEqualsSql(loanMetrics.storedStatus, "overdue")} then 1 else 0 end), 0)
      `,
      completed: sql<number>`
        coalesce(sum(case when ${buildStoredLoanStatusEqualsSql(loanMetrics.storedStatus, "completed")} then 1 else 0 end), 0)
      `,
      archived: sql<number>`
        coalesce(sum(case when ${buildStoredLoanStatusEqualsSql(loanMetrics.storedStatus, "archived")} then 1 else 0 end), 0)
      `,
      abandoned: sql<number>`
        coalesce(sum(case when ${buildStoredLoanStatusEqualsSql(loanMetrics.storedStatus, "abandoned")} then 1 else 0 end), 0)
      `,
    })
    .from(loanMetrics)
    .groupBy(loanMetrics.collectorId)
    .catch(() => []);

  const row = rows[0] as CollectorLoanPortfolioCountsRow | undefined;

  return {
    active: toNumber(row?.active),
    overdue: toNumber(row?.overdue),
    completed: toNumber(row?.completed),
    archived: toNumber(row?.archived),
    abandoned: toNumber(row?.abandoned),
    total:
      toNumber(row?.active) +
      toNumber(row?.overdue) +
      toNumber(row?.completed) +
      toNumber(row?.archived) +
      toNumber(row?.abandoned),
  };
}

function buildCollectorAnalyticsMetricsSubqueries(
  access: AnalyticsAccess,
  filters: CollectorsFilterState,
) {
  const range = resolveCollectorsDateRange(filters);
  const previousRange = previousEquivalentRange(range);
  const sharedVisibleDays = daysInRange(range);
  const sharedVisibleWeeks = Math.max(Math.ceil(sharedVisibleDays / 7), 1);
  const currentDate = getManilaTodayDateString();

  const baseCollectors = db
    .select({
      collectorId: users.user_id,
      companyId: users.company_id,
      fullName: sql<string>`
        coalesce(
          nullif(
            trim(
              concat_ws(
                ' ',
                ${employee_info.first_name},
                case
                  when ${employee_info.middle_name} is not null and btrim(${employee_info.middle_name}) <> ''
                    then concat(left(btrim(${employee_info.middle_name}), 1), '.')
                  else null
                end,
                ${employee_info.last_name}
              )
            ),
            ''
          ),
          ${users.username}
        )
      `.as("full_name"),
      branchId: branch.branch_id,
      branchName: branch.branch_name,
      provinceName: branch.province_name,
      areaId: areas.area_id,
      areaCode: areas.area_code,
      areaLabel: sql<string>`concat('Area ', ${areas.area_no}, ' (', ${areas.area_code}, ')')`.as("area_label"),
      status: users.status,
      contactNo: users.contact_no,
      email: users.email,
      dateCreated: users.date_created,
    })
    .from(employee_area_assignment)
    .innerJoin(users, eq(users.user_id, employee_area_assignment.employee_user_id))
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .innerJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
    .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
    .where(whereFrom(buildCollectorBaseFilters(access, filters)))
    .as("collector_analytics_base");

  const loanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "collector_analytics_loan_metrics",
    currentDate,
    where: whereFrom(buildCollectorAnalyticsLoanScopeFilters(access)),
  });
  const loanStats = db
    .select({
      collectorId: loanMetrics.collectorId,
      assignedActiveLoans: sql<number>`
        coalesce(
          sum(case when ${buildStoredLoanStatusInSql(loanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)} then 1 else 0 end),
          0
        )::int
      `.as("assigned_active_loans"),
      activePrincipalLoad: sql<number>`
        coalesce(
          sum(case when ${buildStoredLoanStatusInSql(loanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)} then ${loanMetrics.principal} else 0 end),
          0
        )::double precision
      `.as("active_principal_load"),
      activeInterestPotential: sql<number>`
        coalesce(
          sum(case when ${buildStoredLoanStatusInSql(loanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)} then (${loanMetrics.principal} * ${loanMetrics.interest}) / 100 else 0 end),
          0
        )::double precision
      `.as("active_interest_potential"),
      activeCollected: sql<number>`
        coalesce(
          sum(case when ${buildStoredLoanStatusInSql(loanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)} then ${loanMetrics.totalCollected} else 0 end),
          0
        )::double precision
      `.as("active_collected"),
      portfolioAtRiskAmount: sql<number>`
        coalesce(
          sum(case when ${buildStoredLoanStatusEqualsSql(loanMetrics.storedStatus, "overdue")} then ${loanMetrics.principal} else 0 end),
          0
        )::double precision
      `.as("portfolio_at_risk_amount"),
      completedLoans: sql<number>`
        coalesce(
          sum(case when ${buildStoredLoanStatusEqualsSql(loanMetrics.storedStatus, "completed")} then 1 else 0 end),
          0
        )::int
      `.as("completed_loans"),
      totalLoans: sql<number>`count(*)::int`.as("total_loans"),
      expectedCollections: sql<number>`
        coalesce(
          sum(
            (
              (${loanMetrics.principal} + ((${loanMetrics.principal} * ${loanMetrics.interest}) / 100))
              /
              greatest(
                coalesce(${loanMetrics.termDays}, (${loanMetrics.dueDate} - ${loanMetrics.startDate}) + 1),
                1
              )
            )
            *
            greatest(
              least(${loanMetrics.dueDate}, ${sql`${range.end}::date`}) - greatest(${loanMetrics.startDate}, ${sql`${range.start}::date`}) + 1,
              0
            )
          ),
          0
        )::double precision
      `.as("expected_collections"),
      activeExpectedCollections: sql<number>`
        coalesce(
          sum(
            case
              when ${buildStoredLoanStatusInSql(loanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)}
                then (
                  (
                    (${loanMetrics.principal} + ((${loanMetrics.principal} * ${loanMetrics.interest}) / 100))
                    /
                    greatest(
                      coalesce(${loanMetrics.termDays}, (${loanMetrics.dueDate} - ${loanMetrics.startDate}) + 1),
                      1
                    )
                  )
                  *
                  greatest(
                    least(${loanMetrics.dueDate}, ${sql`${currentDate}::date`}) - ${loanMetrics.startDate} + 1,
                    0
                  )
                )
              else 0
            end
          ),
          0
        )::double precision
      `.as("active_expected_collections"),
    })
    .from(loanMetrics)
    .innerJoin(baseCollectors, eq(baseCollectors.collectorId, loanMetrics.collectorId))
    .groupBy(loanMetrics.collectorId)
    .as("collector_analytics_loan_stats");

  const currentCollectionStats = db
    .select({
      collectorId: collections.collector_id,
      totalCollected: sql<number>`coalesce(sum(${collections.amount}), 0)::double precision`.as("current_total_collected"),
      averageCollectionAmount: sql<number>`coalesce(avg(${collections.amount}), 0)::double precision`.as("average_collection_amount"),
      collectionEntries: sql<number>`count(*)::int`.as("collection_entries"),
      borrowersHandledCount: sql<number>`count(distinct ${loan_records.borrower_id})::int`.as("borrowers_handled_count"),
      missedPaymentCount: sql<number>`
        coalesce(sum(case when ${collections.amount} = 0 then 1 else 0 end), 0)::int
      `.as("missed_payment_count"),
      collectionDays: sql<number>`count(distinct ${collections.collection_date})::int`.as("collection_days"),
      activeWeeks: sql<number>`count(distinct date_trunc('week', ${collections.collection_date}))::int`.as("active_weeks"),
      firstCollectionDate: sql<string | null>`min(${collections.collection_date})::text`.as("first_collection_date"),
      lastCollectionDate: sql<string | null>`max(${collections.collection_date})::text`.as("last_collection_date"),
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .innerJoin(baseCollectors, eq(baseCollectors.collectorId, collections.collector_id))
    .where(whereFrom(buildCollectorAnalyticsCollectionScopeFilters(access, range)))
    .groupBy(collections.collector_id)
    .as("collector_analytics_collection_stats");

  const previousCollectionStats = db
    .select({
      collectorId: collections.collector_id,
      totalCollected: sql<number>`coalesce(sum(${collections.amount}), 0)::double precision`.as("previous_total_collected"),
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .innerJoin(baseCollectors, eq(baseCollectors.collectorId, collections.collector_id))
    .where(whereFrom(buildCollectorAnalyticsCollectionScopeFilters(access, previousRange)))
    .groupBy(collections.collector_id)
    .as("collector_analytics_previous_collection_stats");

  const assignedActiveLoansExpression = sql<number>`coalesce(${loanStats.assignedActiveLoans}, 0)::int`;
  const activePrincipalLoadExpression = sql<number>`coalesce(${loanStats.activePrincipalLoad}, 0)::double precision`;
  const activeInterestPotentialExpression = sql<number>`coalesce(${loanStats.activeInterestPotential}, 0)::double precision`;
  const activeCollectedExpression = sql<number>`coalesce(${loanStats.activeCollected}, 0)::double precision`;
  const activeTotalPayableLoadExpression = sql<number>`
    (${activePrincipalLoadExpression} + ${activeInterestPotentialExpression})::double precision
  `;
  const portfolioAtRiskAmountExpression = sql<number>`coalesce(${loanStats.portfolioAtRiskAmount}, 0)::double precision`;
  const completedLoansExpression = sql<number>`coalesce(${loanStats.completedLoans}, 0)::int`;
  const totalLoansExpression = sql<number>`coalesce(${loanStats.totalLoans}, 0)::int`;
  const expectedCollectionsExpression = sql<number>`coalesce(${loanStats.expectedCollections}, 0)::double precision`;
  const activeExpectedCollectionsExpression = sql<number>`
    coalesce(${loanStats.activeExpectedCollections}, 0)::double precision
  `;
  const totalCollectedExpression = sql<number>`coalesce(${currentCollectionStats.totalCollected}, 0)::double precision`;
  const previousTotalCollectedExpression = sql<number>`
    coalesce(${previousCollectionStats.totalCollected}, 0)::double precision
  `;
  const averageCollectionAmountExpression = sql<number>`
    coalesce(${currentCollectionStats.averageCollectionAmount}, 0)::double precision
  `;
  const collectionEntriesExpression = sql<number>`coalesce(${currentCollectionStats.collectionEntries}, 0)::int`;
  const borrowersHandledCountExpression = sql<number>`coalesce(${currentCollectionStats.borrowersHandledCount}, 0)::int`;
  const missedPaymentCountExpression = sql<number>`coalesce(${currentCollectionStats.missedPaymentCount}, 0)::int`;
  const collectionDaysExpression = sql<number>`coalesce(${currentCollectionStats.collectionDays}, 0)::int`;
  const activeWeeksExpression = sql<number>`coalesce(${currentCollectionStats.activeWeeks}, 0)::int`;
  const activeCollectionMonthsExpression = sql<number>`
    greatest(
      (
        (
          extract(year from ${currentCollectionStats.lastCollectionDate}::date) -
          extract(year from ${currentCollectionStats.firstCollectionDate}::date)
        ) * 12
      ) +
      (
        extract(month from ${currentCollectionStats.lastCollectionDate}::date) -
        extract(month from ${currentCollectionStats.firstCollectionDate}::date)
      ) +
      1,
      1
    )::double precision
  `;
  const averageMonthlyCollectionsExpression = sql<number>`
    (
      case
        when ${totalCollectedExpression} > 0
          and ${currentCollectionStats.firstCollectionDate} is not null
          and ${currentCollectionStats.lastCollectionDate} is not null
          then ${totalCollectedExpression} / ${activeCollectionMonthsExpression}
        else 0
      end
    )::double precision
  `;
  const completionRateExpression = sql<number>`
    (
      case
        when ${totalLoansExpression} > 0
          then (${completedLoansExpression} * 100.0) / ${totalLoansExpression}
        else 0
      end
    )::double precision
  `;
  const missedPaymentRateExpression = sql<number>`
    (
      case
        when ${collectionEntriesExpression} > 0
          then (${missedPaymentCountExpression} * 100.0) / ${collectionEntriesExpression}
        else 0
      end
    )::double precision
  `;
  const consistencyScoreExpression = sql<number>`
    least(
      (
        case
          when ${sharedVisibleWeeks} > 0
            then (${activeWeeksExpression} * 100.0) / ${sharedVisibleWeeks}
          else 0
        end
      ),
      100
    )::double precision
  `;
  const delinquencyControlExpression = sql<number>`
    greatest(0, 100 - ${missedPaymentRateExpression})::double precision
  `;
  const portfolioRecoveryRateExpression = sql<number>`
    (
      case
        when ${activePrincipalLoadExpression} > 0
          then (${totalCollectedExpression} * 100.0) / ${activePrincipalLoadExpression}
        else 0
      end
    )::double precision
  `;
  const liveRecoveryRateExpression = sql<number>`
    (
      case
        when ${activeTotalPayableLoadExpression} > 0
          then (${activeCollectedExpression} * 100.0) / ${activeTotalPayableLoadExpression}
        else 0
      end
    )::double precision
  `;
  const efficiencyRatioExpression = sql<number>`
    (
      case
        when ${expectedCollectionsExpression} > 0
          then (${totalCollectedExpression} * 100.0) / ${expectedCollectionsExpression}
        else null
      end
    )::double precision
  `;
  const activeEfficiencyRatioExpression = sql<number>`
    (
      case
        when ${activeExpectedCollectionsExpression} > 0
          then (${activeCollectedExpression} * 100.0) / ${activeExpectedCollectionsExpression}
        else null
      end
    )::double precision
  `;
  const portfolioYieldRateExpression = sql<number>`
    (
      case
        when ${activePrincipalLoadExpression} > 0
          then (${activeInterestPotentialExpression} * 100.0) / ${activePrincipalLoadExpression}
        else null
      end
    )::double precision
  `;
  const portfolioAtRiskRateExpression = sql<number>`
    (
      case
        when ${activePrincipalLoadExpression} > 0
          then (${portfolioAtRiskAmountExpression} * 100.0) / ${activePrincipalLoadExpression}
        else null
      end
    )::double precision
  `;
  const periodChangePercentExpression = sql<number>`
    (
      case
        when ${previousTotalCollectedExpression} <= 0
          then case when ${totalCollectedExpression} > 0 then null else 0 end
        else ((${totalCollectedExpression} - ${previousTotalCollectedExpression}) * 100.0) / ${previousTotalCollectedExpression}
      end
    )::double precision
  `;

  const metricsBase = db
    .select({
      collectorId: baseCollectors.collectorId,
      fullName: baseCollectors.fullName,
      companyId: baseCollectors.companyId,
      roleName: sql<"Collector">`'Collector'`.as("role_name"),
      branchId: baseCollectors.branchId,
      branchName: baseCollectors.branchName,
      provinceName: baseCollectors.provinceName,
      areaId: baseCollectors.areaId,
      areaCode: baseCollectors.areaCode,
      areaLabel: baseCollectors.areaLabel,
      status: baseCollectors.status,
      contactNo: baseCollectors.contactNo,
      email: baseCollectors.email,
      dateCreated: baseCollectors.dateCreated,
      assignedActiveLoans: assignedActiveLoansExpression.as("assigned_active_loans"),
      activePrincipalLoad: activePrincipalLoadExpression.as("active_principal_load"),
      totalCollected: totalCollectedExpression.as("total_collected"),
      averageCollectionAmount: averageCollectionAmountExpression.as("average_collection_amount"),
      averageMonthlyCollections: averageMonthlyCollectionsExpression.as("average_monthly_collections"),
      expectedCollections: expectedCollectionsExpression.as("expected_collections"),
      efficiencyRatio: efficiencyRatioExpression.as("efficiency_ratio"),
      activeEfficiencyRatio: activeEfficiencyRatioExpression.as("active_efficiency_ratio"),
      productivityCount: collectionEntriesExpression.as("productivity_count"),
      completedLoans: completedLoansExpression.as("completed_loans"),
      missedPaymentCount: missedPaymentCountExpression.as("missed_payment_count"),
      missedPaymentRate: missedPaymentRateExpression.as("missed_payment_rate"),
      collectionEntries: collectionEntriesExpression.as("collection_entries"),
      borrowersHandledCount: borrowersHandledCountExpression.as("borrowers_handled_count"),
      collectionDays: collectionDaysExpression.as("collection_days"),
      activeWeeks: activeWeeksExpression.as("active_weeks"),
      completionRate: completionRateExpression.as("completion_rate"),
      consistencyScore: consistencyScoreExpression.as("consistency_score"),
      delinquencyControl: delinquencyControlExpression.as("delinquency_control"),
      portfolioRecoveryRate: portfolioRecoveryRateExpression.as("portfolio_recovery_rate"),
      liveRecoveryRate: liveRecoveryRateExpression.as("live_recovery_rate"),
      activeInterestPotential: activeInterestPotentialExpression.as("active_interest_potential"),
      portfolioYieldRate: portfolioYieldRateExpression.as("portfolio_yield_rate"),
      portfolioAtRiskAmount: portfolioAtRiskAmountExpression.as("portfolio_at_risk_amount"),
      portfolioAtRiskRate: portfolioAtRiskRateExpression.as("portfolio_at_risk_rate"),
      previousTotalCollected: previousTotalCollectedExpression.as("previous_total_collected"),
      periodChangePercent: periodChangePercentExpression.as("period_change_percent"),
    })
    .from(baseCollectors)
    .leftJoin(loanStats, eq(loanStats.collectorId, baseCollectors.collectorId))
    .leftJoin(currentCollectionStats, eq(currentCollectionStats.collectorId, baseCollectors.collectorId))
    .leftJoin(previousCollectionStats, eq(previousCollectionStats.collectorId, baseCollectors.collectorId))
    .as("collector_analytics_metrics_base");

  const metrics = isCollectorsSpecificPeriodSelection({
    range: filters.selectedRange,
    from: filters.fromRaw,
    to: filters.toRaw,
  })
    ? db
      .select()
      .from(metricsBase)
      .where(
        sql`${metricsBase.totalCollected} > 0 or ${metricsBase.expectedCollections} > 0 or ${metricsBase.productivityCount} > 0`,
      )
      .as("collector_analytics_metrics")
    : metricsBase;

  const primaryRankingMetric =
    filters.selectedBasis === "total-collected"
      ? metrics.totalCollected
      : metrics.averageMonthlyCollections;

  const performanceOrderSql = sql`
    ${primaryRankingMetric} desc,
    ${metrics.totalCollected} desc,
    ${metrics.productivityCount} desc,
    ${metrics.completedLoans} desc,
    ${metrics.assignedActiveLoans} desc,
    ${metrics.fullName} asc
  `;

  const rankedMetrics = db
    .select({
      collectorId: metrics.collectorId,
      fullName: metrics.fullName,
      companyId: metrics.companyId,
      roleName: metrics.roleName,
      branchId: metrics.branchId,
      branchName: metrics.branchName,
      provinceName: metrics.provinceName,
      areaId: metrics.areaId,
      areaCode: metrics.areaCode,
      areaLabel: metrics.areaLabel,
      status: metrics.status,
      contactNo: metrics.contactNo,
      email: metrics.email,
      dateCreated: metrics.dateCreated,
      assignedActiveLoans: metrics.assignedActiveLoans,
      activePrincipalLoad: metrics.activePrincipalLoad,
      totalCollected: metrics.totalCollected,
      averageCollectionAmount: metrics.averageCollectionAmount,
      averageMonthlyCollections: metrics.averageMonthlyCollections,
      expectedCollections: metrics.expectedCollections,
      efficiencyRatio: metrics.efficiencyRatio,
      activeEfficiencyRatio: metrics.activeEfficiencyRatio,
      productivityCount: metrics.productivityCount,
      completedLoans: metrics.completedLoans,
      missedPaymentCount: metrics.missedPaymentCount,
      missedPaymentRate: metrics.missedPaymentRate,
      collectionEntries: metrics.collectionEntries,
      collectionDays: metrics.collectionDays,
      activeWeeks: metrics.activeWeeks,
      completionRate: metrics.completionRate,
      consistencyScore: metrics.consistencyScore,
      delinquencyControl: metrics.delinquencyControl,
      portfolioRecoveryRate: metrics.portfolioRecoveryRate,
      liveRecoveryRate: metrics.liveRecoveryRate,
      activeInterestPotential: metrics.activeInterestPotential,
      portfolioYieldRate: metrics.portfolioYieldRate,
      portfolioAtRiskAmount: metrics.portfolioAtRiskAmount,
      portfolioAtRiskRate: metrics.portfolioAtRiskRate,
      nationwideRank: sql<number>`row_number() over(order by ${performanceOrderSql})::int`.as("nationwide_rank"),
      branchRank: sql<number>`
        row_number() over(
          partition by ${metrics.branchId}
          order by ${performanceOrderSql}
        )::int
      `.as("branch_rank"),
      visibleCollectorCount: sql<number>`count(*) over()::int`.as("visible_collector_count"),
      branchCollectorCount: sql<number>`count(*) over(partition by ${metrics.branchId})::int`.as("branch_collector_count"),
      previousTotalCollected: metrics.previousTotalCollected,
      periodChangePercent: metrics.periodChangePercent,
      rank: sql<number>`row_number() over(order by ${performanceOrderSql})::int`.as("rank"),
    })
    .from(metrics)
    .as("collector_analytics_ranked_metrics");

  return {
    baseCollectors,
    range,
    metrics,
    rankedMetrics,
  };
}

function chartGranularityForPeriod(periodKey: CollectorProfilePeriodKey) {
  return (
    periodKey === "this-year" ||
    periodKey === "past-3-months" ||
    periodKey === "past-6-months" ||
    periodKey === "lifetime" ||
    isCollectorProfileYearPeriod(periodKey)
  )
    ? "month"
    : "day";
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
  granularity: "day" | "week" | "month",
): Promise<CollectionTrendBucketRow[]> {
  const collectorIds = [collectorId];
  const bucketExpression =
    granularity === "day"
      ? sql<string>`${collections.collection_date}::text`
      : granularity === "week"
        ? sql<string>`to_char(date_trunc('week', ${collections.collection_date}), 'YYYY-MM-DD')`
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

export async function loadCollectorPerformanceRowsForCustomRange(
  access: AnalyticsAccess,
  params: {
    dateFrom: string;
    dateTo: string;
    collectorId?: string;
    includePrevious?: boolean;
    mode?: CollectorRowMode;
  },
) {
  return loadAllCollectorRows(
    access,
    {
      selectedBranchRaw: "all",
      selectedRange: "custom",
      fromRaw: params.dateFrom,
      toRaw: params.dateTo,
      searchQuery: "",
      selectedBasis: "average-monthly-collections",
      page: 1,
      pageSize: 10,
    },
    params.collectorId,
    {
      includePrevious: params.includePrevious,
      mode: params.mode,
    },
  );
}

export async function loadCollectorTrendBucketsForCustomRange(
  access: AnalyticsAccess,
  params: {
    collectorId: string;
    dateFrom: string;
    dateTo: string;
    granularity: "day" | "week" | "month";
  },
) {
  return loadCollectionTrendBuckets(
    access,
    params.collectorId,
    {
      start: params.dateFrom,
      end: params.dateTo,
      label: "custom range",
    },
    params.granularity,
  );
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

function buildCollectorProfilePeriodAvailability(
  rows: CollectionTrendBucketRow[],
  fallbackYear: number,
): CollectorProfilePeriodAvailability {
  const monthsByYear = new Map<number, Set<number>>();

  for (const row of rows) {
    if (!/^\d{4}-\d{2}-01$/.test(row.bucketKey)) {
      continue;
    }

    const year = Number(row.bucketKey.slice(0, 4));
    const month = Number(row.bucketKey.slice(5, 7));

    if (!Number.isInteger(year) || !Number.isInteger(month)) {
      continue;
    }

    const months = monthsByYear.get(year) ?? new Set<number>();
    months.add(month);
    monthsByYear.set(year, months);
  }

  if (monthsByYear.size === 0) {
    return {
      years: [fallbackYear],
      monthsByYear: {},
    };
  }

  const years = Array.from(monthsByYear.keys()).sort((left, right) => right - left);

  return {
    years,
    monthsByYear: Object.fromEntries(
      years.map((year) => [
        String(year),
        Array.from(monthsByYear.get(year) ?? []).sort((left, right) => left - right),
      ]),
    ),
  };
}

async function loadCollectorsPeriodAvailability(
  collectorIds: string[],
): Promise<CollectorProfilePeriodAvailability> {
  if (collectorIds.length === 0) {
    return {
      years: [],
      monthsByYear: {},
    };
  }

  const bucketExpression = sql<string>`to_char(date_trunc('month', ${collections.collection_date}), 'YYYY-MM-01')`;
  const rows = await db
    .select({
      bucketKey: bucketExpression,
      totalCollected: sql<number>`coalesce(sum(${collections.amount}), 0)`,
    })
    .from(collections)
    .where(inArray(collections.collector_id, collectorIds))
    .groupBy(bucketExpression)
    .orderBy(asc(bucketExpression))
    .catch(() => []);

  return buildCollectorProfilePeriodAvailability(
    rows.map((row) => ({
      bucketKey: row.bucketKey,
      totalCollected: toNumber(row.totalCollected),
    })),
    Number(getManilaTodayDateString().slice(0, 4)),
  );
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

function normalizeCollectorLeaderboardRow(row: CollectorLeaderboardRow): CollectorLeaderboardRow {
  return {
    ...row,
    assignedActiveLoans: toNumber(row.assignedActiveLoans),
    activePrincipalLoad: toNumber(row.activePrincipalLoad),
    totalCollected: toNumber(row.totalCollected),
    averageCollectionAmount: toNumber(row.averageCollectionAmount),
    averageMonthlyCollections: toNumber(row.averageMonthlyCollections),
    expectedCollections: toNumber(row.expectedCollections),
    efficiencyRatio: row.efficiencyRatio === null ? null : toNumber(row.efficiencyRatio),
    activeEfficiencyRatio: row.activeEfficiencyRatio === null ? null : toNumber(row.activeEfficiencyRatio),
    productivityCount: toNumber(row.productivityCount),
    completedLoans: toNumber(row.completedLoans),
    missedPaymentCount: toNumber(row.missedPaymentCount),
    missedPaymentRate: toNumber(row.missedPaymentRate),
    collectionEntries: toNumber(row.collectionEntries),
    borrowersHandledCount: toNumber(row.borrowersHandledCount),
    collectionDays: toNumber(row.collectionDays),
    activeWeeks: toNumber(row.activeWeeks),
    completionRate: toNumber(row.completionRate),
    consistencyScore: toNumber(row.consistencyScore),
    delinquencyControl: toNumber(row.delinquencyControl),
    portfolioRecoveryRate: toNumber(row.portfolioRecoveryRate),
    liveRecoveryRate: toNumber(row.liveRecoveryRate),
    activeInterestPotential: toNumber(row.activeInterestPotential),
    portfolioYieldRate: row.portfolioYieldRate === null ? null : toNumber(row.portfolioYieldRate),
    portfolioAtRiskAmount: toNumber(row.portfolioAtRiskAmount),
    portfolioAtRiskRate: row.portfolioAtRiskRate === null ? null : toNumber(row.portfolioAtRiskRate),
    nationwideRank: toNumber(row.nationwideRank),
    branchRank: toNumber(row.branchRank),
    visibleCollectorCount: toNumber(row.visibleCollectorCount),
    branchCollectorCount: toNumber(row.branchCollectorCount),
    previousTotalCollected: toNumber(row.previousTotalCollected),
    periodChangePercent: row.periodChangePercent === null ? null : toNumber(row.periodChangePercent),
    rank: toNumber(row.rank),
  };
}

function buildCollectorRadarMetrics(
  row: CollectorLeaderboardRow,
  maxima: CollectorRadarMaxima,
) {
  return [
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
  ];
}

function attachCollectorRadarMetrics(
  rows: CollectorLeaderboardRow[],
  maxima: CollectorRadarMaxima,
): CollectorPerformanceRow[] {
  return rows.map((rawRow) => {
    const row = normalizeCollectorLeaderboardRow(rawRow);

    return {
      ...row,
      radarMetrics: buildCollectorRadarMetrics(row, maxima),
    };
  });
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
    const assignedActiveLoans = loanStats?.assignedActiveLoans ?? 0;
    const activePrincipalLoad = loanStats?.activePrincipalLoad ?? 0;
    const activeInterestPotential = loanStats?.activeInterestPotential ?? 0;
    const portfolioAtRiskAmount = loanStats?.portfolioAtRiskAmount ?? 0;
    const completedLoans = loanStats?.completedLoans ?? 0;
    const totalLoans = loanStats?.totalLoans ?? 0;
    const expectedCollections = loanStats?.expectedCollections ?? 0;
    const activeExpectedCollections = loanStats?.activeExpectedCollections ?? 0;
    const totalCollected = collectionStats?.totalCollected ?? 0;
    const activeCollected = loanStats?.activeCollected ?? 0;
    const previousTotalCollected = previousCollectionStats?.totalCollected ?? 0;
    const averageCollectionAmount = collectionStats?.averageCollectionAmount ?? 0;
    const activeCollectionMonths =
      collectionStats?.firstCollectionDate && collectionStats?.lastCollectionDate
        ? Math.max(
            monthsBetweenInclusive(
              collectionStats.firstCollectionDate,
              collectionStats.lastCollectionDate,
            ),
            1,
          )
        : 0;
    const averageMonthlyCollections =
      totalCollected > 0 && activeCollectionMonths > 0
        ? totalCollected / activeCollectionMonths
        : 0;
    const collectionEntries = collectionStats?.collectionEntries ?? 0;
    const borrowersHandledCount = collectionStats?.borrowersHandledCount ?? 0;
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
    const activeTotalPayableLoad = activePrincipalLoad + activeInterestPotential;
    const liveRecoveryRate = percentOf(activeCollected, activeTotalPayableLoad) ?? 0;
    const activeEfficiencyRatio = percentOf(activeCollected, activeExpectedCollections);
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
      provinceName: row.provinceName,
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
      activeEfficiencyRatio,
      productivityCount,
      completedLoans,
      missedPaymentCount,
      missedPaymentRate,
      collectionEntries,
      borrowersHandledCount,
      collectionDays,
      activeWeeks,
      completionRate,
      consistencyScore,
      delinquencyControl,
      portfolioRecoveryRate,
      liveRecoveryRate,
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

  return sorted.map((row, index) => {
    const rankedRow: CollectorLeaderboardRow = {
      ...row,
      nationwideRank: index + 1,
      branchRank: branchRanks.get(`${row.branchId}:${row.collectorId}`) ?? index + 1,
      visibleCollectorCount: totalVisibleCollectors,
      branchCollectorCount: branchCollectorCounts.get(row.branchId) ?? 1,
      rank: index + 1,
    };

    return {
      ...rankedRow,
      radarMetrics: buildCollectorRadarMetrics(rankedRow, maxima),
    };
  });
}

function takeTrendValues(rows: CollectorLeaderboardRow[], selector: (row: CollectorLeaderboardRow) => number) {
  const values = rows.slice(0, 7).map((row) => selector(row));
  return values.length > 0 ? values : [0];
}

function buildOutputChart(rows: CollectorLeaderboardRow[]): AnalyticsChartModel {
  const chartRows = rows.slice(0, 10).map((row) => ({
    bucket: `#${row.rank}`,
    values: {
      actualCollected: row.totalCollected,
      expectedCollected: row.expectedCollections,
    },
  }));

  return {
    rows: chartRows,
    series: [
      { key: "actualCollected", label: "Actual Collected", color: "#16a34a" },
      { key: "expectedCollected", label: "Expected Collected", color: "#0ea5e9" },
    ],
    noData: chartRows.length === 0,
  };
}

function buildExecutionChart(rows: CollectorLeaderboardRow[]): AnalyticsChartModel {
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

function buildTopPerformers(rows: CollectorLeaderboardRow[]): CollectorsTopPerformerItem[] {
  return rows.slice(0, 3).map((row) => ({
    collectorId: row.collectorId,
    fullName: row.fullName,
    companyId: row.companyId,
    branchName: row.branchName,
    provinceName: row.provinceName,
    areaLabel: row.areaLabel,
    totalCollected: row.totalCollected,
    completedLoans: row.completedLoans,
    assignedActiveLoans: row.assignedActiveLoans,
    rank: row.rank,
  }));
}

function buildComparisonRows(rows: CollectorLeaderboardRow[]): CollectorsComparisonItem[] {
  return rows
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

function buildExecutionRows(rows: CollectorLeaderboardRow[]): CollectorsExecutionItem[] {
  return rows
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
  const { baseCollectors, metrics, rankedMetrics, range } = buildCollectorAnalyticsMetricsSubqueries(access, filters);
  const availabilityCollectorIds = await db
    .select({ collectorId: baseCollectors.collectorId })
    .from(baseCollectors)
    .then((rows) => rows.map((row) => row.collectorId).filter(Boolean))
    .catch(() => []);
  const pageSize = filters.pageSize || COLLECTORS_PAGE_SIZE;
  let summaryQueryError: string | null = null;
  const summaryRow = await db
    .select({
      totalCount: sql<number>`count(*)::int`,
      totalCollectionsAttributed: sql<number>`coalesce(sum(${metrics.totalCollected}), 0)::double precision`,
      previousTotalCollectionsAttributed: sql<number>`
        coalesce(sum(${metrics.previousTotalCollected}), 0)::double precision
      `,
      averagePortfolioRecoveryRate: sql<number>`
        coalesce(avg(${metrics.portfolioRecoveryRate}), 0)::double precision
      `,
      maxTotalCollected: sql<number>`coalesce(max(${metrics.totalCollected}), 0)::double precision`,
      maxCompletionRate: sql<number>`coalesce(max(${metrics.completionRate}), 0)::double precision`,
      maxConsistencyScore: sql<number>`coalesce(max(${metrics.consistencyScore}), 0)::double precision`,
      maxAverageMonthlyCollections: sql<number>`
        coalesce(max(${metrics.averageMonthlyCollections}), 0)::double precision
      `,
      maxPortfolioRecoveryRate: sql<number>`
        coalesce(max(${metrics.portfolioRecoveryRate}), 0)::double precision
      `,
      maxDelinquencyControl: sql<number>`coalesce(max(${metrics.delinquencyControl}), 0)::double precision`,
    })
    .from(metrics)
    .then((rows) => rows[0])
    .catch((error) => {
      summaryQueryError = error instanceof Error ? error.message : String(error);
      return undefined;
    });
  const totalCount = toNumber(summaryRow?.totalCount);
  if (totalCount === 0) {
    await logCollectorsAnalyticsDebug({
      access,
      filters,
      totalCount,
      summaryQueryFailed: !summaryRow,
      summaryQueryError,
      baseCollectors,
    });
  }
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
  const page = Math.min(Math.max(filters.page, 1), totalPages);
  const offset = (page - 1) * pageSize;
  const [
    rawPageRows,
    rawOrderedRows,
    rawComparisonRows,
    rawExecutionRows,
    rawHighestPortfolioRows,
    rawBestRecoveryRows,
    periodAvailability,
  ] = await Promise.all([
    db
      .select()
      .from(rankedMetrics)
      .orderBy(asc(rankedMetrics.rank))
      .limit(pageSize)
      .offset(offset)
      .catch(() => []),
    db
      .select()
      .from(rankedMetrics)
      .orderBy(asc(rankedMetrics.rank))
      .limit(10)
      .catch(() => []),
    db
      .select()
      .from(rankedMetrics)
      .orderBy(
        desc(rankedMetrics.assignedActiveLoans),
        desc(rankedMetrics.totalCollected),
        asc(rankedMetrics.fullName),
      )
      .limit(6)
      .catch(() => []),
    db
      .select()
      .from(rankedMetrics)
      .orderBy(
        sql`(${rankedMetrics.completionRate} + ${rankedMetrics.consistencyScore} + ${rankedMetrics.delinquencyControl}) desc`,
        desc(rankedMetrics.totalCollected),
        asc(rankedMetrics.fullName),
      )
      .limit(6)
      .catch(() => []),
    db
      .select()
      .from(rankedMetrics)
      .orderBy(
        desc(rankedMetrics.assignedActiveLoans),
        desc(rankedMetrics.totalCollected),
        asc(rankedMetrics.fullName),
      )
      .limit(1)
      .catch(() => []),
    db
      .select()
      .from(rankedMetrics)
      .where(sql`${rankedMetrics.activePrincipalLoad} > 0`)
      .orderBy(
        desc(rankedMetrics.portfolioRecoveryRate),
        desc(rankedMetrics.totalCollected),
        asc(rankedMetrics.fullName),
      )
      .limit(1)
      .catch(() => []),
    loadCollectorsPeriodAvailability(availabilityCollectorIds),
  ]);
  const maxima: CollectorRadarMaxima = {
    totalCollected: toNumber(summaryRow?.maxTotalCollected),
    completionRate: toNumber(summaryRow?.maxCompletionRate),
    consistencyScore: toNumber(summaryRow?.maxConsistencyScore),
    averageMonthlyCollections: toNumber(summaryRow?.maxAverageMonthlyCollections),
    portfolioRecoveryRate: toNumber(summaryRow?.maxPortfolioRecoveryRate),
    delinquencyControl: toNumber(summaryRow?.maxDelinquencyControl),
  };
  const rows = attachCollectorRadarMetrics(rawPageRows as CollectorLeaderboardRow[], maxima);
  const orderedRows = attachCollectorRadarMetrics(rawOrderedRows as CollectorLeaderboardRow[], maxima);
  const comparisonRows = (rawComparisonRows as CollectorLeaderboardRow[]).map(normalizeCollectorLeaderboardRow);
  const executionRows = (rawExecutionRows as CollectorLeaderboardRow[]).map(normalizeCollectorLeaderboardRow);
  const highestPortfolio = rawHighestPortfolioRows[0]
    ? normalizeCollectorLeaderboardRow(rawHighestPortfolioRows[0] as CollectorLeaderboardRow)
    : undefined;
  const bestRecovery = rawBestRecoveryRows[0]
    ? normalizeCollectorLeaderboardRow(rawBestRecoveryRows[0] as CollectorLeaderboardRow)
    : undefined;
  const totalCollectionsAttributed = toNumber(summaryRow?.totalCollectionsAttributed);
  const previousTotalCollectionsAttributed = toNumber(summaryRow?.previousTotalCollectionsAttributed);
  const activeCollectors = totalCount;
  const averagePortfolioRecoveryRate = toNumber(summaryRow?.averagePortfolioRecoveryRate);
  const totalCollectionsChangePercent = percentChange(totalCollectionsAttributed, previousTotalCollectionsAttributed);
  const topCollector = orderedRows[0];
  const focusedCollectorProfileData = totalCount === 1 && rows[0]
      ? await (async () => {
        const profilePeriodKey = mapLeaderboardRangeToProfilePeriod({
          rangeKey: filters.selectedRange,
          fromRaw: filters.fromRaw,
          toRaw: filters.toRaw,
        });

        if (!profilePeriodKey) {
          return null;
        }

        return loadCollectorProfileData(access, rows[0].collectorId, profilePeriodKey);
      })()
    : null;

  return {
    filters: {
      ...filters,
      page,
    },
    dateRangeLabel: range.label,
    periodAvailability,
    summary: {
      activeCollectors,
      totalCollectionsAttributed,
      totalCollectionsChangePercent,
      averagePortfolioRecoveryRate,
      topCollectorName: topCollector?.fullName ?? "No collector data",
      topCollectorAmount: topCollector?.totalCollected ?? 0,
    },
    summaryTrends: {
      activeCollectors: takeTrendValues(orderedRows, (row) => row.assignedActiveLoans),
      totalCollectionsAttributed: takeTrendValues(orderedRows, (row) => row.totalCollected),
      averagePortfolioRecoveryRate: takeTrendValues(orderedRows, (row) => row.portfolioRecoveryRate),
      topCollector: takeTrendValues(orderedRows, (row) => row.totalCollected),
    },
    rows,
    topPerformers: buildTopPerformers(orderedRows),
    comparison: buildComparisonRows(comparisonRows),
    execution: buildExecutionRows(executionRows),
    outputChart: buildOutputChart(orderedRows),
    executionChart: buildExecutionChart(orderedRows),
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
    focusedCollectorProfileData,
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
  const [periodResult, lifetimeResult, periodPortfolioStats, loanPortfolio, periodTrendRows, lifetimeTrendRows] = await Promise.all([
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
    loadCollectorLoanPortfolioCounts(access, collectorId),
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
  const fallbackAvailabilityYear = Number(periodRow.dateCreated?.slice(0, 4)) || Number(getManilaTodayDateString().slice(0, 4));
  const periodAvailability = buildCollectorProfilePeriodAvailability(
    lifetimeTrendRows,
    fallbackAvailabilityYear,
  );

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
    activeEfficiencyRatio: periodRow.activeEfficiencyRatio,
    productivityCount: periodRow.productivityCount,
    assignedActiveLoans: periodRow.assignedActiveLoans,
    completedLoans: periodRow.completedLoans,
    missedPaymentCount: periodRow.missedPaymentCount,
    missedPaymentRate: periodRow.missedPaymentRate,
    collectionEntries: periodRow.collectionEntries,
    borrowersHandledCount: periodRow.borrowersHandledCount,
    collectionDays: periodRow.collectionDays,
    activeWeeks: periodRow.activeWeeks,
    completionRate,
    consistencyScore: periodRow.consistencyScore,
    delinquencyControl: periodRow.delinquencyControl,
    portfolioRecoveryRate,
    liveRecoveryRate: periodRow.liveRecoveryRate,
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
    loanPortfolio,
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
    periodAvailability,
  };
}

export async function loadCollectorAssignedLoansData(
  access: AnalyticsAccess,
  collectorId: string,
  filters: CollectorAssignedLoansFilters,
): Promise<CollectorAssignedLoansData> {
  const filterConditions = buildCollectorAssignedLoansFilters(access, collectorId, filters);
  filterConditions.push(
    notInArray(
      loan_records.status,
      [...COLLECTOR_ASSIGNED_LOAN_ARCHIVED_STORED_VALUES],
    ),
  );
  const visibleStatusWhere = buildCollectorAssignedLoanVisibleStatusWhere(filters.status);
  if (visibleStatusWhere) {
    filterConditions.push(visibleStatusWhere);
  }
  const whereCondition = whereFrom(filterConditions);
  const requestedPage = Math.max(filters.page, 1);
  const totalCount = await db
    .select({ value: sql<number>`count(*)` })
    .from(loan_records)
    .innerJoin(borrowerUsers, eq(borrowerUsers.user_id, loan_records.borrower_id))
    .leftJoin(borrower_info, eq(borrower_info.user_id, loan_records.borrower_id))
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
      total_collected: sql<number>`coalesce(${collectorAssignedLoanCollectionStats.totalCollected}, 0)`,
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
    .leftJoin(collectorAssignedLoanCollectionStats, eq(collectorAssignedLoanCollectionStats.loanId, loan_records.loan_id))
    .where(whereCondition)
    .orderBy(desc(loan_records.loan_id))
    .limit(COLLECTOR_ASSIGNED_LOANS_PAGE_SIZE)
    .offset(offset)
    .catch(() => []);

  const pagedRows = rows.map((row) => toCollectorLoanListRow(row));

  return {
    loans: pagedRows,
    page,
    pageSize: COLLECTOR_ASSIGNED_LOANS_PAGE_SIZE,
    totalCount,
  };
}
