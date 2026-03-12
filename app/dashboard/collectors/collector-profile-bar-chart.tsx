"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsChartModel } from "@/components/analytics/types";
import { cn } from "@/lib/utils";

function mapChartData(chart: AnalyticsChartModel) {
  return chart.rows.map((row) => ({
    bucket: row.bucket,
    ...Object.fromEntries(chart.series.map((series) => [series.label, Number(row.values[series.key] ?? 0)])),
  }));
}

export function CollectorProfileBarChart({
  chart,
  className,
  horizontal = true,
  valueFormatter,
  axisFormatter = valueFormatter,
}: {
  chart: AnalyticsChartModel;
  className?: string;
  horizontal?: boolean;
  valueFormatter: (value: number) => string;
  axisFormatter?: (value: number) => string;
}) {
  const data = mapChartData(chart);

  if (chart.noData) {
    return (
      <div className={cn("flex h-[320px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 text-center text-sm text-muted-foreground", className)}>
        No chart data is available for this collector yet.
      </div>
    );
  }

  return (
    <div className={cn("h-[320px] w-full", className)}>
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={horizontal ? { top: 12, right: 20, left: 20, bottom: 4 } : { top: 12, right: 16, left: 0, bottom: 12 }}
        >
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? (
            <>
              <XAxis
                axisLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickFormatter={(value) => axisFormatter(Number(value ?? 0))}
                tickLine={false}
                type="number"
              />
              <YAxis
                axisLine={false}
                dataKey="bucket"
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickLine={false}
                type="category"
                width={110}
              />
            </>
          ) : (
            <>
              <XAxis
                axisLine={false}
                dataKey="bucket"
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickFormatter={(value) => axisFormatter(Number(value ?? 0))}
                tickLine={false}
                width={84}
              />
            </>
          )}
          <Tooltip
            content={<CollectorProfileBarChartTooltip valueFormatter={valueFormatter} />}
            cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
          />
          {chart.series.map((series) => (
            <Bar
              barSize={horizontal ? 16 : 24}
              dataKey={series.label}
              fill={series.color}
              key={series.key}
              radius={horizontal ? [0, 999, 999, 0] : [10, 10, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CollectorProfileBarChartTooltip({
  active,
  label,
  payload,
  valueFormatter,
}: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    color?: string;
    dataKey?: string | number;
    name?: string | number;
    value?: string | number;
  }>;
  valueFormatter: (value: number) => string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="min-w-44 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
      <p className="mb-2 text-sm font-medium text-foreground">{String(label ?? "")}</p>
      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div className="flex items-center justify-between gap-4 text-sm" key={String(entry.dataKey)}>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color ?? "#0ea5e9" }}
              />
              <span>{String(entry.name ?? entry.dataKey ?? "")}</span>
            </div>
            <span className="font-medium text-foreground">{valueFormatter(Number(entry.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
