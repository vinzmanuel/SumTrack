import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { CollectionsAreaChart } from "@/app/dashboard/collections/collections-area-chart";
import { CollectorBreakdownCard } from "@/app/dashboard/collectors/collector-breakdown-card";
import { CollectorKpiCard } from "@/app/dashboard/collectors/collector-kpi-card";
import { CollectorProfileBarChart } from "@/app/dashboard/collectors/collector-profile-bar-chart";
import { CollectorRankContextCard } from "@/app/dashboard/collectors/collector-rank-context-card";
import { CollectorsChartCard } from "@/app/dashboard/collectors/collectors-chart-card";
import {
  collectorsTrendTone,
  formatCollectorsAxisCurrency,
  formatCollectorsAxisPercent,
  formatCollectorsCurrency,
  formatCollectorsInteger,
  formatCollectorsNullablePercent,
  formatCollectorsPercent,
  formatCollectorsSignedPercent,
} from "@/app/dashboard/collectors/format";
import type { CollectorProfileData } from "@/app/dashboard/collectors/types";
import { cn } from "@/lib/utils";

export function CollectorProfilePanel({
  data,
  showRankContext = true,
}: {
  data: CollectorProfileData;
  showRankContext?: boolean;
}) {
  const productivitySpark = data.collectionDays > 0
    ? Math.min((data.productivityCount / data.collectionDays) * 12, 100)
    : Math.min(data.productivityCount * 10, 100);
  const efficiencySpark = data.efficiencyRatio ?? 0;
  const yieldSpark = data.portfolioYieldRate ?? 0;
  const riskSpark = data.portfolioAtRiskRate ?? 0;
  const periodLabel = data.periodLabel.toLowerCase();
  const isLifetimeView = data.periodKey === "lifetime";
  const trendLabel = data.periodChangePercent === null
    ? "No prior comparison"
    : `${formatCollectorsSignedPercent(data.periodChangePercent)} vs previous matching period`;

  return (
    <div className="space-y-6">
      <TremorCard className="overflow-hidden p-0">
        <div className="bg-gradient-to-r from-slate-50 via-white to-emerald-50/60 p-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
                Collector KPI Dashboard
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Performance Snapshot</h2>
              <TremorDescription>
                Period-based analytics for this collector stay here, separate from the account profile tab.
              </TremorDescription>
            </div>

            <div className="flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
                Status: {data.status === "active" ? "Active" : "Inactive"}
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-800">
                Period: {data.periodLabel}
              </span>
              <span className={cn("rounded-full border px-3 py-1", collectorsTrendTone(data.periodChangePercent))}>
                {trendLabel}
              </span>
            </div>
          </div>
        </div>
      </TremorCard>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CollectorKpiCard
          accentClassName="bg-sky-500"
          barPercent={productivitySpark}
          footer={`${formatCollectorsInteger(data.collectionDays)} collection days / ${formatCollectorsInteger(data.collectionEntries)} entries`}
          help="Shows how active this collector was in the current filter."
          subtitle={`Collection activity recorded during ${periodLabel}.`}
          title="Productivity"
          value={`${formatCollectorsInteger(data.productivityCount)} transactions`}
        />
        <CollectorKpiCard
          accentClassName="bg-emerald-500"
          barPercent={efficiencySpark}
          footer={`Expected ${formatCollectorsCurrency(data.expectedCollections)}`}
          help="Shows how much of the expected cash was actually collected in the current filter."
          subtitle={`Cash collected versus expected dues during ${periodLabel}.`}
          title="Efficiency"
          value={formatCollectorsNullablePercent(data.efficiencyRatio, "No scheduled due")}
        />
        <CollectorKpiCard
          accentClassName="bg-violet-500"
          barPercent={yieldSpark}
          footer={`Portfolio base ${formatCollectorsCurrency(data.periodPortfolioPrincipal)}`}
          help="Shows how much earning potential the loans in this view still carry."
          subtitle={`Interest potential inside the ${periodLabel} portfolio view.`}
          title="Portfolio Yield"
          value={formatCollectorsNullablePercent(data.portfolioYieldRate, "No portfolio base")}
        />
        <CollectorKpiCard
          accentClassName="bg-rose-500"
          barPercent={riskSpark}
          footer={`${formatCollectorsCurrency(data.periodPortfolioAtRiskAmount)} overdue principal`}
          help="Shows how much handled money is at risk because overdue accounts are inside this view."
          subtitle={`Overdue share of the ${periodLabel} portfolio base.`}
          title="Portfolio at Risk"
          value={formatCollectorsNullablePercent(data.portfolioAtRiskRate, "No portfolio base")}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <CollectorsChartCard
          className={showRankContext ? "xl:col-span-8" : "xl:col-span-12"}
          chart={(
            <CollectionsAreaChart
              chart={data.periodTrendChart}
              valueFormatter={formatCollectorsCurrency}
              axisFormatter={formatCollectorsAxisCurrency}
            />
          )}
          description={
            isLifetimeView
              ? "Monthly collection history with the collector's lifetime average monthly pace."
              : `Collected cash and expected pace across ${periodLabel}.`
          }
          title={isLifetimeView ? "Lifetime Collection Trend" : "Collection Trend"}
        />

        {showRankContext ? (
          <CollectorRankContextCard
            basisLabel={`Average monthly collections in ${periodLabel}.`}
            branchCollectorCount={data.branchCollectorCount}
            branchName={data.branchName}
            branchRank={data.branchRank}
            className="xl:col-span-4"
            nationwideRank={data.nationwideRank}
            visibleCollectorCount={data.visibleCollectorCount}
          />
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <CollectorsChartCard
          className="xl:col-span-7"
          chart={(
            <CollectorProfileBarChart
              chart={data.outputComparisonChart}
              valueFormatter={formatCollectorsCurrency}
              axisFormatter={formatCollectorsAxisCurrency}
            />
          )}
          description="Quick cash comparison between what came in, what was expected, and the collector's current pace."
          title="Output vs Expected"
        />

        <CollectorsChartCard
          className="xl:col-span-5"
          chart={(
            <CollectorProfileBarChart
              chart={data.rateComparisonChart}
              valueFormatter={formatCollectorsPercent}
              axisFormatter={formatCollectorsAxisPercent}
            />
          )}
          description="Management view of efficiency, yield, risk, completion, and missed-payment control."
          title="Rate Snapshot"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <CollectorBreakdownCard
          className="xl:col-span-4"
          description="Supporting period numbers that explain the KPI row above."
          help="These numbers follow the active filter. They explain collected cash, days worked, missed payments, and completion output."
          items={[
            {
              label: "Total Collected",
              percent: data.expectedCollections > 0 ? Math.min((data.totalCollected / data.expectedCollections) * 100, 100) : 8,
              toneClassName: "bg-emerald-500",
              value: formatCollectorsCurrency(data.totalCollected),
            },
            {
              label: "Average Monthly Collections",
              percent: data.lifetimeMetrics.lifetimeAverageMonthlyCollection > 0
                ? Math.min((data.averageMonthlyCollections / data.lifetimeMetrics.lifetimeAverageMonthlyCollection) * 100, 100)
                : 8,
              toneClassName: "bg-sky-500",
              value: formatCollectorsCurrency(data.averageMonthlyCollections),
            },
            {
              label: "Completion Rate",
              percent: data.completionRate,
              toneClassName: "bg-violet-500",
              value: formatCollectorsPercent(data.completionRate),
            },
            {
              label: "Period Change",
              percent: data.periodChangePercent === null ? 8 : Math.min(Math.abs(data.periodChangePercent), 100),
              toneClassName: "bg-amber-500",
              value: formatCollectorsSignedPercent(data.periodChangePercent),
            },
          ]}
          title="Period Snapshot"
        />

        <CollectorBreakdownCard
          className="xl:col-span-4"
          description="Current live workload and exposure still assigned to this collector right now."
          help="These are live portfolio numbers, separate from the active period filter."
          items={[
            {
              label: "Assigned Active Loans",
              percent: data.branchCollectorCount > 0 ? Math.min((data.assignedActiveLoans / Math.max(data.branchCollectorCount * 4, 1)) * 100, 100) : 8,
              toneClassName: "bg-cyan-500",
              value: formatCollectorsInteger(data.assignedActiveLoans),
            },
            {
              label: "Active Principal Load",
              percent: 100,
              toneClassName: "bg-slate-500",
              value: formatCollectorsCurrency(data.activePrincipalLoad),
            },
            {
              label: "Active Interest Potential",
              percent: data.activePrincipalLoad > 0
                ? Math.min((data.activeInterestPotential / data.activePrincipalLoad) * 100, 100)
                : 8,
              toneClassName: "bg-violet-500",
              value: formatCollectorsCurrency(data.activeInterestPotential),
            },
            {
              label: "Current Overdue Principal",
              percent: data.activePrincipalLoad > 0
                ? Math.min((data.portfolioAtRiskAmount / data.activePrincipalLoad) * 100, 100)
                : 8,
              toneClassName: "bg-rose-500",
              value: formatCollectorsCurrency(data.portfolioAtRiskAmount),
            },
          ]}
          title="Live Portfolio Snapshot"
        />

        <TremorCard className="xl:col-span-4">
          <div className="space-y-5 p-6">
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold tracking-tight text-foreground">Lifetime Metrics</h3>
              <TremorDescription className="text-[13px]">
                Career totals stay visible here even when the active filter changes above.
              </TremorDescription>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <LifetimeMetric
                label="Lifetime Collection Amount"
                value={formatCollectorsCurrency(data.lifetimeMetrics.lifetimeCollectionAmount)}
              />
              <LifetimeMetric
                label="Average Monthly Collection"
                value={formatCollectorsCurrency(data.lifetimeMetrics.lifetimeAverageMonthlyCollection)}
              />
              <LifetimeMetric
                label="Average Collected per Day"
                value={formatCollectorsCurrency(data.lifetimeMetrics.lifetimeAverageCollectedPerDay)}
              />
              <LifetimeMetric
                label="Average Amount per Collection"
                value={formatCollectorsCurrency(data.lifetimeMetrics.lifetimeAverageAmountPerCollection)}
              />
              <LifetimeMetric
                label="Missed Payment Ratio"
                value={formatCollectorsPercent(data.lifetimeMetrics.lifetimeMissedPaymentRatio)}
              />
              <LifetimeMetric
                label="Lifetime Entries"
                value={formatCollectorsInteger(data.lifetimeMetrics.lifetimeCollectionEntries)}
              />
            </div>
          </div>
        </TremorCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <CollectorBreakdownCard
          className={isLifetimeView ? "xl:col-span-12" : "xl:col-span-4"}
          description="Risk and control signals tied to the active filter."
          help="These numbers show missed-payment pressure, steady field work, and how well difficult accounts stayed under control."
          items={[
            {
              label: "Missed-Payment Rate",
              percent: 100 - Math.min(data.missedPaymentRate, 100),
              toneClassName: "bg-rose-500",
              value: formatCollectorsPercent(data.missedPaymentRate),
            },
            {
              label: "Delinquency Control",
              percent: data.delinquencyControl,
              toneClassName: "bg-orange-500",
              value: formatCollectorsPercent(data.delinquencyControl),
            },
            {
              label: "Consistency",
              percent: data.consistencyScore,
              toneClassName: "bg-indigo-500",
              value: formatCollectorsPercent(data.consistencyScore),
            },
            {
              label: "Active Weeks",
              percent: Math.min(data.activeWeeks * 20, 100),
              toneClassName: "bg-sky-500",
              value: formatCollectorsInteger(data.activeWeeks),
            },
          ]}
          title="Risk and Control"
        />

        {isLifetimeView ? null : (
          <CollectorsChartCard
            className="xl:col-span-8"
            chart={(
              <CollectionsAreaChart
                chart={data.lifetimeTrendChart}
                valueFormatter={formatCollectorsCurrency}
                axisFormatter={formatCollectorsAxisCurrency}
              />
            )}
            description="Monthly collection history with the collector's lifetime average monthly pace."
            title="Lifetime Collection Trend"
          />
        )}
      </div>
    </div>
  );
}

function LifetimeMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}
