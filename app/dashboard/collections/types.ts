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
  totalEntries: number;
  averageAmount: number;
  missedPayments: number;
};

export type CollectionsRankedItem = {
  label: string;
  value: number;
  secondaryValue: number;
};

export type CollectionsRankedCardData = {
  title: string;
  description: string;
  valueLabel: string;
  secondaryLabel: string;
  items: CollectionsRankedItem[];
  emptyMessage: string;
};

export type CollectionsInsightCard = {
  eyebrow: string;
  title: string;
  description: string;
};

export type CollectionsAnalyticsData = {
  filters: CollectionsFilterState;
  dateRangeLabel: string;
  summary: CollectionsSummaryStats;
  collectionsTrend: AnalyticsChartModel;
  missedPaymentsTrend: AnalyticsChartModel;
  comparison: CollectionsRankedCardData;
  breakdown: CollectionsRankedCardData;
  insight: CollectionsInsightCard;
};

export type CollectionsBranchOption = AnalyticsSelectOption;
