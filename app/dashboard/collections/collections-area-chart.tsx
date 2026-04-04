"use client";

import { useMemo } from "react";
import { Area, AreaChart as RechartsAreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
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

export function CollectionsAreaChart({
  chart,
  className,
  valueFormatter,
  axisFormatter = valueFormatter,
  emptyMessage,
}: {
  chart: AnalyticsChartModel;
  className?: string;
  valueFormatter: (value: number) => string;
  axisFormatter?: (value: number) => string;
  emptyMessage?: string;
}) {
  const series = chart.series[0];
  const data = useMemo(() => mapChartData(chart), [chart]);

  if (chart.noData || !series) {
    return (
      <div className={`${className ?? "h-[280px]"} flex items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 text-center text-sm text-muted-foreground`}>
        {emptyMessage ?? "No chart data is available for the selected period."}
      </div>
    );
  }

  const chartConfig = {
    [series.key]: {
      label: series.label,
      color: series.color,
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer className={className ?? "h-[280px] md:h-[320px]"} config={chartConfig}>
      <RechartsAreaChart accessibilityLayer data={data} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={`collections-fill-${series.key}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor={`var(--color-${series.key})`} stopOpacity={0.3} />
            <stop offset="95%" stopColor={`var(--color-${series.key})`} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="bucket"
          minTickGap={20}
          tick={{ fill: "#6b7280", fontSize: 12 }}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          tick={{ fill: "#6b7280", fontSize: 12 }}
          tickFormatter={(value) => axisFormatter(Number(value ?? 0))}
          tickLine={false}
          width={72}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => valueFormatter(Number(value ?? 0))} />}
          cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
        />
        <Area
          dataKey={series.key}
          fill={`url(#collections-fill-${series.key})`}
          stroke={`var(--color-${series.key})`}
          strokeWidth={2.5}
          type="monotone"
        />
      </RechartsAreaChart>
    </ChartContainer>
  );
}
