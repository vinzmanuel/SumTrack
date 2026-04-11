"use client";

import * as React from "react";
import { Pie, PieChart } from "recharts";
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
    <div className="min-w-52 rounded-md border bg-background/95 p-3 shadow-lg backdrop-blur">
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
  const title = data.breakdownMode === "branch" ? "Expense Distribution by Branch" : "Expense Distribution by Category";
  const description =
    data.breakdownMode === "branch"
      ? "Use this support view to see how the current expense scope splits across branches."
      : "Use this support view to see which categories carry the most spend in the selected scope.";
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
  return (
    <div className="relative">
      <Card className="gap-0 overflow-hidden rounded-md py-0">
        <CardHeader className="pb-2 pt-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-3">
          {data.breakdownRows.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 px-5 py-12 text-center">
              <p className="text-base font-medium text-foreground">No expense distribution available for this scope.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Adjust the branch, period, or category filters to populate the breakdown.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-border/70 bg-muted/10 p-2">
              <div className="mx-auto w-full max-w-[520px]">
                <div className="h-[280px]">
                  <ChartContainer className="h-[280px] w-full" config={chartConfig}>
                    <PieChart>
                      <ChartTooltip content={<BreakdownTooltip />} cursor={false} />
                      <Pie
                        cx="50%"
                        cy="50%"
                        data={data.breakdownRows}
                        dataKey="amount"
                        innerRadius={82}
                        legendType="circle"
                        nameKey="key"
                        outerRadius={126}
                        stroke="none"
                        strokeWidth={0}
                      />
                    </PieChart>
                  </ChartContainer>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 pt-4 text-sm text-muted-foreground">
                  {data.breakdownRows.map((row) => (
                    <div className="flex items-center gap-2" key={row.key}>
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.fill }} />
                      <span>{row.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isPending ? (
        <div className="bg-background/65 absolute inset-0 flex items-center justify-center rounded-md backdrop-blur-[1px]">
          <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
            Updating expense analytics...
          </div>
        </div>
      ) : null}
    </div>
  );
}
