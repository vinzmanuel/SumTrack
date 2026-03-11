import type { AnalyticsChartModel } from "@/components/analytics/types";

export function toAreaChartProps(chart: AnalyticsChartModel) {
  return {
    categories: chart.series.map((series) => series.label),
    colors: chart.series.map((series) => series.color),
    data: chart.rows.map((row) => {
      const values = Object.fromEntries(
        chart.series.map((series) => [series.label, row.values[series.key] ?? 0]),
      );

      return {
        bucket: row.bucket,
        ...values,
      };
    }),
  };
}
