"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatMoney } from "@/app/dashboard/expenses/format";
import type { ExpenseBreakdownRow, ExpensesResultsData } from "@/app/dashboard/expenses/types";

function BreakdownTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: ExpenseBreakdownRow;
  }>;
}) {
  const row = payload?.[0]?.payload;

  if (!active || !row) {
    return null;
  }

  return (
    <div className="min-w-52 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
      <div className="mb-2 flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: row.fill }} />
        <p className="text-sm font-medium text-foreground">{row.label}</p>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-medium text-foreground">{formatMoney(row.amount)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Share</span>
          <span className="font-medium text-foreground">
            {row.share.toLocaleString("en-PH", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}
            %
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Entries</span>
          <span className="font-medium text-foreground">{row.expenseCount.toLocaleString("en-PH")}</span>
        </div>
      </div>
    </div>
  );
}

export function ExpensesBreakdownCard({
  data,
  isPending,
}: {
  data: ExpensesResultsData;
  isPending: boolean;
}) {
  const title = data.breakdownMode === "branch" ? "Expenses by Branch" : "Expenses by Category";
  const description =
    data.breakdownMode === "branch"
      ? "See how the current expense scope is distributed across visible branches."
      : "See how the selected branch scope is distributed across expense categories.";
  const chartConfig = React.useMemo(
    () =>
      Object.fromEntries(
        data.breakdownRows.map((row) => [
          row.key,
          {
            label: row.label,
            color: row.fill,
          },
        ]),
      ) satisfies ChartConfig,
    [data.breakdownRows],
  );

  const renderCenterLabel = React.useCallback(
    ({ viewBox }: { viewBox?: unknown }) => {
      const center =
        viewBox && typeof viewBox === "object" && "cx" in viewBox && "cy" in viewBox
          ? viewBox
          : null;

      if (!center || typeof center.cx !== "number" || typeof center.cy !== "number") {
        return null;
      }

      return (
        <text x={center.cx} y={center.cy} textAnchor="middle" dominantBaseline="middle">
          <tspan
            x={center.cx}
            y={center.cy - 4}
            className="fill-foreground font-bold"
            fontSize="24"
            fontWeight="500"
          >
            {formatMoney(data.totalAmount)}
          </tspan>
          <tspan
            x={center.cx}
            y={center.cy + 18}
            className="fill-muted-foreground"
            fontSize="12"
            fontWeight="500"
          >
            total amount
          </tspan>
        </text>
      );
    },
    [data.totalAmount],
  );

  return (
    <div className="relative">
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="pb-2 pt-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3">
          {data.breakdownRows.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-12 text-center">
              <p className="text-base font-medium text-foreground">No expense distribution available for this scope.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Adjust the branch, period, or category filters to populate the breakdown.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-stretch">
              <div className="rounded-2xl border border-border/70 bg-muted/10 p-2">
                <ChartContainer className="mx-auto h-[300px] w-full max-w-[520px]" config={chartConfig}>
                  <PieChart>
                    <ChartTooltip content={<BreakdownTooltip />} cursor={false} />
                    <Pie
                      data={data.breakdownRows}
                      dataKey="amount"
                      innerRadius={82}
                      nameKey="label"
                      outerRadius={126}
                      stroke="none"
                      strokeWidth={0}
                    >
                      <Label content={renderCenterLabel} />
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </div>

              <div className="grid gap-2.5">
                {data.breakdownRows.map((row) => (
                  <div
                    className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-muted/10 px-4 py-3"
                    key={row.key}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-3">
                        <span className="size-2.5 rounded-full" style={{ backgroundColor: row.fill }} />
                        <p className="truncate text-sm font-semibold text-foreground">{row.label}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {row.expenseCount.toLocaleString("en-PH")} expense{row.expenseCount === 1 ? "" : "s"}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-foreground">{formatMoney(row.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.share.toLocaleString("en-PH", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        %
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isPending ? (
        <div className="bg-background/65 absolute inset-0 flex items-center justify-center rounded-xl backdrop-blur-[1px]">
          <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
            Updating expense analytics...
          </div>
        </div>
      ) : null}
    </div>
  );
}
