import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  formatCollectionsCurrency,
  formatCollectionsInteger,
  formatCollectionsPercent,
} from "@/app/dashboard/collections/format";
import type { CollectionsSummaryStats } from "@/app/dashboard/collections/types";

export function CollectionsSummaryCards({ summary }: { summary: CollectionsSummaryStats }) {
  const principalShare = summary.totalAmount > 0 ? (summary.principalRecovered / summary.totalAmount) * 100 : 0;
  const interestShare = summary.totalAmount > 0 ? (summary.realizedInterest / summary.totalAmount) * 100 : 0;

  return (
    <div className="grid gap-3 xl:grid-cols-5">
      <Card className="h-full gap-0 overflow-hidden rounded-md py-0 shadow-sm">
        <CardHeader className="gap-0 pb-1.5 pt-3.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Collections</CardTitle>
          <CardDescription className="pt-1 text-[13px] leading-5">
            Total cash collected across the selected branch scope and period.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex h-full flex-col gap-2 pb-4.5 pt-0">
          <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
            {formatCollectionsCurrency(summary.totalAmount)}
          </p>
          <p className="mt-auto text-xs text-muted-foreground">
            {formatCollectionsInteger(summary.activeCollectionDays)} active days
          </p>
        </CardContent>
      </Card>

      <MetricCard
        description="Portion of collections that went toward recovering loan principal."
        title="Principal Recovered"
        supportLabel={`${formatCollectionsPercent(principalShare)} of collections`}
        value={formatCollectionsCurrency(summary.principalRecovered)}
      />
      <MetricCard
        accentClassName="border-sky-200/70 bg-sky-50/50 dark:border-sky-500/30 dark:bg-sky-500/10"
        description="Portion of collections that crossed into interest gain."
        title="Realized Interest"
        supportLabel={`${formatCollectionsPercent(interestShare)} of collections`}
        value={formatCollectionsCurrency(summary.realizedInterest)}
      />
      <MetricCard
        description="Zero-amount or missed-payment entries recorded in the selected period."
        title="Missed Payments"
        supportLabel={`${formatCollectionsInteger(summary.totalEntries)} total entries`}
        value={formatCollectionsInteger(summary.missedPayments)}
      />
      <MetricCard
        description="Share of collection entries recorded as missed payments."
        title="Missed Payment Rate"
        supportLabel={`${formatCollectionsInteger(summary.missedPayments)} missed entries`}
        value={formatCollectionsPercent(summary.missedPaymentRate)}
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  supportLabel,
  accentClassName,
}: {
  title: string;
  value: string;
  description: string;
  supportLabel?: string;
  accentClassName?: string;
}) {
  return (
    <Card className={cn("h-full gap-0 overflow-hidden rounded-md py-0 shadow-sm", accentClassName)}>
      <CardHeader className="gap-0 pb-1.5 pt-3.5">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <CardDescription className="pt-1 text-[13px] leading-5">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex h-full flex-col gap-2 pb-4.5 pt-0">
        <p className="text-[1.8rem] font-semibold tracking-tight text-foreground">{value}</p>
        {supportLabel ? <p className="mt-auto text-xs text-muted-foreground">{supportLabel}</p> : null}
      </CardContent>
    </Card>
  );
}
