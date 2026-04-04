"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
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
import { cn } from "@/lib/utils";

function mapChartData(chart: AnalyticsChartModel) {
  return chart.rows.map((row) => ({
    bucket: row.bucket,
    ...Object.fromEntries(chart.series.map((series) => [series.key, Number(row.values[series.key] ?? 0)])),
  }));
}

function CollectionsChartTooltipContent({
  active,
  payload,
  label,
  valueFormatter,
  config,
  includeTotal,
}: {
  active?: boolean;
  payload?: Array<{
    color?: string;
    dataKey?: string | number;
    name?: string | number;
    value?: string | number;
  }>;
  label?: string | number;
  valueFormatter: (value: number) => string;
  config: ChartConfig;
  includeTotal: boolean;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const total = payload.reduce((sum, item) => sum + Number(item.value ?? 0), 0);

  return (
    <div className={cn("min-w-48 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur")}>
      {label ? <p className="mb-2 text-sm font-medium text-foreground">{String(label)}</p> : null}
      <div className="space-y-1.5">
        {includeTotal ? (
          <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2 text-sm">
            <span className="font-medium text-foreground">Total Collections</span>
            <span className="font-semibold text-foreground">{valueFormatter(total)}</span>
          </div>
        ) : null}
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name ?? "");
          const entry = config[key];
          return (
            <div className="flex items-center justify-between gap-4 text-sm" key={key}>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: item.color ?? entry?.color ?? "#16a34a" }}
                />
                <span>{entry?.label ?? item.name ?? key}</span>
              </div>
              <span className="font-medium text-foreground">
                {valueFormatter(Number(item.value ?? 0))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CollectionsChart({
  chart,
  className,
  valueFormatter,
  axisFormatter = valueFormatter,
  emptyMessage,
  showLegend = false,
  stacked = false,
  includeTotalInTooltip = false,
}: {
  chart: AnalyticsChartModel;
  className?: string;
  valueFormatter: (value: number) => string;
  axisFormatter?: (value: number) => string;
  emptyMessage?: string;
  showLegend?: boolean;
  stacked?: boolean;
  includeTotalInTooltip?: boolean;
}) {
  const data = useMemo(() => mapChartData(chart), [chart]);

  if (chart.noData || chart.series.length === 0) {
    return (
      <div className={`${className ?? "h-[280px]"} flex items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 text-center text-sm text-muted-foreground`}>
        {emptyMessage ?? "No chart data is available for the selected period."}
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
          content={
            includeTotalInTooltip ? (
              <CollectionsChartTooltipContent
                config={chartConfig}
                includeTotal
                valueFormatter={valueFormatter}
              />
            ) : (
              <ChartTooltipContent formatter={(value) => valueFormatter(Number(value ?? 0))} />
            )
          }
          cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
        />
        {showLegend ? (
          <ChartLegend content={<ChartLegendContent className="justify-center pt-2" />} />
        ) : null}
        {chart.series.map((series, index) => (
          <Bar
            dataKey={series.key}
            fill={`var(--color-${series.key})`}
            key={series.key}
            maxBarSize={stacked ? 38 : 32}
            radius={
              stacked
                ? index === chart.series.length - 1
                  ? [8, 8, 0, 0]
                  : [0, 0, 0, 0]
                : [8, 8, 0, 0]
            }
            stackId={stacked ? "collections" : undefined}
          />
        ))}
      </RechartsBarChart>
    </ChartContainer>
  );
}

export const CollectionsAreaChart = CollectionsChart;
