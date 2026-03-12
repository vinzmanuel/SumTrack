import { cn } from "@/lib/utils";
import { TremorCard, TremorDescription, TremorMetric, TremorTitle } from "@/components/tremor/raw/metric-card";
import {
  collectorsTrendTone,
  formatCollectorsCurrency,
  formatCollectorsInteger,
  formatCollectorsPercent,
  formatCollectorsSignedPercent,
} from "@/app/dashboard/collectors/format";
import type { CollectorsSummaryStats, CollectorsSummaryTrends } from "@/app/dashboard/collectors/types";

export function CollectorsSummaryCards({
  summary,
  trends,
}: {
  summary: CollectorsSummaryStats;
  trends: CollectorsSummaryTrends;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        accentClassName="bg-sky-500"
        kicker="Portfolio load"
        subtitle="Active loan pressure across the highest-ranked visible collectors."
        title="Active Collectors"
        trendValues={trends.activeCollectors}
        value={formatCollectorsInteger(summary.activeCollectors)}
      />
      <SummaryCard
        accentClassName="bg-emerald-500"
        deltaValue={summary.totalCollectionsChangePercent}
        kicker="Collection output"
        subtitle="Attributed cash-in profile across the current ranking."
        title="Total Collections Attributed"
        trendValues={trends.totalCollectionsAttributed}
        value={formatCollectorsCurrency(summary.totalCollectionsAttributed)}
      />
      <SummaryCard
        accentClassName="bg-teal-500"
        kicker="Load-relative recovery"
        subtitle="Collected amount as a share of visible active principal load."
        title="Avg Portfolio Recovery Rate"
        trendValues={trends.averagePortfolioRecoveryRate}
        value={formatCollectorsPercent(summary.averagePortfolioRecoveryRate)}
      />
      <SummaryCard
        accentClassName="bg-amber-500"
        kicker="Monthly pace leader"
        subtitle={summary.topCollectorAmount > 0 ? `${formatCollectorsCurrency(summary.topCollectorAmount)} total collected` : "No collected amount yet"}
        title="Top Collector"
        trendValues={trends.topCollector}
        value={summary.topCollectorName}
      />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  kicker,
  trendValues,
  accentClassName,
  deltaValue,
}: {
  title: string;
  value: string;
  subtitle: string;
  kicker: string;
  trendValues: number[];
  accentClassName: string;
  deltaValue?: number | null;
}) {
  return (
    <TremorCard className="overflow-hidden p-0">
      <div className="flex h-full flex-col gap-4 p-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{kicker}</p>
          <TremorTitle>{title}</TremorTitle>
          <TremorMetric className="text-xl md:text-2xl">{value}</TremorMetric>
        </div>

        <TrendBars accentClassName={accentClassName} values={trendValues} />

        {typeof deltaValue !== "undefined" ? (
          <SummaryDelta
            className={collectorsTrendTone(deltaValue)}
            value={deltaValue}
          />
        ) : null}
        <TremorDescription className="text-[13px]">{subtitle}</TremorDescription>
      </div>
    </TremorCard>
  );
}

function TrendBars({
  values,
  accentClassName,
}: {
  values: number[];
  accentClassName: string;
}) {
  const maxValue = Math.max(...values, 0);

  return (
    <div className="grid h-14 grid-cols-7 items-end gap-1.5 rounded-xl bg-muted/45 px-3 py-2">
      {values.map((value, index) => {
        const height = maxValue > 0 ? Math.max((value / maxValue) * 100, 18) : 18;

        return (
          <div
            className={cn("rounded-full opacity-90", accentClassName)}
            key={`${value}-${index}`}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}

function SummaryDelta({
  value,
  className,
}: {
  value: number | null;
  className: string;
}) {
  return (
    <p className={cn("text-xs font-medium", className)}>
      {formatCollectorsSignedPercent(value)} vs previous equivalent period
    </p>
  );
}
