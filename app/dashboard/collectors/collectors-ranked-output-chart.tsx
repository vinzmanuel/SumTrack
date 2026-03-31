"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { formatCollectorsAxisCurrency, formatCollectorsCurrency } from "@/app/dashboard/collectors/format";
import type { AnalyticsChartModel } from "@/components/analytics/types";

const chartConfig = {
  actualCollected: {
    label: "Actual Collected",
    color: "#86efac",
  },
  expectedCollected: {
    label: "Expected Collected",
    color: "#16a34a",
  },
} satisfies ChartConfig;

function mapChartData(chart: AnalyticsChartModel) {
  return chart.rows.map((row) => ({
    bucket: row.bucket,
    actualCollected: Number(row.values.actualCollected ?? 0),
    expectedCollected: Number(row.values.expectedCollected ?? 0),
  }));
}

export function CollectorsRankedOutputChart({
  chart,
}: {
  chart: AnalyticsChartModel;
}) {
  if (chart.noData) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 text-center text-sm text-muted-foreground">
        No comparison data is available for the visible ranking.
      </div>
    );
  }

  const data = mapChartData(chart);

  return (
    <ChartContainer className="h-[320px] md:h-[340px]" config={chartConfig}>
      <BarChart accessibilityLayer data={data} margin={{ top: 12, right: 12, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="bucket"
          tickLine={false}
          tickMargin={10}
        />
        <YAxis
          axisLine={false}
          tickFormatter={(value) => formatCollectorsAxisCurrency(Number(value ?? 0))}
          tickLine={false}
          width={84}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent formatter={(value) => formatCollectorsCurrency(Number(value ?? 0))} />
          }
          cursor={false}
        />
        <ChartLegend content={<ChartLegendContent className="justify-center" />} />
        <Bar
          barSize={34}
          dataKey="actualCollected"
          fill="var(--color-actualCollected)"
          radius={[0, 0, 6, 6]}
          stackId="collections"
        />
        <Bar
          barSize={34}
          dataKey="expectedCollected"
          fill="var(--color-expectedCollected)"
          radius={[6, 6, 0, 0]}
          stackId="collections"
        />
      </BarChart>
    </ChartContainer>
  );
}
