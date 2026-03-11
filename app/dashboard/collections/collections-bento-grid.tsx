import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { CollectionsAreaChart } from "@/app/dashboard/collections/collections-area-chart";
import {
  CollectionsRankedCard,
  formatRankedCurrency,
  formatRankedInteger,
} from "@/app/dashboard/collections/collections-ranked-card";
import {
  formatCollectionsAxisCurrency,
  formatCollectionsCurrency,
  formatCollectionsInteger,
} from "@/app/dashboard/collections/format";
import type { CollectionsAnalyticsData } from "@/app/dashboard/collections/types";

export function CollectionsBentoGrid({ data }: { data: CollectionsAnalyticsData }) {
  return (
    <div className="grid gap-6 xl:grid-cols-12">
      <TremorCard className="xl:col-span-8">
        <ChartCard
          chart={
            <CollectionsAreaChart
              axisFormatter={formatCollectionsAxisCurrency}
              chart={data.collectionsTrend}
              className="h-[340px] md:h-[380px]"
              valueFormatter={formatCollectionsCurrency}
            />
          }
          description={`Collected amount over ${data.dateRangeLabel}.`}
          title="Collections Trend Over Time"
        />
      </TremorCard>

      <TremorCard className="xl:col-span-4">
        <ChartCard
          chart={
            <CollectionsAreaChart
              chart={data.missedPaymentsTrend}
              className="h-[340px] md:h-[380px]"
              valueFormatter={formatCollectionsInteger}
            />
          }
          description={`Missed-payment entries over ${data.dateRangeLabel}.`}
          title="Missed Payments Trend"
        />
      </TremorCard>

      <CollectionsRankedCard
        className="xl:col-span-5"
        data={data.comparison}
        secondaryFormatter={formatRankedInteger}
        valueFormatter={formatRankedCurrency}
      />

      <CollectionsRankedCard
        className="xl:col-span-4"
        data={data.breakdown}
        secondaryFormatter={formatRankedCurrency}
        valueFormatter={formatRankedInteger}
      />

      <TremorCard className="xl:col-span-3">
        <div className="flex h-full flex-col justify-between gap-4 p-6">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
              {data.insight.eyebrow}
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              {data.insight.title}
            </h3>
            <TremorDescription className="text-[13px]">
              {data.insight.description}
            </TremorDescription>
          </div>
          <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
            Use this view to compare current collection pressure, missed-payment signals, and where follow-up should start.
          </div>
        </div>
      </TremorCard>
    </div>
  );
}

function ChartCard({
  title,
  description,
  chart,
}: {
  title: string;
  description: string;
  chart: React.ReactNode;
}) {
  return (
    <div className="space-y-5 p-6">
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        <TremorDescription className="text-[13px]">{description}</TremorDescription>
      </div>
      {chart}
    </div>
  );
}
