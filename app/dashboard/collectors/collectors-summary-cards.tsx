import { cn } from "@/lib/utils";
import { TremorCard, TremorDescription, TremorMetric, TremorTitle } from "@/components/tremor/raw/metric-card";
import { formatCollectorsCurrency, formatCollectorsInteger } from "@/app/dashboard/collectors/format";
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
        kicker="Collection output"
        subtitle="Attributed cash-in profile across the current ranking."
        title="Total Collections Attributed"
        trendValues={trends.totalCollectionsAttributed}
        value={formatCollectorsCurrency(summary.totalCollectionsAttributed)}
      />
      <SummaryCard
        accentClassName="bg-teal-500"
        kicker="Per collector"
        subtitle="Average collector output in the visible scope for this range."
        title="Average Collections per Collector"
        trendValues={trends.averageCollectionsPerCollector}
        value={formatCollectorsCurrency(summary.averageCollectionsPerCollector)}
      />
      <SummaryCard
        accentClassName="bg-amber-500"
        kicker="Current leader"
        subtitle={summary.topCollectorAmount > 0 ? formatCollectorsCurrency(summary.topCollectorAmount) : "No collected amount yet"}
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
}: {
  title: string;
  value: string;
  subtitle: string;
  kicker: string;
  trendValues: number[];
  accentClassName: string;
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
