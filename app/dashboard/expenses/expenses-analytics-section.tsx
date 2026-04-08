"use client";

import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ExpensesBreakdownCard } from "@/app/dashboard/expenses/expenses-breakdown-card";
import { formatMoney } from "@/app/dashboard/expenses/format";
import { ExpensesTrendChart } from "@/app/dashboard/expenses/expenses-trend-chart";
import type {
  ExpenseBranchComparisonItem,
  ExpenseBranchMixItem,
  ExpenseGroupedSpendSummary,
  ExpenseHighestSpendDayItem,
  ExpenseMiscDescriptionItem,
  ExpenseTopDriver,
  ExpensesResultsData,
} from "@/app/dashboard/expenses/types";
import {
  formatCollectionsAxisCurrency,
  formatCollectionsDisplayDate,
  formatCollectionsInteger,
  formatCollectionsPercent,
} from "@/app/dashboard/collections/format";

function formatShare(value: number) {
  return formatCollectionsPercent(value);
}

function toBarChartData(chart: ExpensesResultsData["analytics"]["salaryRhythm"]["chart"]) {
  return chart.rows.map((row) => ({
    bucket: row.bucket,
    ...Object.fromEntries(
      chart.series.map((series) => [series.key, Number(row.values[series.key] ?? 0)]),
    ),
  }));
}

function AnalyticsMetricCard({
  eyebrow,
  title,
  value,
  support,
  tone = "default",
}: {
  eyebrow?: string;
  title: string;
  value: string;
  support: string;
  tone?: "default" | "accent";
}) {
  return (
    <Card className="h-full gap-0 overflow-hidden py-0">
      <CardContent className="flex h-full flex-col justify-between px-4 py-4">
        <div className="space-y-2">
          {eyebrow ? (
            <p
              className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                tone === "accent" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"
              }`}
            >
              {eyebrow}
            </p>
          ) : null}
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          </div>
        </div>
        <p className="pt-3 text-xs text-muted-foreground">{support}</p>
      </CardContent>
    </Card>
  );
}

function SectionShell({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="pb-2 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-3">{children}</CardContent>
    </Card>
  );
}

function SpendShareBlock({
  title,
  summary,
  tone,
}: {
  title: string;
  summary: ExpenseGroupedSpendSummary;
  tone: "emerald" | "sky" | "amber" | "violet";
}) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-500"
      : tone === "sky"
        ? "bg-sky-500"
        : tone === "amber"
          ? "bg-amber-500"
          : "bg-violet-500";

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/[0.12] p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs leading-5 text-muted-foreground">{summary.categories.join(", ")}</p>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xl font-semibold text-foreground">{formatMoney(summary.amount)}</p>
          <p className="text-xs text-muted-foreground">
            {formatShare(summary.share)} of spend • {formatCollectionsInteger(summary.expenseCount)} entries
          </p>
        </div>
        <Badge className="rounded-md border-0 bg-background text-foreground shadow-sm">
          {formatShare(summary.share)}
        </Badge>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${toneClass}`}
          style={{ width: `${Math.max(summary.share, summary.share > 0 ? 8 : 0)}%` }}
        />
      </div>
    </div>
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

function BranchMixRow({ item }: { item: ExpenseBranchMixItem }) {
  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/[0.12] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{item.label}</p>
            <Badge className="rounded-md border-0 bg-background text-foreground shadow-sm">
              {item.disciplineLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatCollectionsInteger(item.expenseCount)} entries
            {item.topCategory ? ` • top category: ${item.topCategory}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">{formatMoney(item.amount)}</p>
          <p className="text-xs text-muted-foreground">
            {item.expenseToCollectionsRatio !== null
              ? `${formatCollectionsPercent(item.expenseToCollectionsRatio)} of collections`
              : "No collections context"}
          </p>
        </div>
      </div>
      <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
        <p>Fixed {formatShare(item.fixedShare)} • Variable {formatShare(item.variableShare)}</p>
        <p>Salary {formatShare(item.salaryShare)} • Utilities {formatShare(item.utilityShare)}</p>
        <p>Miscellaneous {formatShare(item.miscellaneousShare)}</p>
      </div>
      <div className="space-y-2">
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          <div className="bg-emerald-500" style={{ width: `${item.fixedShare}%` }} />
          <div className="bg-amber-500" style={{ width: `${item.variableShare}%` }} />
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          <div className="bg-sky-500" style={{ width: `${item.salaryShare}%` }} />
          <div className="bg-violet-500" style={{ width: `${item.utilityShare}%` }} />
          <div className="bg-rose-500" style={{ width: `${item.miscellaneousShare}%` }} />
        </div>
      </div>
    </div>
  );
}

function MiscDescriptionRow({ item }: { item: ExpenseMiscDescriptionItem }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
        <p className="text-xs text-muted-foreground">
          {formatCollectionsInteger(item.count)} occurrence{item.count === 1 ? "" : "s"}
        </p>
      </div>
      <p className="shrink-0 text-sm font-semibold text-foreground">{formatMoney(item.amount)}</p>
    </div>
  );
}

function MultiSeriesBarChart({
  chart,
  height = "h-[280px] md:h-[320px]",
}: {
  chart: ExpensesResultsData["analytics"]["salaryRhythm"]["chart"];
  height?: string;
}) {
  if (chart.noData || chart.series.length === 0) {
    return (
      <div className={`${height} flex items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 text-center text-sm text-muted-foreground`}>
        No chart data is available for the selected scope.
      </div>
    );
  }

  const chartConfig = Object.fromEntries(
    chart.series.map((series) => [
      series.key,
      {
        label: series.label,
        color: series.color,
      },
    ]),
  ) satisfies ChartConfig;
  const chartData = toBarChartData(chart);

  return (
    <ChartContainer className={height} config={chartConfig}>
      <RechartsBarChart accessibilityLayer data={chartData} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis axisLine={false} dataKey="bucket" minTickGap={18} tickLine={false} tickMargin={8} />
        <YAxis
          axisLine={false}
          tickFormatter={(value) => formatCollectionsAxisCurrency(Number(value ?? 0))}
          tickLine={false}
          width={72}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(value) => formatMoney(Number(value ?? 0))} />}
          cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
        />
        <ChartLegend content={<ChartLegendContent className="justify-end pt-2" />} />
        {chart.series.map((series) => (
          <Bar
            dataKey={series.key}
            fill={`var(--color-${series.key})`}
            key={series.key}
            maxBarSize={28}
            radius={[8, 8, 0, 0]}
          />
        ))}
      </RechartsBarChart>
    </ChartContainer>
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
  const highestSpendDaySupport =
    analytics.summary.highestSpendDayDate !== null
      ? `${formatMoney(analytics.summary.highestSpendDayAmount)} on ${formatCollectionsDisplayDate(analytics.summary.highestSpendDayDate)}`
      : "No concentrated spend days yet";
  const salaryRhythmSupport =
    analytics.salaryRhythm.totalAmount > 0
      ? `${formatCollectionsInteger(analytics.salaryRhythm.monthEndHigherMonths)} month${analytics.salaryRhythm.monthEndHigherMonths === 1 ? "" : "s"} ended higher`
      : "No salary rhythm visible in this scope";

  return (
    <div className="relative space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <AnalyticsMetricCard
          eyebrow="Spend"
          support={
            analytics.summary.topCategory
              ? `Top category: ${analytics.summary.topCategory} at ${formatShare(analytics.summary.topCategoryShare)}`
              : "No category concentration in this scope"
          }
          title="Total Expenses"
          tone="accent"
          value={formatMoney(data.totalAmount)}
        />
        <AnalyticsMetricCard
          eyebrow="Pressure"
          support={
            analytics.summary.totalCollections > 0
              ? `Against ${formatMoney(analytics.summary.totalCollections)} in collections`
              : "No collections recorded in the same scope"
          }
          title="Expense-to-Collections"
          value={
            analytics.summary.expenseToCollectionsRatio !== null
              ? formatCollectionsPercent(analytics.summary.expenseToCollectionsRatio)
              : "N/A"
          }
        />
        <AnalyticsMetricCard
          eyebrow="Structure"
          support={`${formatMoney(analytics.summary.totalVariableSpend)} variable spend`}
          title="Fixed Spend Share"
          value={formatShare(analytics.summary.fixedSpendShare)}
        />
        <AnalyticsMetricCard
          eyebrow="Spike"
          support={largestExpenseSupport}
          title="Largest Expense"
          value={formatMoney(analytics.summary.largestExpenseAmount)}
        />
        <AnalyticsMetricCard
          eyebrow="Payroll"
          support={salaryRhythmSupport}
          title="Salary Share"
          value={formatShare(analytics.summary.salaryShare)}
        />
        <AnalyticsMetricCard
          eyebrow="Watchlist"
          support={`${formatCollectionsInteger(analytics.summary.miscellaneousCount)} miscellaneous entries`}
          title="Utilities + Misc"
          value={`${formatShare(analytics.summary.utilityShare)} / ${formatShare(analytics.summary.miscellaneousShare)}`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.05fr)]">
        <SectionShell
          description="Separate baseline branch costs from the more operational spend that can drift with branch behavior."
          title="Spend Structure"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <SpendShareBlock summary={analytics.structure.fixed} title="Fixed vs Baseline Spend" tone="emerald" />
            <SpendShareBlock summary={analytics.structure.variable} title="Variable Operational Spend" tone="amber" />
          </div>
        </SectionShell>

        <SectionShell
          description="Keep the broad expense story visible: overall trend, category concentration, and the heaviest day in scope."
          title="Expense Pressure Snapshot"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-muted/[0.12] p-4">
              <p className="text-sm font-semibold text-foreground">Top category</p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {analytics.summary.topCategory ?? "No dominant category"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {analytics.summary.topCategory
                  ? `${formatShare(analytics.summary.topCategoryShare)} of total spend`
                  : "No category split available"}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/[0.12] p-4">
              <p className="text-sm font-semibold text-foreground">Highest-spend day</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{formatMoney(analytics.summary.highestSpendDayAmount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{highestSpendDaySupport}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/[0.12] p-4 md:col-span-2">
              <p className="text-sm font-semibold text-foreground">Largest expense</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{formatMoney(analytics.summary.largestExpenseAmount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{largestExpenseSupport}</p>
            </div>
          </div>
        </SectionShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.95fr)]">
        <SectionShell
          description="Track when spending actually concentrated across the selected period, then use the support view to see what categories or branches dominated it."
          title="Expense Trend and Mix"
        >
          <ExpensesTrendChart
            axisFormatter={formatCollectionsAxisCurrency}
            chart={analytics.trend}
            emptyMessage="No expense trend is available for this scope."
            valueFormatter={formatMoney}
          />
        </SectionShell>

        <ExpensesBreakdownCard data={data} isPending={false} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <SectionShell
          description="Infer payroll rhythm from Salary rows by splitting entries into the 15th-side and month-end side of the month."
          title="Salary Rhythm"
          action={
            <Badge className="rounded-md border-0 bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              {formatShare(analytics.salaryRhythm.share)} of spend
            </Badge>
          }
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-muted/[0.12] p-4">
              <p className="text-sm font-semibold text-foreground">Mid-month</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{formatMoney(analytics.salaryRhythm.midMonthTotal)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCollectionsInteger(analytics.salaryRhythm.midMonthCount)} entries
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/[0.12] p-4">
              <p className="text-sm font-semibold text-foreground">Month-end</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{formatMoney(analytics.salaryRhythm.monthEndTotal)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatCollectionsInteger(analytics.salaryRhythm.monthEndCount)} entries
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/[0.12] p-4">
              <p className="text-sm font-semibold text-foreground">Month-end higher</p>
              <p className="mt-2 text-xl font-semibold text-foreground">
                {formatCollectionsInteger(analytics.salaryRhythm.monthEndHigherMonths)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                inferred month{analytics.salaryRhythm.monthEndHigherMonths === 1 ? "" : "s"} with uplift
              </p>
            </div>
          </div>
          <div className="mt-4">
            <MultiSeriesBarChart chart={analytics.salaryRhythm.chart} />
          </div>
        </SectionShell>

        <SectionShell
          description="Treat Electricity and Water as a utility layer so you can see how much of the branch baseline is being consumed by service costs."
          title="Utility Share and Trend"
          action={
            <Badge className="rounded-md border-0 bg-sky-500/15 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400">
              {formatShare(analytics.utilities.share)} of spend
            </Badge>
          }
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-muted/[0.12] p-4">
              <p className="text-sm font-semibold text-foreground">Electricity</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{formatMoney(analytics.utilities.electricityAmount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatShare(analytics.utilities.electricityShare)} of utilities</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/[0.12] p-4">
              <p className="text-sm font-semibold text-foreground">Water</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{formatMoney(analytics.utilities.waterAmount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatShare(analytics.utilities.waterShare)} of utilities</p>
            </div>
          </div>
          <div className="mt-4">
            <MultiSeriesBarChart chart={analytics.utilities.chart} height="h-[260px] md:h-[300px]" />
          </div>
        </SectionShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SectionShell
          description="Keep an eye on exception-style spending. Miscellaneous should stay visible and explainable, not quietly soak up too much spend."
          title="Miscellaneous Monitor"
          action={
            analytics.miscellaneous.overuseFlag ? (
              <Badge className="rounded-md border-0 bg-amber-500/15 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                Watch usage
              </Badge>
            ) : (
              <Badge className="rounded-md border-0 bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                Within expected range
              </Badge>
            )
          }
        >
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-muted/[0.12] p-4">
              <p className="text-sm font-semibold text-foreground">Total miscellaneous</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{formatMoney(analytics.miscellaneous.totalAmount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatShare(analytics.miscellaneous.share)} of spend</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/[0.12] p-4">
              <p className="text-sm font-semibold text-foreground">Frequency</p>
              <p className="mt-2 text-xl font-semibold text-foreground">{formatCollectionsInteger(analytics.miscellaneous.count)}</p>
              <p className="mt-1 text-xs text-muted-foreground">miscellaneous entries in scope</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/[0.12] p-4">
              <p className="text-sm font-semibold text-foreground">Interpretation</p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {analytics.miscellaneous.overuseFlag ? "Potential overuse" : "Controlled usage"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Flagged when share or usage frequency starts looking too heavy.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-border/70 bg-muted/[0.12] p-4">
            <div className="mb-3 space-y-1">
              <p className="text-sm font-semibold text-foreground">Top miscellaneous descriptions</p>
              <p className="text-xs text-muted-foreground">
                These descriptions help reveal whether branches are using Miscellaneous as a real exception bucket or a vague catch-all.
              </p>
            </div>
            {analytics.miscellaneous.topDescriptions.length > 0 ? (
              analytics.miscellaneous.topDescriptions.map((item) => (
                <MiscDescriptionRow item={item} key={item.label} />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-background px-5 py-10 text-center text-sm text-muted-foreground">
                No miscellaneous descriptions are available for this scope.
              </div>
            )}
          </div>
        </SectionShell>

        <SectionShell
          description="Surface the specific records that are materially shaping the selected expense picture."
          title="Top Expense Drivers"
        >
          {analytics.topDrivers.length > 0 ? (
            analytics.topDrivers.map((item) => (
              <TopDriverRow item={item} key={item.expenseId} showBranchName={isMultiBranchScope} />
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-5 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No expense drivers are available for this scope.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Adjust the filters to widen the expense activity being analyzed.
              </p>
            </div>
          )}
        </SectionShell>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.95fr)]">
        {isMultiBranchScope ? (
          <SectionShell
            description="Compare how each branch carries its cost mix, how much is baseline vs drift, and whether miscellaneous usage is starting to feel sloppy."
            title="Branch Expense Mix and Discipline"
          >
            {analytics.branchMix.length > 0 ? (
              <div className="space-y-3">
                {analytics.branchMix.map((item) => (
                  <BranchMixRow item={item} key={item.key} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
                No branch mix comparison is available for the current scope.
              </div>
            )}
          </SectionShell>
        ) : (
          <SectionShell
            description={analytics.highestSpendDays.description}
            title={analytics.highestSpendDays.title}
          >
            {analytics.highestSpendDays.items.length > 0 ? (
              analytics.highestSpendDays.items.map((item) => (
                <HighestSpendDayRow item={item} key={item.key} />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
                {analytics.highestSpendDays.emptyMessage}
              </div>
            )}
          </SectionShell>
        )}

        {analytics.supportMode === "branch-comparison" ? (
          <SectionShell
            description={analytics.branchComparison.description}
            title={analytics.branchComparison.title}
          >
            {analytics.branchComparison.items.length > 0 ? (
              analytics.branchComparison.items.map((item) => (
                <BranchComparisonRow item={item} key={item.key} />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-5 py-10 text-center text-sm text-muted-foreground">
                {analytics.branchComparison.emptyMessage}
              </div>
            )}
          </SectionShell>
        ) : (
          <SectionShell
            description="Use this support panel to compare the visible branch against the broader spend concentration inside the currently filtered period."
            title="Expense Scope Pressure"
          >
            <div className="grid gap-3">
              <div className="rounded-xl border border-border/70 bg-muted/[0.12] p-4">
                <p className="text-sm font-semibold text-foreground">Average expense per active day</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{formatMoney(analytics.summary.averageExpensePerActiveDay)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Across {formatCollectionsInteger(analytics.summary.daysWithExpenses)} active spend day{analytics.summary.daysWithExpenses === 1 ? "" : "s"}.
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/[0.12] p-4">
                <p className="text-sm font-semibold text-foreground">Top 3 expense share</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{formatShare(analytics.summary.topThreeExpenseShare)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Share of total spend absorbed by the three biggest expense rows.
                </p>
              </div>
            </div>
          </SectionShell>
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
