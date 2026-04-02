"use client";

import {
  Area,
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

export function CollectorProfileTrendChart({
  chart,
  valueFormatter,
  axisFormatter = valueFormatter,
  compact = false,
  condensed = false,
  fillHeight = false,
}: {
  chart: AnalyticsChartModel;
  valueFormatter: (value: number) => string;
  axisFormatter?: (value: number) => string;
  compact?: boolean;
  condensed?: boolean;
  fillHeight?: boolean;
}) {
  if (chart.noData) {
    return (
      <div className={`${fillHeight ? "h-full min-h-0" : "h-[260px]"} flex items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 text-center text-sm text-muted-foreground`}>
        No chart data is available for this collector yet.
      </div>
    );
  }

  const data = mapChartData(chart);
  const [primarySeries, referenceSeries] = chart.series;
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
      className={
        fillHeight
          ? "h-full min-h-0"
          : compact
            ? "h-[228px] md:h-[246px]"
            : condensed
              ? "h-[282px] md:h-[320px]"
              : "h-[300px] md:h-[340px]"
      }
      config={chartConfig}
    >
      <ComposedChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: -6 }}>
        <defs>
          {primarySeries ? (
            <linearGradient id={`${primarySeries.key}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor={primarySeries.color} stopOpacity={0.24} />
              <stop offset="95%" stopColor={primarySeries.color} stopOpacity={0.03} />
            </linearGradient>
          ) : null}
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="bucket"
          minTickGap={24}
          padding={{ left: 0, right: 0 }}
          tick={{ fill: "#6b7280", fontSize: 12 }}
          tickLine={false}
        />
        <YAxis
          axisLine={false}
          tick={{ fill: "#6b7280", fontSize: 12 }}
          tickFormatter={(value) => axisFormatter(Number(value ?? 0))}
          tickLine={false}
          width={54}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => valueFormatter(Number(value ?? 0))} />}
          cursor={{ stroke: "#d4d4d8", strokeDasharray: "4 4" }}
        />
        {!compact ? <ChartLegend content={<ChartLegendContent className="justify-center pt-1" />} /> : null}
        {primarySeries ? (
          <Area
            dataKey={primarySeries.key}
            fill={`url(#${primarySeries.key}-fill)`}
            fillOpacity={1}
            stroke={primarySeries.color}
            strokeWidth={2.5}
            type="monotone"
          />
        ) : null}
        {referenceSeries ? (
          <Line
            dataKey={referenceSeries.key}
            dot={false}
            stroke={referenceSeries.color}
            strokeDasharray="6 4"
            strokeWidth={2}
            type="monotone"
          />
        ) : null}
      </ComposedChart>
    </ChartContainer>
  );
}
