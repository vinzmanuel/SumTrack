"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpensesBreakdownCard } from "@/app/dashboard/expenses/expenses-breakdown-card";
import { formatMoney } from "@/app/dashboard/expenses/format";
import { ExpensesTrendChart } from "@/app/dashboard/expenses/expenses-trend-chart";
import type { ExpenseBranchComparisonItem, ExpenseHighestSpendDayItem, ExpenseTopDriver, ExpensesResultsData } from "@/app/dashboard/expenses/types";
import {
  formatCollectionsAxisCurrency,
  formatCollectionsDisplayDate,
  formatCollectionsInteger,
  formatCollectionsPercent,
} from "@/app/dashboard/collections/format";

function AnalyticsMetricCard({
  title,
  value,
  support,
}: {
  title: string;
  value: string;
  support: string;
}) {
  return (
    <Card className="h-full gap-0 py-0">
      <CardContent className="flex h-full flex-col justify-between px-4 py-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <p className="pt-2 text-xs text-muted-foreground">{support}</p>
      </CardContent>
    </Card>
  );
}

function TopDriverRow({
  item,
  showBranchName,
}: {
  item: ExpenseTopDriver;
  showBranchName: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">
            {item.description?.trim() || item.category}
          </p>
          <Badge className="text-[11px]" variant="outline">
            {item.category}
          </Badge>
          {showBranchName ? (
            <Badge className="text-[11px]" variant="outline">
              {item.branchName}
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{formatCollectionsDisplayDate(item.expenseDate)}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-foreground">{formatMoney(item.amount)}</p>
      </div>
    </div>
  );
}

function BranchComparisonRow({ item }: { item: ExpenseBranchComparisonItem }) {
  return (
    <div className="space-y-2 border-b border-border/60 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
          <p className="text-xs text-muted-foreground">
            {formatCollectionsInteger(item.expenseCount)} expense{item.expenseCount === 1 ? "" : "s"}
            {item.topCategory ? ` • top category: ${item.topCategory}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-foreground">{formatMoney(item.amount)}</p>
          <p className="text-xs text-muted-foreground">
            {item.expenseToCollectionsRatio !== null
              ? `${formatCollectionsPercent(item.expenseToCollectionsRatio)} of collections`
              : "No collections context"}
          </p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${Math.max(item.share, item.share > 0 ? 8 : 0)}%` }}
        />
      </div>
    </div>
  );
}

function HighestSpendDayRow({ item }: { item: ExpenseHighestSpendDayItem }) {
  return (
    <div className="space-y-2 border-b border-border/60 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
          <p className="text-xs text-muted-foreground">
            {formatCollectionsInteger(item.expenseCount)} expense{item.expenseCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-foreground">{formatMoney(item.amount)}</p>
          <p className="text-xs text-muted-foreground">{formatCollectionsPercent(item.share)}</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-sky-500"
          style={{ width: `${Math.max(item.share, item.share > 0 ? 8 : 0)}%` }}
        />
      </div>
    </div>
  );
}

export function ExpensesAnalyticsSection({
  data,
  isPending,
  isMultiBranchScope,
}: {
  data: ExpensesResultsData;
  isPending: boolean;
  isMultiBranchScope: boolean;
}) {
  const { analytics } = data;
  const largestExpenseSupport =
    analytics.summary.largestExpenseDate && analytics.summary.largestExpenseCategory
      ? `${analytics.summary.largestExpenseCategory} on ${formatCollectionsDisplayDate(analytics.summary.largestExpenseDate)}`
      : "No expense drivers in this scope yet";

  return (
    <div className="relative space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AnalyticsMetricCard
          support={
            analytics.summary.totalCollections > 0
              ? `Against ${formatMoney(analytics.summary.totalCollections)} in collections`
              : "No collections recorded in the same scope"
          }
          title="Expense-to-Collections Ratio"
          value={
            analytics.summary.expenseToCollectionsRatio !== null
              ? formatCollectionsPercent(analytics.summary.expenseToCollectionsRatio)
              : "N/A"
          }
        />
        <AnalyticsMetricCard
          support="Days with at least one recorded expense"
          title="Days with Expenses"
          value={formatCollectionsInteger(analytics.summary.daysWithExpenses)}
        />
        <AnalyticsMetricCard
          support={`Across ${formatCollectionsInteger(analytics.summary.daysWithExpenses)} active spend day${analytics.summary.daysWithExpenses === 1 ? "" : "s"}`}
          title="Avg Expense / Active Day"
          value={formatMoney(analytics.summary.averageExpensePerActiveDay)}
        />
        <AnalyticsMetricCard
          support={largestExpenseSupport}
          title="Largest Expense"
          value={formatMoney(analytics.summary.largestExpenseAmount)}
        />
        <AnalyticsMetricCard
          support="Share of total spend taken by the three biggest expenses"
          title="Top 3 Expense Share"
          value={formatCollectionsPercent(analytics.summary.topThreeExpenseShare)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.95fr)]">
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="pb-2 pt-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">Expenses Over Time</CardTitle>
              <p className="text-sm text-muted-foreground">
                Track when spending happened and whether it stayed steady, clustered, or spike-driven.
              </p>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-3">
            <ExpensesTrendChart
              axisFormatter={formatCollectionsAxisCurrency}
              chart={analytics.trend}
              emptyMessage="No expense trend is available for this scope."
              valueFormatter={formatMoney}
            />
          </CardContent>
        </Card>

        <ExpensesBreakdownCard data={data} isPending={false} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.95fr)]">
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="pb-2 pt-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">Top Expense Drivers</CardTitle>
              <p className="text-sm text-muted-foreground">
                Surface the specific expenses that contributed the most weight inside the selected scope.
              </p>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-2">
            {analytics.topDrivers.length > 0 ? (
              analytics.topDrivers.map((item) => (
                <TopDriverRow item={item} key={item.expenseId} showBranchName={isMultiBranchScope} />
              ))
            ) : (
              <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-10 text-center">
                <p className="text-sm font-medium text-foreground">No expense drivers are available for this scope.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Adjust the filters to widen the expense activity being analyzed.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {analytics.supportMode === "branch-comparison" ? (
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="pb-2 pt-4">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">{analytics.branchComparison.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{analytics.branchComparison.description}</p>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-2">
              {analytics.branchComparison.items.length > 0 ? (
                analytics.branchComparison.items.map((item) => (
                  <BranchComparisonRow item={item} key={item.key} />
                ))
              ) : (
                <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
                  {analytics.branchComparison.emptyMessage}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="pb-2 pt-4">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">{analytics.highestSpendDays.title}</CardTitle>
                <p className="text-sm text-muted-foreground">{analytics.highestSpendDays.description}</p>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-2">
              {analytics.highestSpendDays.items.length > 0 ? (
                analytics.highestSpendDays.items.map((item) => (
                  <HighestSpendDayRow item={item} key={item.key} />
                ))
              ) : (
                <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
                  {analytics.highestSpendDays.emptyMessage}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {isPending ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/65 backdrop-blur-[1px]">
          <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
            Updating expense analytics...
          </div>
        </div>
      ) : null}
    </div>
  );
}
