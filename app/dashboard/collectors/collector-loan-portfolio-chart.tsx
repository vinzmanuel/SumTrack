"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { CollectorLoanPortfolioCounts } from "@/app/dashboard/collectors/types";

const STATUS_ORDER: Array<{
  key: keyof Omit<CollectorLoanPortfolioCounts, "total">;
  label: string;
  color: string;
}> = [
  { key: "active", label: "Active", color: "#16a34a" },
  { key: "overdue", label: "Overdue", color: "#f97316" },
  { key: "completed", label: "Completed", color: "#2563eb" },
  { key: "archived", label: "Archived", color: "#64748b" },
  { key: "abandoned", label: "Abandoned", color: "#a855f7" },
];

export function CollectorLoanPortfolioChart({
  counts,
  compact = false,
}: {
  counts: CollectorLoanPortfolioCounts;
  compact?: boolean;
}) {
  const chartConfig = Object.fromEntries(
    STATUS_ORDER.map((status) => [
      status.key,
      {
        label: status.label,
        color: status.color,
      },
    ]),
  ) satisfies ChartConfig;

  const data = [
    {
      name: "Loans",
      ...Object.fromEntries(STATUS_ORDER.map((status) => [status.key, counts[status.key]])),
    },
  ];

  return (
    <ChartContainer className={compact ? "h-[132px]" : "h-[170px]"} config={chartConfig}>
      <BarChart data={data} layout="vertical" margin={{ top: 12, right: 12, left: 12, bottom: 0 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
        <XAxis axisLine={false} hide tickLine={false} type="number" />
        <YAxis axisLine={false} dataKey="name" hide tickLine={false} type="category" />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => `${Number(value ?? 0)} loans`} />}
          cursor={false}
        />
        <ChartLegend content={<ChartLegendContent className="justify-center pt-3" />} />
        {STATUS_ORDER.map((status, index) => (
          <Bar
            dataKey={status.key}
            fill={status.color}
            key={status.key}
            radius={
              index === 0
                ? [999, 0, 0, 999]
                : index === STATUS_ORDER.length - 1
                  ? [0, 999, 999, 0]
                  : 0
            }
            stackId="portfolio"
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
