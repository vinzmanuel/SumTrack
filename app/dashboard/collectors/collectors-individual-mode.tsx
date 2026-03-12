import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { CollectorRadarChart } from "@/app/dashboard/collectors/collector-radar-chart";
import { collectorRankBadgeClassName } from "@/app/dashboard/collectors/collectors-rank-styles";
import { CollectorsIndividualSummaryCards } from "@/app/dashboard/collectors/collectors-individual-summary-cards";
import {
  collectorsTrendTone,
  formatCollectorsCurrency,
  formatCollectorsInteger,
  formatCollectorsPercent,
  formatCollectorsSignedPercent,
} from "@/app/dashboard/collectors/format";
import type { CollectorPerformanceRow } from "@/app/dashboard/collectors/types";

export function CollectorsIndividualMode({
  collector,
  dateRangeLabel,
  errorMessage,
  profileHref,
  onOpenCollector,
}: {
  collector: CollectorPerformanceRow;
  dateRangeLabel: string;
  errorMessage: string | null;
  profileHref: string;
  onOpenCollector: (collector: CollectorPerformanceRow) => void;
}) {
  return (
    <>
      <CollectorsIndividualSummaryCards collector={collector} />

      <div className="grid gap-6 xl:grid-cols-12">
        <TremorCard className="xl:col-span-8">
          <div className="space-y-6 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={collectorRankBadgeClassName(collector.rank)} variant="outline">
                    #{collector.rank}
                  </Badge>
                  <Badge variant="outline">{collector.companyId}</Badge>
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">{collector.fullName}</h3>
                  <TremorDescription className="text-[13px]">
                    {collector.branchName} / {collector.areaLabel}
                  </TremorDescription>
                </div>
                <p className="text-sm text-muted-foreground">
                  Only one collector matches the current filters, so the page has shifted into an individual performance profile for {dateRangeLabel}.
                </p>
                <p className={`text-sm font-medium ${collectorsTrendTone(collector.periodChangePercent)}`}>
                  {formatCollectorsSignedPercent(collector.periodChangePercent)} vs previous equivalent period
                </p>
                {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => onOpenCollector(collector)} type="button" variant="outline">
                  Open Quick View
                </Button>
                <Link href={profileHref}>
                  <Button type="button">View Profile</Button>
                </Link>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
              <div className="space-y-3 rounded-2xl border bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
                  Performance Radar
                </p>
                <CollectorRadarChart metrics={collector.radarMetrics} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Assigned Active Loans" value={formatCollectorsInteger(collector.assignedActiveLoans)} />
                <Metric label="Active Principal Load" value={formatCollectorsCurrency(collector.activePrincipalLoad)} />
                <Metric label="Collection Days" value={formatCollectorsInteger(collector.collectionDays)} />
                <Metric label="Consistency (Active Weeks)" value={`${formatCollectorsInteger(collector.activeWeeks)} weeks`} />
                <Metric label="Previous Period Collected" value={formatCollectorsCurrency(collector.previousTotalCollected)} />
                <Metric label="Average Collection Amount" value={formatCollectorsCurrency(collector.averageCollectionAmount)} />
                <Metric label="Status" value={collector.status} />
              </div>
            </div>
          </div>
        </TremorCard>

        <div className="space-y-6 xl:col-span-4">
          <SignalCard
            description="Direct output profile for the currently matched collector."
            metrics={[
              { label: "Total Collected", value: collector.totalCollected, display: formatCollectorsCurrency(collector.totalCollected), colorClassName: "bg-emerald-500/85" },
              { label: "Average Monthly Collections", value: collector.averageMonthlyCollections, display: formatCollectorsCurrency(collector.averageMonthlyCollections), colorClassName: "bg-sky-500/85" },
              { label: "Portfolio Recovery Rate", value: collector.portfolioRecoveryRate, display: formatCollectorsPercent(collector.portfolioRecoveryRate), colorClassName: "bg-teal-500/85", widthPercent: collector.portfolioRecoveryRate },
            ]}
            maxValue={Math.max(collector.totalCollected, collector.averageMonthlyCollections, 1)}
            title="Collection Output Profile"
          />

          <SignalCard
            description="Execution quality within the selected period."
            metrics={[
              { label: "Consistency (weekly coverage)", value: collector.consistencyScore, display: formatCollectorsPercent(collector.consistencyScore), colorClassName: "bg-violet-500/85" },
              { label: "Missed-Payment Rate", value: 100 - collector.missedPaymentRate, display: formatCollectorsPercent(collector.missedPaymentRate), colorClassName: "bg-rose-500/85" },
              { label: "Delinquency Control", value: collector.delinquencyControl, display: formatCollectorsPercent(collector.delinquencyControl), colorClassName: "bg-orange-500/85" },
            ]}
            maxValue={100}
            title="Execution Quality"
          />

          <TremorCard className="p-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
                Individual mode
              </p>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                Focused collector analytics
              </h3>
              <TremorDescription className="text-[13px]">
                Comparison-heavy leaderboard visuals are hidden here so the matched collector&apos;s workload, recovery, missed-payment rate, and period change stay primary.
              </TremorDescription>
            </div>
          </TremorCard>
        </div>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-background/80 p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SignalCard({
  title,
  description,
  metrics,
  maxValue,
}: {
  title: string;
  description: string;
  metrics: Array<{
    label: string;
    value: number;
    display: string;
    colorClassName: string;
    widthPercent?: number;
  }>;
  maxValue?: number;
}) {
  const resolvedMax = maxValue ?? Math.max(...metrics.map((metric) => metric.value), 0);

  return (
    <TremorCard className="p-6">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
          <TremorDescription className="text-[13px]">{description}</TremorDescription>
        </div>

        <div className="space-y-4">
          {metrics.map((metric) => {
            const width = typeof metric.widthPercent === "number"
              ? Math.max(Math.min(metric.widthPercent, 100), 8)
              : resolvedMax > 0
                ? Math.max((metric.value / resolvedMax) * 100, 8)
                : 8;

            return (
              <div className="space-y-1.5" key={metric.label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{metric.label}</span>
                  <span className="font-semibold text-foreground">{metric.display}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div className={`h-2 rounded-full ${metric.colorClassName}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TremorCard>
  );
}
