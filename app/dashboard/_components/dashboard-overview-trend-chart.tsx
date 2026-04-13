"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function DashboardOverviewTrendChart({ chart }: { chart: AnalyticsChartModel }) {
  const data = useMemo(() => mapChartData(chart), [chart]);

  if (chart.noData || chart.series.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-md border border-dashed border-border/70 bg-muted/20 px-6 text-center text-sm text-muted-foreground">
        No matching dashboard data was found for the selected filters.
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
    <ChartContainer className="h-[300px]" config={chartConfig}>
      <AreaChart accessibilityLayer data={data} margin={{ top: 16, right: 10, left: 8, bottom: 2 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="bucket"
          minTickGap={24}
          tick={{ fontSize: 12 }}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          axisLine={false}
          tick={{ fontSize: 12 }}
          tickFormatter={(value) => formatMoney(Number(value ?? 0))}
          tickLine={false}
          width={92}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => formatMoney(Number(value ?? 0))} />}
          cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
        />
        <ChartLegend content={<ChartLegendContent className="justify-center pt-2" />} />
        {chart.series.map((series) => (
          <Area
            dataKey={series.key}
            fill={`var(--color-${series.key})`}
            fillOpacity={0.18}
            key={series.key}
            stroke={`var(--color-${series.key})`}
            strokeWidth={2}
            type="monotone"
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
