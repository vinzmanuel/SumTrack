import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCollectionsCurrency,
  formatCollectionsInteger,
  formatCollectionsPercent,
} from "@/app/dashboard/collections/format";
import type { CollectionsSummaryStats } from "@/app/dashboard/collections/types";

export function CollectionsSummaryCards({ summary }: { summary: CollectionsSummaryStats }) {
  return (
    <div className="grid gap-3 xl:items-start xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        <CardHeader className="gap-0 pb-1.5 pt-3.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount Collected</CardTitle>
          <CardDescription className="pt-1 text-[13px] leading-5">
            Collected amount across the selected branch scope and period.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5 pb-4.5 pt-0">
          <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
            {formatCollectionsCurrency(summary.totalAmount)}
          </p>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-border/70 bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Avg per entry</span>
            <span>{formatCollectionsCurrency(summary.averageAmount)}</span>
          </div>
        </CardContent>
      </Card>

      <SummaryCard
        description="Recorded collection and missed-payment entries in the selected period."
        title="Total Collection Entries"
        value={formatCollectionsInteger(summary.totalEntries)}
      />
      <SummaryCard
        description="Entries recorded as missed or zero-amount collections."
        title="Missed Payments"
        value={formatCollectionsInteger(summary.missedPayments)}
      />
      <SummaryCard
        description="Share of collection entries that were recorded as missed payments."
        title="Missed Payment Rate"
        value={formatCollectionsPercent(summary.missedPaymentRate)}
      />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-sm">
      <CardHeader className="gap-0 pb-1.5 pt-3.5">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <CardDescription className="pt-1 text-[13px] leading-5">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-4.5 pt-0">
        <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">{value}</p>
      </CardContent>
    </Card>
  );
}
