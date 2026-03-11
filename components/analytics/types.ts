export type AnalyticsDateRangeKey =
  | "this-week"
  | "this-month"
  | "last-30-days"
  | "this-year"
  | "custom";

export type AnalyticsSelectOption = {
  value: string;
  label: string;
};

export type AnalyticsSeriesDefinition = {
  key: string;
  label: string;
  color: string;
};

export type AnalyticsChartRow = {
  bucket: string;
  values: Record<string, number>;
};

export type AnalyticsChartModel = {
  rows: AnalyticsChartRow[];
  series: AnalyticsSeriesDefinition[];
  noData: boolean;
};
