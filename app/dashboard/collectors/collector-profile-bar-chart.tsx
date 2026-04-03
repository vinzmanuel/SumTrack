"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AnalyticsChartModel } from "@/components/analytics/types";

function mapChartData(chart: AnalyticsChartModel) {
  return chart.rows.map((row) => ({
    bucket: row.bucket,
    ...Object.fromEntries(chart.series.map((series) => [series.key, Number(row.values[series.key] ?? 0)])),
  }));
}

export function CollectorProfileBarChart({
  chart,
  className,
  valueFormatter,
  axisFormatter = valueFormatter,
}: {
  chart: AnalyticsChartModel;
  className?: string;
  valueFormatter: (value: number) => string;
  axisFormatter?: (value: number) => string;
}) {
  if (chart.noData) {
    return (
      <div className={`${className ?? "h-[280px] md:h-[300px]"} flex items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 text-center text-sm text-muted-foreground`}>
        No chart data is available for this collector yet.
      </div>
    );
  }

  const data = mapChartData(chart);
  const [barSeries, lineSeries] = chart.series;
  const chartConfig = Object.fromEntries(
    chart.series.map((series) => [
      series.key,
      {
        label: series.label,
        color: series.color,
      },
    ]),
  ) satisfies ChartConfig;

  return (
    <ChartContainer
      className={className ?? "h-[280px] md:h-[300px]"}
      config={chartConfig}
    >
      <ComposedChart data={data} margin={{ top: 4, right: 0, left: -10, bottom: -4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="bucket"
          minTickGap={20}
          tick={{ fill: "#6b7280", fontSize: 12 }}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          tick={{ fill: "#6b7280", fontSize: 12 }}
          tickFormatter={(value) => axisFormatter(Number(value ?? 0))}
          tickLine={false}
          width={60}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => valueFormatter(Number(value ?? 0))} />}
          cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
        />
        <ChartLegend content={<ChartLegendContent className="justify-center pt-1" />} />
        {barSeries ? (
          <Bar
            barSize={26}
            dataKey={barSeries.key}
            fill={barSeries.color}
            radius={[10, 10, 0, 0]}
          />
        ) : null}
        {lineSeries ? (
          <Line
            dataKey={lineSeries.key}
            dot={false}
            stroke={lineSeries.color}
            strokeDasharray="6 4"
            strokeWidth={2}
            type="monotone"
          />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  );
}
