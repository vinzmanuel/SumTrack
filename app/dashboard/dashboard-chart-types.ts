import type { DashboardAuthContext } from "@/app/dashboard/auth";
import type {
  AnalyticsChartModel,
  AnalyticsDateRangeKey,
  AnalyticsSelectOption,
  AnalyticsSeriesDefinition,
} from "@/components/analytics/types";

export type DashboardChartPageProps = {
  searchParams?: Promise<{
    branch?: string;
    range?: string;
    from?: string;
    to?: string;
  }>;
};

export type DashboardChartRangeKey = AnalyticsDateRangeKey;

export type DashboardChartFilters = {
  selectedBranchRaw: string;
  selectedRange: DashboardChartRangeKey;
  fromRaw: string;
  toRaw: string;
};

export type DashboardChartFilterInput = {
  branch: string;
  range: DashboardChartRangeKey;
  from: string;
  to: string;
};

export type DashboardChartDateRange = {
  start: string;
  end: string;
  granularity: "day" | "month";
  label: string;
};

export type DashboardChartRoleVariant = "management" | "secretary" | "collector" | "none";

export type DashboardChartAccessState =
  | {
      view: "none";
    }
  | {
      view: "ready";
      roleName: DashboardAuthContext["roleName"];
      variant: DashboardChartRoleVariant;
      title: string;
      description: string;
      branchFilterLabel: string | null;
      canChooseBranch: boolean;
      branchOptions: AnalyticsSelectOption[];
      scopedBranchIds: number[];
      series: AnalyticsSeriesDefinition[];
    };

export type DashboardChartData = {
  title: string;
  description: string;
  filters: DashboardChartFilters;
  branchFilterLabel: string | null;
  canChooseBranch: boolean;
  branchOptions: AnalyticsSelectOption[];
  chart: AnalyticsChartModel;
  dateRangeLabel: string;
};
