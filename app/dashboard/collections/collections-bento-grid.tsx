import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CollectionsChart } from "@/app/dashboard/collections/collections-area-chart";
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
      <Card className="gap-0 overflow-hidden rounded-md py-0 shadow-sm">
        <CardHeader className="gap-0 pb-1.5 pt-3.5">
          <CardTitle className="text-base font-semibold tracking-tight">Collections Composition Trend</CardTitle>
          <CardDescription className="text-sm leading-5">
            Principal recovery and realized interest across {data.dateRangeLabel}, shown as the main composition signal for the selected scope.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4.5 pt-0">
          <div className="rounded-md border border-border/70 bg-muted/10 p-2.5">
            <CollectionsChart
              axisFormatter={formatCollectionsAxisCurrency}
              chart={data.compositionTrend}
              className="h-[260px] md:h-[300px]"
              emptyMessage="No collection composition matched the selected branch scope and period."
              includeTotalInTooltip
              showLegend
              stacked
              valueFormatter={formatCollectionsCurrency}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden rounded-md py-0 shadow-sm">
        <CardHeader className="gap-0 pb-1.5 pt-3.5">
          <CardTitle className="text-base font-semibold tracking-tight">Missed Payments Trend</CardTitle>
          <CardDescription className="text-sm leading-5">
            Missed-payment events across {data.dateRangeLabel}, shown at the same scale as the composition chart so reliability is easier to inspect.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-4.5 pt-0">
          <div className="rounded-md border border-border/70 bg-muted/10 p-2.5">
            <CollectionsChart
              chart={data.missedPaymentsTrend}
              className="h-[260px] md:h-[300px]"
              emptyMessage="No missed-payment events were recorded for the selected period."
              valueFormatter={formatCollectionsInteger}
            />
          </div>
        </CardContent>
      </Card>

      {data.comparison.items.length > 0 ? (
        <CollectionsRankedCard data={data.comparison} />
      ) : null}
    </div>
  );
}
