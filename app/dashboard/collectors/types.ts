import type { DashboardAuthContext } from "@/app/dashboard/auth";
import type { AnalyticsChartModel, AnalyticsDateRangeKey, AnalyticsSelectOption } from "@/components/analytics/types";

export type CollectorsPageProps = {
  searchParams?: Promise<{
    branch?: string;
    range?: string;
    from?: string;
    to?: string;
    query?: string;
    page?: string;
  }>;
};

export type CollectorsFilterState = {
  selectedBranchRaw: string;
  selectedRange: AnalyticsDateRangeKey;
  fromRaw: string;
  toRaw: string;
  searchQuery: string;
  page: number;
};

export type CollectorsFilterInput = {
  branch: string;
  range: AnalyticsDateRangeKey;
  from: string;
  to: string;
  query: string;
  page: number;
};

export type CollectorsDateRange = {
  start: string;
  end: string;
  label: string;
};

export type CollectorsAccessState =
  | {
      view: "analytics";
      roleName: DashboardAuthContext["roleName"];
      allowedBranchIds: number[];
      selectedBranchId: number | null;
      canChooseBranch: boolean;
      branchFilterLabel: string;
      fixedBranchName: string | null;
    }
  | {
      view: "forbidden";
      message: string;
    };

export type CollectorRadarMetric = {
  label: string;
  value: number;
};

export type CollectorPerformanceRow = {
  collectorId: string;
  fullName: string;
  companyId: string;
  branchId: number;
  branchName: string;
  areaId: number;
  areaLabel: string;
  status: string;
  assignedActiveLoans: number;
  totalCollected: number;
  averageCollectionAmount: number;
  averageMonthlyCollections: number;
  completedLoans: number;
  missedPaymentCount: number;
  collectionEntries: number;
  collectionDays: number;
  completionRate: number;
  consistencyScore: number;
  delinquencyControl: number;
  rank: number;
  radarMetrics: CollectorRadarMetric[];
};

export type CollectorsSummaryStats = {
  activeCollectors: number;
  totalCollectionsAttributed: number;
  averageCollectionsPerCollector: number;
  topCollectorName: string;
  topCollectorAmount: number;
};

export type CollectorsSummaryTrends = {
  activeCollectors: number[];
  totalCollectionsAttributed: number[];
  averageCollectionsPerCollector: number[];
  topCollector: number[];
};

export type CollectorsTopPerformerItem = {
  collectorId: string;
  fullName: string;
  branchName: string;
  areaLabel: string;
  totalCollected: number;
  completedLoans: number;
  assignedActiveLoans: number;
  rank: number;
};

export type CollectorsComparisonItem = {
  collectorId: string;
  fullName: string;
  branchName: string;
  areaLabel: string;
  rank: number;
  assignedActiveLoans: number;
  totalCollected: number;
};

export type CollectorsExecutionItem = {
  collectorId: string;
  fullName: string;
  rank: number;
  completionRate: number;
  consistencyScore: number;
  delinquencyControl: number;
};

export type CollectorsInsightCard = {
  eyebrow: string;
  title: string;
  description: string;
};

export type CollectorProfileData = {
  collectorId: string;
  fullName: string;
  companyId: string;
  branchName: string;
  areaLabel: string;
  status: string;
  rank: number;
  totalCollected: number;
  averageCollectionAmount: number;
  averageMonthlyCollections: number;
  assignedActiveLoans: number;
  completedLoans: number;
  missedPaymentCount: number;
  collectionEntries: number;
  collectionDays: number;
  completionRate: number;
  consistencyScore: number;
  delinquencyControl: number;
  radarMetrics: CollectorRadarMetric[];
};

export type CollectorsAnalyticsData = {
  filters: CollectorsFilterState;
  dateRangeLabel: string;
  summary: CollectorsSummaryStats;
  summaryTrends: CollectorsSummaryTrends;
  rows: CollectorPerformanceRow[];
  topPerformers: CollectorsTopPerformerItem[];
  comparison: CollectorsComparisonItem[];
  execution: CollectorsExecutionItem[];
  outputChart: AnalyticsChartModel;
  executionChart: AnalyticsChartModel;
  insight: CollectorsInsightCard;
  page: number;
  pageSize: number;
  totalCount: number;
};

export type CollectorsBranchOption = AnalyticsSelectOption;
