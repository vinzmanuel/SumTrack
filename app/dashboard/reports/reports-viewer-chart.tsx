"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReportsSnapshotChartSection } from "@/app/dashboard/reports/types";

function formatMoney(value: number) {
  return `PHP ${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatAxisValue(value: number, format: ReportsSnapshotChartSection["valueFormat"]) {
  if (format === "currency") {
    return `PHP ${value.toLocaleString("en-PH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  }

  return value.toLocaleString("en-PH");
}

function formatTooltipValue(value: number, format: ReportsSnapshotChartSection["valueFormat"]) {
  if (format === "currency") {
    return formatMoney(value);
  }

  if (format === "number") {
    return value.toLocaleString("en-PH");
  }

  return String(value);
}

function mapChartData(chart: ReportsSnapshotChartSection) {
  return chart.rows.map((row) => ({
    bucket: row.bucket,
    ...Object.fromEntries(chart.series.map((series) => [series.key, Number(row.values[series.key] ?? 0)])),
  }));
}

function ViewerChartTooltip(props: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    color?: string;
    dataKey?: string | number;
    name?: string | number;
    value?: string | number;
  }>;
  valueFormat?: ReportsSnapshotChartSection["valueFormat"];
}) {
  if (!props.active || !props.payload?.length) {
    return null;
  }

  return (
    <div className="min-w-52 rounded-lg border border-border/80 bg-background/95 p-3 shadow-lg backdrop-blur">
      <p className="mb-2 text-sm font-medium text-foreground">{String(props.label ?? "")}</p>
      <div className="space-y-1.5">
        {props.payload.map((entry) => (
          <div className="flex items-center justify-between gap-4 text-sm" key={String(entry.dataKey)}>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color ?? "#16a34a" }}
              />
              <span>{String(entry.name ?? entry.dataKey ?? "")}</span>
            </div>
            <span className="font-medium text-foreground">
              {formatTooltipValue(Number(entry.value ?? 0), props.valueFormat)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportsViewerChart(props: {
  chart: ReportsSnapshotChartSection;
  forceChartType?: ReportsSnapshotChartSection["chartType"];
}) {
  const chartType = props.forceChartType ?? props.chart.chartType;
  const data = mapChartData(props.chart);

  if (data.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/10 px-6 text-center text-sm text-muted-foreground">
        No saved chart data was captured for this report.
      </div>
    );
  }

  const sharedProps = {
    data,
    margin: { top: 12, right: 16, left: 8, bottom: 0 },
  };

  return (
    <div className="space-y-3">
      <div className="h-[340px] w-full">
        <ResponsiveContainer height="100%" width="100%">
          {chartType === "composed" ? (
            <ComposedChart {...sharedProps}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
              <XAxis axisLine={false} dataKey="bucket" tick={{ fill: "#6b7280", fontSize: 12 }} tickLine={false} />
              <YAxis
                axisLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickFormatter={(value) => formatAxisValue(Number(value ?? 0), props.chart.valueFormat)}
                tickLine={false}
                width={88}
              />
              <Tooltip
                content={<ViewerChartTooltip valueFormat={props.chart.valueFormat} />}
                cursor={{ stroke: "#d4d4d8", strokeDasharray: "4 4" }}
              />
              <Legend />
              {props.chart.series.map((series) =>
                series.type === "line" ? (
                  <Line
                    dataKey={series.key}
                    dot={false}
                    key={series.key}
                    name={series.label}
                    stroke={series.color}
                    strokeWidth={2.5}
                    type="monotone"
                  />
                ) : (
                  <Bar
                    dataKey={series.key}
                    fill={series.color}
                    key={series.key}
                    name={series.label}
                    radius={[6, 6, 0, 0]}
                  />
                ),
              )}
            </ComposedChart>
          ) : chartType === "line" ? (
            <LineChart {...sharedProps}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
              <XAxis axisLine={false} dataKey="bucket" tick={{ fill: "#6b7280", fontSize: 12 }} tickLine={false} />
              <YAxis
                axisLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickFormatter={(value) => formatAxisValue(Number(value ?? 0), props.chart.valueFormat)}
                tickLine={false}
                width={88}
              />
              <Tooltip
                content={<ViewerChartTooltip valueFormat={props.chart.valueFormat} />}
                cursor={{ stroke: "#d4d4d8", strokeDasharray: "4 4" }}
              />
              <Legend />
              {props.chart.series.map((series) => (
                <Line
                  dataKey={series.key}
                  dot={false}
                  key={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={2.5}
                  type="monotone"
                />
              ))}
            </LineChart>
          ) : (
            <BarChart {...sharedProps}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
              <XAxis axisLine={false} dataKey="bucket" tick={{ fill: "#6b7280", fontSize: 12 }} tickLine={false} />
              <YAxis
                axisLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickFormatter={(value) => formatAxisValue(Number(value ?? 0), props.chart.valueFormat)}
                tickLine={false}
                width={88}
              />
              <Tooltip
                content={<ViewerChartTooltip valueFormat={props.chart.valueFormat} />}
                cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
              />
              <Legend />
              {props.chart.series.map((series) => (
                <Bar
                  dataKey={series.key}
                  fill={series.color}
                  key={series.key}
                  name={series.label}
                  radius={[6, 6, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {props.chart.note ? <p className="text-sm text-muted-foreground">{props.chart.note}</p> : null}
    </div>
  );
}
