"use client";

import { useMemo } from "react";
import { Bar, BarChart as RechartsBarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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

export function ExpensesTrendChart({
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
  const data = useMemo(() => mapChartData(chart), [chart]);

  if (chart.noData || chart.series.length === 0) {
    return (
      <div
        className={`${className ?? "h-[280px]"} flex items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 text-center text-sm text-muted-foreground`}
      >
        {emptyMessage ?? "No expense trend is available for the selected period."}
      </div>
    );
  }

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
    <ChartContainer className={className ?? "h-[280px] md:h-[320px]"} config={chartConfig}>
      <RechartsBarChart accessibilityLayer data={data} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
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
        <Bar dataKey={chart.series[0].key} fill={`var(--color-${chart.series[0].key})`} maxBarSize={38} radius={[8, 8, 0, 0]} />
      </RechartsBarChart>
    </ChartContainer>
  );
}
