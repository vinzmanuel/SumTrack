"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";
import {
  ChartContainer,
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
  const portfolioRows = React.useMemo(
    () =>
      STATUS_ORDER.map((status) => {
        const count = counts[status.key];
        const percentage = counts.total > 0 ? (count / counts.total) * 100 : 0;

        return {
          ...status,
          count,
          percentage,
          fill: status.color,
        };
      }),
    [counts],
  );
  const totalLoans = React.useMemo(() => counts.total, [counts.total]);
  const chartConfig = Object.fromEntries(
    STATUS_ORDER.map((status) => [
      status.key,
      {
        label: status.label,
        color: status.color,
      },
    ]),
  ) satisfies ChartConfig;
  const renderCenterLabel = React.useCallback(
    ({ viewBox }: { viewBox?: unknown }) => {
      const center =
        viewBox && typeof viewBox === "object" && "cx" in viewBox && "cy" in viewBox
          ? viewBox
          : null;

      if (
        !center ||
        typeof center.cx !== "number" ||
        typeof center.cy !== "number"
      ) {
        return null;
      }

      return (
        <text
          x={center.cx}
          y={center.cy}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          <tspan
            x={center.cx}
            y={center.cy}
            className="fill-foreground font-bold"
            fontSize="46"
            fontWeight="700"
          >
            {totalLoans.toLocaleString("en-PH")}
          </tspan>
          <tspan
            x={center.cx}
            y={center.cy + 28}
            className="fill-muted-foreground"
            fontSize="15"
            fontWeight="500"
          >
            total loans
          </tspan>
        </text>
      );
    },
    [totalLoans],
  );

  return (
    <div className="grid h-full min-h-[360px] w-full gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-stretch">
      <div className="flex h-full min-h-0 items-center justify-center rounded-2xl border border-border/70 bg-muted/10 p-2">
        <div className="flex h-full min-h-0 w-full items-center justify-center">
          <ChartContainer
            className={
              compact
                ? "mx-auto aspect-square h-full max-h-full w-full max-w-[500px]"
                : "mx-auto aspect-square h-full max-h-full w-full max-w-[560px]"
            }
            config={chartConfig}
          >
            <PieChart>
              <ChartTooltip
                content={<ChartTooltipContent formatter={(value) => `${Number(value ?? 0)} loans`} />}
                cursor={false}
              />
              <Pie
              data={portfolioRows}
              dataKey="count"
              innerRadius={compact ? 102 : 112}
              nameKey="label"
              outerRadius={compact ? 166 : 180}
              stroke="none"
              strokeWidth={0}
            >
                <Label content={renderCenterLabel} />
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>
      </div>

      <div className="grid h-full min-h-0 gap-2.5 lg:auto-rows-fr">
        {portfolioRows.map((item) => (
          <div
            className="flex h-full min-h-0 items-center rounded-xl border border-border/70 bg-muted/10 px-4 py-3"
            key={item.key}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
              </div>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-semibold tracking-tight text-foreground">
                  {item.count}
                </span>
                <span className="text-2xl font-medium tracking-tight text-muted-foreground">
                  (
                  {item.percentage.toLocaleString("en-PH", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                  %)
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
