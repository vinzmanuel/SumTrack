"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { DashboardSecondaryChartWidget } from "@/app/dashboard/overview-types";

const moneyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

export function DashboardSecondaryChartCard({ widget }: { widget: DashboardSecondaryChartWidget }) {
  const data = useMemo(
    () =>
      widget.chart.rows.map((row) => ({
        bucket: row.bucket,
        ...row.values,
      })),
    [widget.chart.rows],
  );

  const chartConfig = Object.fromEntries(
    widget.chart.series.map((series) => [
      series.key,
      {
        label: series.label,
        color: series.color,
      },
    ]),
  ) satisfies ChartConfig;

  return (
    <Card className="rounded-md py-0 shadow-sm" data-widget-id={widget.id}>
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base font-semibold tracking-tight">{widget.title}</CardTitle>
        <CardDescription className="text-sm leading-5">{widget.description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        {widget.chart.noData ? (
          <div className="flex h-[320px] items-center justify-center rounded-md border border-dashed border-border/70 bg-muted/20 px-6 text-center text-sm text-muted-foreground">
            No chart data available for this period.
          </div>
        ) : (
          <ChartContainer className="h-240px]" config={chartConfig}>
            <BarChart data={data} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis axisLine={false} dataKey="bucket" tick={{ fontSize: 12 }} tickLine={false} tickMargin={8} />
              <YAxis
                axisLine={false}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatMoney(Number(value ?? 0))}
                tickLine={false}
                width={84}
              />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatMoney(Number(value ?? 0))} />} />
              <Bar dataKey={widget.chart.series[0]?.key ?? "amount"} fill={`var(--color-${widget.chart.series[0]?.key ?? "amount"})`} maxBarSize={36} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
