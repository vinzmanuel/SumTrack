import "server-only";

import {
  and,
  asc,
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
  collections,
  employee_area_assignment,
  employee_info,
  loan_records,
  roles,
  users,
  branch,
} from "@/db/schema";
import { resolveCollectorsDateRange } from "@/app/dashboard/collectors/filters";
import type {
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

type AnalyticsAccess = Extract<CollectorsAccessState, { view: "analytics" }>;

const COLLECTORS_PAGE_SIZE = 12;

type BaseCollectorRow = {
  collectorId: string;
  companyId: string;
  username: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  branchId: number;
  branchName: string;
  areaId: number;
  areaNo: string;
  areaCode: string;
};

type LoanStatsRow = {
  collectorId: string | null;
  assignedActiveLoans: number;
  completedLoans: number;
  totalLoans: number;
};

type CollectionStatsRow = {
  collectorId: string | null;
  totalCollected: number;
  averageCollectionAmount: number;
  collectionEntries: number;
  missedPaymentCount: number;
  collectionDays: number;
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

function fullNameOf(row: { firstName: string | null; middleName?: string | null; lastName: string | null; username?: string | null; collectorId?: string }) {
  const middleInitial = row.middleName?.trim() ? `${row.middleName.trim().charAt(0)}.` : "";
  const name = [row.firstName, middleInitial, row.lastName].filter(Boolean).join(" ").trim();
  return name || row.username || row.collectorId || "Unknown Collector";
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

async function loadLoanStats(access: AnalyticsAccess, collectorIds: string[]): Promise<Map<string, LoanStatsRow>> {
  if (collectorIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      collectorId: loan_records.collector_id,
      assignedActiveLoans: sql<number>`sum(case when ${loan_records.status} in ('Active', 'Overdue') then 1 else 0 end)`,
      completedLoans: sql<number>`sum(case when ${loan_records.status} = 'Completed' then 1 else 0 end)`,
      totalLoans: sql<number>`count(*)`,
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
      completedLoans: toNumber(row.completedLoans),
      totalLoans: toNumber(row.totalLoans),
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
    });
  }

  return result;
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

function buildCollectorRows(
  baseRows: BaseCollectorRow[],
  loanStatsMap: Map<string, LoanStatsRow>,
  collectionStatsMap: Map<string, CollectionStatsRow>,
  range: CollectorsDateRange,
): CollectorPerformanceRow[] {
  const visibleDays = daysInRange(range);
  const visibleMonths = Math.max(visibleDays / 30.4375, 0.25);

  const combined = baseRows.map((row) => {
    const loanStats = loanStatsMap.get(row.collectorId);
    const collectionStats = collectionStatsMap.get(row.collectorId);
    const assignedActiveLoans = loanStats?.assignedActiveLoans ?? 0;
    const completedLoans = loanStats?.completedLoans ?? 0;
    const totalLoans = loanStats?.totalLoans ?? 0;
    const totalCollected = collectionStats?.totalCollected ?? 0;
    const averageCollectionAmount = collectionStats?.averageCollectionAmount ?? 0;
    const averageMonthlyCollections = totalCollected > 0 ? totalCollected / visibleMonths : 0;
    const collectionEntries = collectionStats?.collectionEntries ?? 0;
    const missedPaymentCount = collectionStats?.missedPaymentCount ?? 0;
    const collectionDays = collectionStats?.collectionDays ?? 0;
    const completionRate = totalLoans > 0 ? (completedLoans / totalLoans) * 100 : 0;
    const consistencyScore = Math.min((collectionDays / visibleDays) * 100, 100);
    const missedRate = collectionEntries > 0 ? (missedPaymentCount / collectionEntries) * 100 : 100;
    const delinquencyControl = Math.max(0, 100 - missedRate);

    return {
      collectorId: row.collectorId,
      fullName: fullNameOf(row),
      companyId: row.companyId,
      branchId: row.branchId,
      branchName: row.branchName,
      areaId: row.areaId,
      areaLabel: `Area ${row.areaNo} (${row.areaCode})`,
      status: "Active",
      assignedActiveLoans,
      totalCollected,
      averageCollectionAmount,
      averageMonthlyCollections,
      completedLoans,
      missedPaymentCount,
      collectionEntries,
      collectionDays,
      completionRate,
      consistencyScore,
      delinquencyControl,
      rank: 0,
      radarMetrics: [],
    };
  });

  const sorted = combined.sort((left, right) => {
    if (right.totalCollected !== left.totalCollected) {
      return right.totalCollected - left.totalCollected;
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
    assignedActiveLoans: Math.max(...sorted.map((row) => row.assignedActiveLoans), 0),
    averageCollectionAmount: Math.max(...sorted.map((row) => row.averageCollectionAmount), 0),
    averageMonthlyCollections: Math.max(...sorted.map((row) => row.averageMonthlyCollections), 0),
    delinquencyControl: Math.max(...sorted.map((row) => row.delinquencyControl), 0),
  };

  return sorted.map((row, index) => ({
    ...row,
    rank: index + 1,
    radarMetrics: [
      {
        label: "Collection Volume",
        value: maxima.totalCollected > 0 ? (row.totalCollected / maxima.totalCollected) * 100 : 0,
      },
      {
        label: "Completion Rate",
        value: maxima.completionRate > 0 ? (row.completionRate / maxima.completionRate) * 100 : 0,
      },
      {
        label: "Consistency",
        value: maxima.consistencyScore > 0 ? (row.consistencyScore / maxima.consistencyScore) * 100 : 0,
      },
      {
        label: "Portfolio Load",
        value: maxima.assignedActiveLoans > 0 ? (row.assignedActiveLoans / maxima.assignedActiveLoans) * 100 : 0,
      },
      {
        label: "Average Collection Size",
        value:
          maxima.averageCollectionAmount > 0
            ? (row.averageCollectionAmount / maxima.averageCollectionAmount) * 100
            : 0,
      },
      {
        label: "Delinquency Control",
        value: maxima.delinquencyControl > 0 ? (row.delinquencyControl / maxima.delinquencyControl) * 100 : 0,
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
      averageCollectionAmount: row.averageCollectionAmount,
      averageMonthlyCollections: row.averageMonthlyCollections,
    },
  }));

  return {
    rows: chartRows,
    series: [
      { key: "totalCollected", label: "Total Collected", color: "#16a34a" },
      { key: "averageCollectionAmount", label: "Average Collection", color: "#0f766e" },
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
      totalCollected: row.totalCollected,
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
    }));
}

async function loadAllCollectorRows(
  access: AnalyticsAccess,
  filters: CollectorsFilterState,
  collectorId?: string,
) {
  const range = resolveCollectorsDateRange(filters);
  const baseRows = await loadCollectorBaseRows(access, filters, collectorId);
  const collectorIds = baseRows.map((row) => row.collectorId);
  const [loanStatsMap, collectionStatsMap] = await Promise.all([
    loadLoanStats(access, collectorIds),
    loadCollectionStats(access, collectorIds, range),
  ]);

  return {
    range,
    rows: buildCollectorRows(baseRows, loanStatsMap, collectionStatsMap, range),
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
  const activeCollectors = rows.length;
  const averageCollectionsPerCollector =
    activeCollectors > 0 ? totalCollectionsAttributed / activeCollectors : 0;
  const topCollector = rows[0];
  const highestPortfolio = [...rows].sort((left, right) => {
    if (right.assignedActiveLoans !== left.assignedActiveLoans) {
      return right.assignedActiveLoans - left.assignedActiveLoans;
    }
    return right.totalCollected - left.totalCollected;
  })[0];
  const bestAverage = [...rows]
    .filter((row) => row.collectionEntries > 0)
    .sort((left, right) => right.averageCollectionAmount - left.averageCollectionAmount)[0];

  return {
    filters: {
      ...filters,
      page,
    },
    dateRangeLabel: range.label,
    summary: {
      activeCollectors,
      totalCollectionsAttributed,
      averageCollectionsPerCollector,
      topCollectorName: topCollector?.fullName ?? "No collector data",
      topCollectorAmount: topCollector?.totalCollected ?? 0,
    },
    summaryTrends: {
      activeCollectors: takeTrendValues(rows, (row) => row.assignedActiveLoans),
      totalCollectionsAttributed: takeTrendValues(rows, (row) => row.totalCollected),
      averageCollectionsPerCollector: takeTrendValues(rows, (row) => row.averageCollectionAmount),
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
          eyebrow: "Top collector",
          title: `${topCollector.fullName} is setting the pace`,
          description: `${topCollector.fullName} leads ${range.label.toLowerCase()} with \u20B1${topCollector.totalCollected.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}. ${highestPortfolio ? `${highestPortfolio.fullName} is carrying the heaviest live portfolio at ${highestPortfolio.assignedActiveLoans.toLocaleString("en-PH")} active loans.` : ""}${bestAverage ? ` ${bestAverage.fullName} is posting the strongest average collection size.` : ""}`,
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
  filters: CollectorsFilterState,
  collectorId: string,
): Promise<CollectorProfileData | null> {
  const { rows } = await loadAllCollectorRows(access, { ...filters, page: 1 });
  const row = rows.find((item) => item.collectorId === collectorId);

  if (!row) {
    return null;
  }

  return {
    collectorId: row.collectorId,
    fullName: row.fullName,
    companyId: row.companyId,
    branchName: row.branchName,
    areaLabel: row.areaLabel,
    status: row.status,
    rank: row.rank,
    totalCollected: row.totalCollected,
    averageCollectionAmount: row.averageCollectionAmount,
    averageMonthlyCollections: row.averageMonthlyCollections,
    assignedActiveLoans: row.assignedActiveLoans,
    completedLoans: row.completedLoans,
    missedPaymentCount: row.missedPaymentCount,
    collectionEntries: row.collectionEntries,
    collectionDays: row.collectionDays,
    completionRate: row.completionRate,
    consistencyScore: row.consistencyScore,
    delinquencyControl: row.delinquencyControl,
    radarMetrics: row.radarMetrics,
  };
}
