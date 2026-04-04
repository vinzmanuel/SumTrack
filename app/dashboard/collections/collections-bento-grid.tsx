import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CollectionsAreaChart } from "@/app/dashboard/collections/collections-area-chart";
import { CollectionsRankedCard } from "@/app/dashboard/collections/collections-ranked-card";
import {
  formatCollectionsAxisCurrency,
  formatCollectionsCurrency,
  formatCollectionsInteger,
} from "@/app/dashboard/collections/format";
import type { CollectionsAnalyticsData } from "@/app/dashboard/collections/types";

export function CollectionsBentoGrid({ data }: { data: CollectionsAnalyticsData }) {
  return (
    <div className="space-y-4">
      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardHeader className="gap-0 pb-1.5 pt-3.5">
          <CardTitle className="text-base font-semibold tracking-tight">Collections Trend</CardTitle>
          <CardDescription className="text-sm leading-5">
            Collected amount across {data.dateRangeLabel}, shown as the main volume signal for the selected scope.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4.5 pt-0">
          <div className="rounded-2xl border border-border/70 bg-muted/10 p-2.5">
            <CollectionsAreaChart
              axisFormatter={formatCollectionsAxisCurrency}
              chart={data.collectionsTrend}
              className="h-[250px] md:h-[290px]"
              emptyMessage="No collection volume matched the selected branch scope and period."
              valueFormatter={formatCollectionsCurrency}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:items-start xl:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]">
        <Card className="self-start gap-0 overflow-hidden py-0 shadow-sm">
          <CardHeader className="gap-0 pb-1.5 pt-3.5">
            <CardTitle className="text-base font-semibold tracking-tight">Missed Payments Trend</CardTitle>
            <CardDescription className="text-sm leading-5">
              Discrete missed-payment events across {data.dateRangeLabel}, kept as a smaller exception-monitoring surface.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4 pt-0">
            <div className="rounded-2xl border border-border/70 bg-muted/10 p-2.5">
              <CollectionsAreaChart
                chart={data.missedPaymentsTrend}
                className="h-[160px] md:h-[180px]"
                emptyMessage="No missed-payment events were recorded for the selected period."
                valueFormatter={formatCollectionsInteger}
              />
            </div>
          </CardContent>
        </Card>

        <CollectionsRankedCard
          className="self-start"
          data={data.comparison}
          secondaryFormatter={formatCollectionsInteger}
          valueFormatter={formatCollectionsCurrency}
        />
      </div>
    </div>
  );
}
