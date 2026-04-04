import type { DashboardAuthContext } from "@/app/dashboard/auth";
import type {
  AnalyticsChartModel,
  AnalyticsDateRangeKey,
  AnalyticsSelectOption,
} from "@/components/analytics/types";

export type CollectionsPageProps = {
  searchParams?: Promise<{
    branch?: string;
    range?: string;
    from?: string;
    to?: string;
  }>;
};

export type CollectionsFilterState = {
  selectedBranchRaw: string;
  selectedRange: AnalyticsDateRangeKey;
  fromRaw: string;
  toRaw: string;
};

export type CollectionsFilterInput = {
  branch: string;
  range: AnalyticsDateRangeKey;
  from: string;
  to: string;
};

export type CollectionsDateRange = {
  start: string;
  end: string;
  label: string;
  granularity: "day" | "month";
};

export type CollectionsAnalyticsAccessState =
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

export type CollectionsSummaryStats = {
  totalAmount: number;
  principalRecovered: number;
  realizedInterest: number;
  totalEntries: number;
  averageAmount: number;
  missedPayments: number;
  missedPaymentRate: number;
  activeCollectionDays: number;
  averagePerActiveDay: number;
};

export type CollectionsComparisonItem = {
  label: string;
  totalAmount: number;
  principalRecovered: number;
  realizedInterest: number;
  entryCount: number;
  missedPayments: number;
  missedPaymentRate: number;
};

export type CollectionsComparisonData = {
  mode: "branch" | "weekday";
  title: string;
  description: string;
  items: CollectionsComparisonItem[];
  emptyMessage: string;
};

export type CollectionsAnalyticsData = {
  filters: CollectionsFilterState;
  dateRangeLabel: string;
  summary: CollectionsSummaryStats;
  compositionTrend: AnalyticsChartModel;
  missedPaymentsTrend: AnalyticsChartModel;
  comparison: CollectionsComparisonData;
};

export type CollectionsBranchOption = AnalyticsSelectOption;
