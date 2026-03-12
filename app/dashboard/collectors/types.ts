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

export type CollectorProfilePeriodKey =
  | "this-month"
  | "last-30-days"
  | "this-year"
  | "lifetime";

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
  description: string;
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
  activePrincipalLoad: number;
  totalCollected: number;
  averageCollectionAmount: number;
  averageMonthlyCollections: number;
  expectedCollections: number;
  efficiencyRatio: number | null;
  productivityCount: number;
  completedLoans: number;
  missedPaymentCount: number;
  missedPaymentRate: number;
  collectionEntries: number;
  collectionDays: number;
  activeWeeks: number;
  completionRate: number;
  consistencyScore: number;
  delinquencyControl: number;
  portfolioRecoveryRate: number;
  activeInterestPotential: number;
  portfolioYieldRate: number | null;
  portfolioAtRiskAmount: number;
  portfolioAtRiskRate: number | null;
  nationwideRank: number;
  branchRank: number;
  visibleCollectorCount: number;
  branchCollectorCount: number;
  previousTotalCollected: number;
  periodChangePercent: number | null;
  rank: number;
  radarMetrics: CollectorRadarMetric[];
};

export type CollectorsSummaryStats = {
  activeCollectors: number;
  totalCollectionsAttributed: number;
  totalCollectionsChangePercent: number | null;
  averagePortfolioRecoveryRate: number;
  topCollectorName: string;
  topCollectorAmount: number;
};

export type CollectorsSummaryTrends = {
  activeCollectors: number[];
  totalCollectionsAttributed: number[];
  averagePortfolioRecoveryRate: number[];
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
  activePrincipalLoad: number;
  totalCollected: number;
  portfolioRecoveryRate: number;
};

export type CollectorsExecutionItem = {
  collectorId: string;
  fullName: string;
  rank: number;
  completionRate: number;
  consistencyScore: number;
  delinquencyControl: number;
  missedPaymentRate: number;
  periodChangePercent: number | null;
  collectionDays: number;
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
  periodKey: CollectorProfilePeriodKey;
  periodLabel: string;
  status: string;
  rank: number;
  periodPortfolioPrincipal: number;
  periodInterestPotential: number;
  periodPortfolioAtRiskAmount: number;
  periodDueLoans: number;
  periodCompletedLoans: number;
  activePrincipalLoad: number;
  totalCollected: number;
  averageCollectionAmount: number;
  averageMonthlyCollections: number;
  expectedCollections: number;
  efficiencyRatio: number | null;
  productivityCount: number;
  assignedActiveLoans: number;
  completedLoans: number;
  missedPaymentCount: number;
  missedPaymentRate: number;
  collectionEntries: number;
  collectionDays: number;
  activeWeeks: number;
  completionRate: number;
  consistencyScore: number;
  delinquencyControl: number;
  portfolioRecoveryRate: number;
  activeInterestPotential: number;
  portfolioYieldRate: number | null;
  portfolioAtRiskAmount: number;
  portfolioAtRiskRate: number | null;
  nationwideRank: number;
  branchRank: number;
  visibleCollectorCount: number;
  branchCollectorCount: number;
  previousTotalCollected: number;
  periodChangePercent: number | null;
  radarMetrics: CollectorRadarMetric[];
  lifetimeMetrics: {
    lifetimeCollectionAmount: number;
    lifetimeAverageMonthlyCollection: number;
    lifetimeAverageCollectedPerDay: number;
    lifetimeAverageAmountPerCollection: number;
    lifetimeMissedPaymentRatio: number;
    lifetimeCollectionEntries: number;
    lifetimeCollectionDays: number;
  };
  periodTrendChart: AnalyticsChartModel;
  lifetimeTrendChart: AnalyticsChartModel;
  outputComparisonChart: AnalyticsChartModel;
  rateComparisonChart: AnalyticsChartModel;
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
