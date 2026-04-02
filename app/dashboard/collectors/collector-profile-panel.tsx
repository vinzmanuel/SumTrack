import type { ReactNode } from "react";
import { CollectorLoanPortfolioChart } from "@/app/dashboard/collectors/collector-loan-portfolio-chart";
import { CollectorProfileTrendChart } from "@/app/dashboard/collectors/collector-profile-trend-chart";
import { CollectorRankContextCard } from "@/app/dashboard/collectors/collector-rank-context-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CollectorInfoHint } from "@/app/dashboard/collectors/collector-info-hint";
import { resolveCollectorProfileDateRange } from "@/app/dashboard/collectors/profile-filters";
import {
  formatCollectorsAxisCurrency,
  formatCollectorsCurrency,
  formatCollectorsInteger,
  formatCollectorsNullablePercent,
  formatCollectorsPercent,
  formatCollectorsSignedPercent,
} from "@/app/dashboard/collectors/format";
import type { CollectorProfileData } from "@/app/dashboard/collectors/types";

type PeriodSignalItem = {
  key: string;
  label: ReactNode;
  value: string;
  helper?: string;
};

export function CollectorProfilePanel({
  data,
  showRankContext = true,
  periodControl,
}: {
  data: CollectorProfileData;
  showRankContext?: boolean;
  periodControl?: ReactNode;
}) {
  const activeTotalPayableLoad = data.activePrincipalLoad + data.activeInterestPotential;
  const periodLabel = data.periodLabel.toLowerCase();
  const isLifetimeView = data.periodKey === "lifetime";
  const trendLabel = data.periodChangePercent === null
    ? "New activity vs previous equivalent period"
    : `${formatCollectorsSignedPercent(data.periodChangePercent)} vs previous equivalent period`;
  const selectedPeriodScale = Math.max(data.totalCollected, data.expectedCollections, 1);
  const monthlyAverageScale = Math.max(
    data.averageMonthlyCollections,
    data.lifetimeMetrics.lifetimeAverageMonthlyCollection,
    1,
  );
  const liveRatioScale = Math.max(data.liveRecoveryRate, data.activeEfficiencyRatio ?? 0, 100);
  const periodDateRange = resolveCollectorProfileDateRange(data.periodKey);
  const workingDaysInPeriod = periodDateRange
    ? countCollectionWorkingDays(periodDateRange.start, periodDateRange.end)
    : null;
  const collectionDaysCoverage = workingDaysInPeriod && workingDaysInPeriod > 0
    ? (data.collectionDays / workingDaysInPeriod) * 100
    : null;
  const completionConversionPercent = formatCompletionConversionPercent(data.periodCompletedLoans, data.periodDueLoans);
  const completionConversionHelper = formatCompletionConversionHelper(data.periodCompletedLoans, data.periodDueLoans);
  const borrowerFollowThroughValue = formatBorrowerFollowThroughValue(
    data.collectionEntries,
    data.borrowersHandledCount,
  );
  const borrowerFollowThroughHelper = formatBorrowerFollowThroughHelper(data.borrowersHandledCount);
  const periodSignals: PeriodSignalItem[] = [
    {
      key: "missed-rate",
      label: "Missed Rate",
      value: formatCollectorsPercent(data.missedPaymentRate),
      helper: `${formatCollectorsInteger(data.missedPaymentCount)} missed payments`,
    },
    {
      key: "portfolio-yield",
      label: "Portfolio Yield",
      value: formatCollectorsNullablePercent(data.portfolioYieldRate, "No portfolio base"),
      helper: `Base ${formatCollectorsCurrency(data.periodPortfolioPrincipal)}`,
    },
    {
      key: "portfolio-at-risk",
      label: "Portfolio at Risk",
      value: formatCollectorsNullablePercent(data.portfolioAtRiskRate, "No portfolio base"),
      helper: `${formatCollectorsCurrency(data.periodPortfolioAtRiskAmount)} overdue`,
    },
    {
      key: "collection-days-coverage",
      label: "Collection Days Coverage",
      value: collectionDaysCoverage !== null ? formatCollectorsPercent(collectionDaysCoverage) : "N/A",
      helper: collectionDaysCoverage !== null
        ? `${formatCollectorsInteger(data.collectionDays)} of ${formatCollectorsInteger(workingDaysInPeriod ?? 0)} working days`
        : "No working-day coverage available",
    },
    {
      key: "completion-conversion",
      label: (
        <CollectorInfoHint
          help="Completed loans in the selected period out of all due loans handled in the selected period. Archived loans should count as completed for this calculation."
          label="Completion Conversion"
        />
      ),
      value: completionConversionPercent,
      helper: completionConversionHelper,
    },
    {
      key: "borrower-follow-through",
      label: (
        <CollectorInfoHint
          help="Average number of collection entries recorded per borrower handled in the selected period."
          label="Borrower Follow-Through"
        />
      ),
      value: borrowerFollowThroughValue,
      helper: borrowerFollowThroughHelper,
    },
  ];
  const uniquePeriodSignals = Array.from(
    new Map(periodSignals.map((signal) => [signal.key, signal])).values(),
  );
  const portfolioStatusItems = [
    {
      key: "active",
      label: "Active",
      count: data.loanPortfolio.active,
      toneClassName: "bg-emerald-500",
    },
    {
      key: "overdue",
      label: "Overdue",
      count: data.loanPortfolio.overdue,
      toneClassName: "bg-orange-500",
    },
    {
      key: "completed",
      label: "Completed",
      count: data.loanPortfolio.completed,
      toneClassName: "bg-blue-500",
    },
    {
      key: "archived",
      label: "Archived",
      count: data.loanPortfolio.archived,
      toneClassName: "bg-slate-500",
    },
    {
      key: "abandoned",
      label: "Abandoned",
      count: data.loanPortfolio.abandoned,
      toneClassName: "bg-violet-500",
    },
  ] as const;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <SectionIntro
          badges={
            <>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
                Status: {data.status === "active" ? "Active" : "Inactive"}
              </Badge>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
                Period: {data.periodLabel}
              </Badge>
              <Badge className="border-border/70 bg-card text-zinc-700 shadow-xs" variant="outline">
                {trendLabel}
              </Badge>
            </>
          }
          description={
            isLifetimeView
              ? "Career totals and long-run collection pace across the collector's visible history."
              : `Period-based analytics for this collector during ${periodLabel}.`
          }
          eyebrow="Selected period"
          title="Performance Snapshot"
          toneClassName="text-indigo-600"
          trailing={periodControl ? <div className="w-full sm:w-[220px]">{periodControl}</div> : null}
        />

        <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
          <div className="grid h-full items-stretch gap-4 xl:grid-rows-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
            <Card className="flex h-full flex-col gap-0 py-0 shadow-sm">
              <CardHeader className="gap-0 pb-2 pt-4">
                <CardTitle className="text-base font-semibold tracking-tight">Collections Trend</CardTitle>
                <CardDescription className="text-sm leading-6">
                  Collected output against expected pace across the selected period.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 pb-6 pt-0">
                <div className="flex min-h-0 w-full flex-1 rounded-2xl border border-border/70 bg-muted/10 p-3">
                  <CollectorProfileTrendChart
                    axisFormatter={formatCollectorsAxisCurrency}
                    chart={data.periodTrendChart}
                    condensed
                    fillHeight
                    valueFormatter={formatCollectorsCurrency}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid h-full items-stretch gap-4 md:grid-cols-2">
              <ComparisonModule
                barHeightClassName="h-5"
                className="h-full"
                description="Selected-period output against target dues."
                footer={
                  <div className="grid gap-2 sm:grid-cols-2">
                    <InlineStat label="Efficiency" value={formatCollectorsNullablePercent(data.efficiencyRatio, "No scheduled due")} />
                    <InlineStat label="Target Gap" value={formatTargetGapValue(data.totalCollected, data.expectedCollections)} />
                  </div>
                }
                rows={[
                  {
                    label: "Actual collected",
                    note: "Cash collected in the selected period",
                    toneClassName: "bg-emerald-500",
                    value: formatCollectorsCurrency(data.totalCollected),
                    widthPercent: (data.totalCollected / selectedPeriodScale) * 100,
                  },
                  {
                    label: "Expected collected",
                    note: "Target amount inside the selected period",
                    toneClassName: "bg-sky-500",
                    value: formatCollectorsCurrency(data.expectedCollections),
                    widthPercent: (data.expectedCollections / selectedPeriodScale) * 100,
                  },
                ]}
                title="Actual vs Expected"
              />

              <ComparisonModule
                barHeightClassName="h-5"
                className="h-full"
                description="Selected-period pace compared with lifetime monthly average."
                footer={
                  <div className="grid gap-2 sm:grid-cols-2">
                    <InlineStat
                      label="Pace Ratio"
                      value={formatPaceRatioValue(
                        data.averageMonthlyCollections,
                        data.lifetimeMetrics.lifetimeAverageMonthlyCollection,
                      )}
                    />
                    <InlineStat label="Average per Collection" value={formatCollectorsCurrency(data.averageCollectionAmount)} />
                  </div>
                }
                rows={[
                  {
                    label: "Selected-period monthly avg",
                    note: "Average monthly collections inside the active period",
                    toneClassName: "bg-violet-500",
                    value: formatCollectorsCurrency(data.averageMonthlyCollections),
                    widthPercent: (data.averageMonthlyCollections / monthlyAverageScale) * 100,
                  },
                  {
                    label: "Lifetime monthly avg",
                    note: "Long-run monthly average across visible history",
                    toneClassName: "bg-amber-500",
                    value: formatCollectorsCurrency(data.lifetimeMetrics.lifetimeAverageMonthlyCollection),
                    widthPercent: (data.lifetimeMetrics.lifetimeAverageMonthlyCollection / monthlyAverageScale) * 100,
                  },
                ]}
                title="Monthly Pace vs Lifetime"
              />
            </div>
          </div>

          <div className="grid h-full items-stretch gap-4 xl:grid-rows-[auto_minmax(0,1fr)]">
            {showRankContext ? (
              <CollectorRankContextCard
                basisLabel={`Ranked by average monthly collections in ${periodLabel}.`}
                branchCollectorCount={data.branchCollectorCount}
                branchName={data.branchName}
                branchRank={data.branchRank}
                className="shadow-sm"
                nationwideRank={data.nationwideRank}
                visibleCollectorCount={data.visibleCollectorCount}
              />
            ) : null}

            <Card className="h-full gap-0 py-0 shadow-sm">
              <CardHeader className="gap-0 pb-2 pt-4">
                <CardTitle className="text-base font-semibold tracking-tight">Period Signals</CardTitle>
                <CardDescription className="text-sm leading-6">
                  Activity, risk, and selected-period portfolio signals that support the main chart.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-6 pt-0">
                <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                  <p className="text-sm font-medium text-muted-foreground">Productivity</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                    {formatCollectorsInteger(data.productivityCount)} transactions
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {formatCollectorsInteger(data.collectionDays)} collection days / {formatCollectorsInteger(data.collectionEntries)} entries in {periodLabel}.
                  </p>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-2">
                  {uniquePeriodSignals.map((signal) => (
                    <SignalMetricCard
                      helper={signal.helper}
                      key={signal.key}
                      label={signal.label}
                      value={signal.value}
                    />
                  ))}
                </div>

              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionIntro
          badges={
            <>
              <Badge className="border-border/70 bg-card text-zinc-700 shadow-xs" variant="outline">
                {formatCollectorsInteger(data.loanPortfolio.total)} loans in view
              </Badge>
              <Badge className="border-border/70 bg-card text-zinc-700 shadow-xs" variant="outline">
                Live operational context
              </Badge>
            </>
          }
          description="Current loan-state composition, live workload, and recovery context for this collector's assigned book."
          eyebrow="Current portfolio"
          title="Loan Portfolio"
          toneClassName="text-sky-700"
        />

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.95fr)]">
          <Card className="gap-0 py-0 shadow-sm">
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-base font-semibold tracking-tight">Portfolio Mix</CardTitle>
              <CardDescription className="text-sm leading-6">
                Current loan-state composition for this collector&apos;s assigned book right now.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-5 pt-0">
              <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                <CollectorLoanPortfolioChart compact counts={data.loanPortfolio} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {portfolioStatusItems.map((item) => (
                  <StatusStatCard
                    count={item.count}
                    key={item.key}
                    label={item.label}
                    percentage={
                      data.loanPortfolio.total > 0
                        ? formatCollectorsPercent((item.count / data.loanPortfolio.total) * 100)
                        : "0.0%"
                    }
                    toneClassName={item.toneClassName}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0 shadow-sm">
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-base font-semibold tracking-tight">Operational Snapshot</CardTitle>
              <CardDescription className="text-sm leading-6">
                Current workload, exposure, and live collection context tied to the active loan book.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-5 pt-0">
              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileStatCard
                  description="Active and overdue accounts still assigned."
                  title="Active Assigned Loans"
                  value={formatCollectorsInteger(data.assignedActiveLoans)}
                />
                <ProfileStatCard
                  description="Remaining interest potential on active loans."
                  title="Interest Potential"
                  value={formatCollectorsCurrency(data.activeInterestPotential)}
                />
                <ProfileStatCard
                  description="Total payable load on currently active loans."
                  title="Current Load"
                  value={formatCollectorsCurrency(activeTotalPayableLoad)}
                />
                <ProfileStatCard
                  description="Overdue principal inside the live loan book."
                  title="Overdue Exposure"
                  value={formatCollectorsCurrency(data.portfolioAtRiskAmount)}
                />
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                <p className="text-base font-semibold tracking-tight text-foreground">
                  <CollectorInfoHint
                    help="Live Recovery shows how much has been collected so far against the total payable of currently active loans. Live Efficiency shows how much has been collected so far against what those same active loans should have reached by today."
                    label="Live Recovery vs Live Efficiency"
                  />
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Current collection ratios against the active loan book.
                </p>

                <div className="mt-4 space-y-4">
                  <ComparisonBarRow
                    label="Live recovery"
                    note="Collected so far versus current active-loan total payable"
                    toneClassName="bg-emerald-500"
                    value={formatCollectorsPercent(data.liveRecoveryRate)}
                    widthPercent={(data.liveRecoveryRate / liveRatioScale) * 100}
                  />
                  <ComparisonBarRow
                    label="Live efficiency"
                    note="Collected so far versus what active loans should have reached by today"
                    toneClassName="bg-sky-500"
                    value={formatCollectorsNullablePercent(data.activeEfficiencyRatio, "No active pace")}
                    widthPercent={((data.activeEfficiencyRatio ?? 0) / liveRatioScale) * 100}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <SectionIntro
          description="Career trend and long-run pace, kept quieter than the selected-period view above."
          eyebrow="Lifetime context"
          title="Long-Run Collection Context"
          toneClassName="text-violet-700"
        />

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.85fr)]">
          <Card className="gap-0 py-0 shadow-sm">
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-base font-semibold tracking-tight">Lifetime Trend</CardTitle>
              <CardDescription className="text-sm leading-6">
                Long-run collection movement across the collector&apos;s visible history.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-5 pt-0">
              <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
                <CollectorProfileTrendChart
                  axisFormatter={formatCollectorsAxisCurrency}
                  chart={data.lifetimeTrendChart}
                  compact
                  valueFormatter={formatCollectorsCurrency}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="gap-0 py-0 shadow-sm">
            <CardHeader className="pb-3 pt-5">
              <CardTitle className="text-base font-semibold tracking-tight">Lifetime Metrics</CardTitle>
              <CardDescription className="text-sm leading-6">
                Reference context for how this collector performs over time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pb-5 pt-0">
              <MetricRow
                label="Lifetime Collected"
                value={formatCollectorsCurrency(data.lifetimeMetrics.lifetimeCollectionAmount)}
              />
              <MetricRow
                label="Lifetime Avg Monthly"
                value={formatCollectorsCurrency(data.lifetimeMetrics.lifetimeAverageMonthlyCollection)}
              />
              <MetricRow
                label="Avg Collected per Day"
                value={formatCollectorsCurrency(data.lifetimeMetrics.lifetimeAverageCollectedPerDay)}
              />
              <MetricRow
                label="Missed Payment Ratio"
                value={formatCollectorsPercent(data.lifetimeMetrics.lifetimeMissedPaymentRatio)}
              />
              <MetricRow
                label="Lifetime Entries"
                value={formatCollectorsInteger(data.lifetimeMetrics.lifetimeCollectionEntries)}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function ProfileStatCard({
  title,
  value,
  description,
}: {
  title: ReactNode;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function StatusStatCard({
  label,
  count,
  percentage,
  toneClassName,
}: {
  label: string;
  count: number;
  percentage: string;
  toneClassName: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`size-2.5 rounded-full ${toneClassName}`} />
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        <p className="text-lg font-semibold tracking-tight text-foreground">{formatCollectorsInteger(count)}</p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{percentage} of current portfolio</p>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
  badges,
  trailing,
  toneClassName,
}: {
  eyebrow: string;
  title: string;
  description: string;
  badges?: ReactNode;
  trailing?: ReactNode;
  toneClassName: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${toneClassName}`}>{eyebrow}</p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        {badges ? <div className="flex flex-wrap items-center gap-2 pt-2">{badges}</div> : null}
      </div>
      {trailing}
    </div>
  );
}

function ComparisonModule({
  title,
  description,
  rows,
  footer,
  className,
  barHeightClassName,
}: {
  title: string;
  description: string;
  rows: Array<{
    label: string;
    note: string;
    value: string;
    widthPercent: number;
    toneClassName: string;
  }>;
  footer?: ReactNode;
  className?: string;
  barHeightClassName?: string;
}) {
  return (
    <Card className={`flex h-full flex-col gap-0 py-0 shadow-sm ${className ?? ""}`}>
      <CardHeader className="gap-0 pb-2 pt-4">
        <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
        <CardDescription className="text-sm leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-4 pb-6 pt-0">
        <div className="flex min-h-0 flex-col justify-center gap-4">
          {rows.map((row) => (
            <ComparisonBarRow
              key={`${title}-${row.label}`}
              barHeightClassName={barHeightClassName}
              label={row.label}
              note={row.note}
              toneClassName={row.toneClassName}
              value={row.value}
              widthPercent={row.widthPercent}
            />
          ))}
        </div>
        {footer ? <div>{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

function parseCollectorIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function countCollectionWorkingDays(start: string, end: string) {
  const cursor = parseCollectorIsoDate(start);
  const last = parseCollectorIsoDate(end);

  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime()) || cursor > last) {
    return 0;
  }

  let days = 0;

  while (cursor <= last) {
    if (cursor.getDay() !== 0) {
      days += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function formatTargetGapValue(actualCollected: number, expectedCollected: number) {
  const gap = expectedCollected - actualCollected;

  if (Math.abs(gap) < 0.005) {
    return "On target";
  }

  return gap > 0
    ? `${formatCollectorsCurrency(gap)} behind`
    : `${formatCollectorsCurrency(Math.abs(gap))} ahead`;
}

function formatPaceRatioValue(selectedPeriodMonthlyAverage: number, lifetimeMonthlyAverage: number) {
  if (lifetimeMonthlyAverage <= 0) {
    return "No lifetime avg";
  }

  return `${formatCollectorsPercent((selectedPeriodMonthlyAverage / lifetimeMonthlyAverage) * 100)} of lifetime avg`;
}

function formatCompletionConversionPercent(completedLoans: number, dueLoans: number) {
  const conversionPercent = dueLoans > 0 ? Math.round((completedLoans / dueLoans) * 100) : 0;
  return `${formatCollectorsInteger(conversionPercent)}% conversion`;
}

function formatBorrowerFollowThroughValue(collectionEntries: number, borrowersHandledCount: number) {
  const entriesPerBorrower = borrowersHandledCount > 0 ? collectionEntries / borrowersHandledCount : 0;
  return `${entriesPerBorrower.toLocaleString("en-PH", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} entries / borrower`;
}

function formatCompletionConversionHelper(completedLoans: number, dueLoans: number) {
  return `${formatCollectorsInteger(completedLoans)} / ${formatCollectorsInteger(dueLoans)} loans completed`;
}

function formatBorrowerFollowThroughHelper(borrowersHandledCount: number) {
  const borrowerLabel = borrowersHandledCount === 1 ? "borrower" : "borrowers";
  return `Across ${formatCollectorsInteger(borrowersHandledCount)} ${borrowerLabel}`;
}

function ComparisonBarRow({
  barHeightClassName,
  label,
  note,
  value,
  toneClassName,
  widthPercent,
}: {
  barHeightClassName?: string;
  label: string;
  note: string;
  value: string;
  toneClassName: string;
  widthPercent: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-xs leading-[1.1rem] text-muted-foreground">{note}</p>
        </div>
        <p className="text-right text-base font-semibold tracking-tight text-foreground md:text-lg">{value}</p>
      </div>
      <div className={`${barHeightClassName ?? "h-2.5"} rounded-full bg-[var(--app-background)]`}>
        <div
          className={`${barHeightClassName ?? "h-2.5"} rounded-full ${toneClassName}`}
          style={{ width: `${Math.max(0, Math.min(widthPercent, 100))}%` }}
        />
      </div>
    </div>
  );
}

function SignalMetricCard({
  label,
  value,
  helper,
}: {
  label: ReactNode;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background p-3.5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {helper ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function InlineStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 px-3 py-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MetricRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-muted/20 px-4 py-2.5">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-right text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
