"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatAxisValue(value: number, format: ReportsSnapshotChartSection["valueFormat"]) {
  if (format === "currency") {
    return `₱${value.toLocaleString("en-PH", {
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
  return chart.rows.map((row, index) => ({
    bucket: row.bucket,
    __barColor:
      chart.key === "categoryBreakdown"
        ? CATEGORY_BREAKDOWN_BAR_COLORS[index % CATEGORY_BREAKDOWN_BAR_COLORS.length]
        : undefined,
    ...Object.fromEntries(chart.series.map((series) => [series.key, Number(row.values[series.key] ?? 0)])),
  }));
}

const CATEGORY_BREAKDOWN_BAR_COLORS = [
  "#16a34a",
  "#0ea5e9",
  "#f97316",
  "#8b5cf6",
  "#eab308",
  "#ec4899",
  "#14b8a6",
  "#64748b",
] as const;

function getSeriesValueFormat(
  chart: ReportsSnapshotChartSection,
  dataKey: string | number | undefined,
) {
  const series = chart.series.find((item) => item.key === dataKey);
  return series?.valueFormat ?? chart.valueFormat;
}

function getAxisFormat(chart: ReportsSnapshotChartSection, axisId: "left" | "right") {
  const series = chart.series.find((item) => (item.yAxisId ?? "left") === axisId);
  return series?.valueFormat ?? chart.valueFormat;
}

function ViewerChartTooltip(props: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    color?: string;
    dataKey?: string | number;
    name?: string | number;
    payload?: Record<string, string | number | undefined>;
    value?: string | number;
  }>;
  chart: ReportsSnapshotChartSection;
}) {
  if (!props.active || !props.payload?.length) {
    return null;
  }

  const visiblePayload = props.payload.filter((entry) => Number(entry.value ?? 0) !== 0);
  const entries = visiblePayload.length > 0 ? visiblePayload : props.payload;

  const resolvedLabel =
    typeof entries[0]?.payload?.bucket === "string" && entries[0].payload.bucket.trim()
      ? entries[0].payload.bucket
      : String(props.label ?? "");
  const resolvedTooltipColor =
    props.chart.key === "categoryBreakdown" &&
    typeof entries[0]?.payload?.__barColor === "string" &&
    entries[0].payload.__barColor.trim()
      ? entries[0].payload.__barColor
      : null;

  return (
    <div className="min-w-52 rounded-lg border border-border/80 bg-background/95 p-3 shadow-lg backdrop-blur">
      <p className="mb-2 text-sm font-medium text-foreground">{resolvedLabel}</p>
      <div className="space-y-1.5">
        {entries.map((entry) => (
          <div className="flex items-center justify-between gap-4 text-sm" key={String(entry.dataKey)}>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: resolvedTooltipColor ?? entry.color ?? "#16a34a" }}
              />
              <span>{String(entry.name ?? entry.dataKey ?? "")}</span>
            </div>
            <span className="font-medium text-foreground">
              {formatTooltipValue(
                Number(entry.value ?? 0),
                getSeriesValueFormat(props.chart, entry.dataKey),
              )}
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
  const hasRightAxis = props.chart.series.some((series) => (series.yAxisId ?? "left") === "right");
  const showLegend = props.chart.showLegend ?? true;
  const leftAxisFormat = getAxisFormat(props.chart, "left");
  const rightAxisFormat = getAxisFormat(props.chart, "right");
  const isHorizontalBarChart = chartType === "bar" && props.chart.layout === "horizontal";
  const useCategoryBreakdownRowColors = props.chart.key === "categoryBreakdown";

  if (data.length === 0) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/10 px-6 text-center text-sm text-muted-foreground">
        No saved chart data was captured for this report.
      </div>
    );
  }

  const sharedProps = {
    data,
    margin: { top: 12, right: hasRightAxis ? 30 : 16, left: 8, bottom: 0 },
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
                yAxisId="left"
                axisLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickFormatter={(value) => formatAxisValue(Number(value ?? 0), leftAxisFormat)}
                tickLine={false}
                width={88}
              />
              {hasRightAxis ? (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  tickFormatter={(value) => formatAxisValue(Number(value ?? 0), rightAxisFormat)}
                  tickLine={false}
                  width={72}
                />
              ) : null}
              <Tooltip
                content={<ViewerChartTooltip chart={props.chart} />}
                cursor={{ stroke: "#d4d4d8", strokeDasharray: "4 4" }}
              />
              {showLegend ? <Legend /> : null}
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
                    yAxisId={series.yAxisId ?? "left"}
                  />
                ) : (
                  <Bar
                    dataKey={series.key}
                    fill={series.color}
                    key={series.key}
                    name={series.label}
                    radius={[6, 6, 0, 0]}
                    stackId={series.stackId}
                    yAxisId={series.yAxisId ?? "left"}
                  >
                    {useCategoryBreakdownRowColors
                      ? data.map((entry, index) => (
                          <Cell
                            fill={CATEGORY_BREAKDOWN_BAR_COLORS[index % CATEGORY_BREAKDOWN_BAR_COLORS.length]}
                            key={`${series.key}-${String(entry.bucket)}-${index}`}
                          />
                        ))
                      : null}
                  </Bar>
                ),
              )}
            </ComposedChart>
          ) : chartType === "line" ? (
            <LineChart {...sharedProps}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
              <XAxis axisLine={false} dataKey="bucket" tick={{ fill: "#6b7280", fontSize: 12 }} tickLine={false} />
              <YAxis
                yAxisId="left"
                axisLine={false}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickFormatter={(value) => formatAxisValue(Number(value ?? 0), leftAxisFormat)}
                tickLine={false}
                width={88}
              />
              {hasRightAxis ? (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  tickFormatter={(value) => formatAxisValue(Number(value ?? 0), rightAxisFormat)}
                  tickLine={false}
                  width={72}
                />
              ) : null}
              <Tooltip
                content={<ViewerChartTooltip chart={props.chart} />}
                cursor={{ stroke: "#d4d4d8", strokeDasharray: "4 4" }}
              />
              {showLegend ? <Legend /> : null}
              {props.chart.series.map((series) => (
                <Line
                  dataKey={series.key}
                  dot={false}
                  key={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={2.5}
                  type="monotone"
                  yAxisId={series.yAxisId ?? "left"}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart
              {...sharedProps}
              layout={isHorizontalBarChart ? "vertical" : "horizontal"}
              margin={
                isHorizontalBarChart
                  ? { top: 12, right: 20, left: 100, bottom: 0 }
                  : sharedProps.margin
              }
            >
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey={isHorizontalBarChart ? undefined : "bucket"}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickFormatter={
                  isHorizontalBarChart
                    ? (value) => formatAxisValue(Number(value ?? 0), leftAxisFormat)
                    : undefined
                }
                tickLine={false}
                type={isHorizontalBarChart ? "number" : "category"}
              />
              <YAxis
                yAxisId="left"
                axisLine={false}
                dataKey={isHorizontalBarChart ? "bucket" : undefined}
                tick={{ fill: "#6b7280", fontSize: 12 }}
                tickFormatter={
                  isHorizontalBarChart
                    ? undefined
                    : (value) => formatAxisValue(Number(value ?? 0), leftAxisFormat)
                }
                tickLine={false}
                type={isHorizontalBarChart ? "category" : "number"}
                width={isHorizontalBarChart ? 160 : 88}
              />
              {hasRightAxis ? (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  dataKey={isHorizontalBarChart ? "bucket" : undefined}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  tickFormatter={
                    isHorizontalBarChart
                      ? undefined
                      : (value) => formatAxisValue(Number(value ?? 0), rightAxisFormat)
                  }
                  tickLine={false}
                  type={isHorizontalBarChart ? "category" : "number"}
                  width={72}
                />
              ) : null}
              <Tooltip
                content={<ViewerChartTooltip chart={props.chart} />}
                cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
              />
              {showLegend ? <Legend /> : null}
              {props.chart.series.map((series) => (
                <Bar
                  dataKey={series.key}
                  fill={series.color}
                  key={series.key}
                  name={series.label}
                  radius={isHorizontalBarChart ? [0, 6, 6, 0] : [6, 6, 0, 0]}
                  stackId={series.stackId}
                  yAxisId={series.yAxisId ?? "left"}
                >
                  {useCategoryBreakdownRowColors
                    ? data.map((entry, index) => (
                        <Cell
                          fill={CATEGORY_BREAKDOWN_BAR_COLORS[index % CATEGORY_BREAKDOWN_BAR_COLORS.length]}
                          key={`${series.key}-${String(entry.bucket)}-${index}`}
                        />
                      ))
                    : null}
                </Bar>
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {props.chart.note ? <p className="text-sm text-muted-foreground">{props.chart.note}</p> : null}
    </div>
  );
}
