import { TremorCard, TremorDescription, TremorMetric, TremorTitle } from "@/components/tremor/raw/metric-card";
import { formatCollectionsCurrency, formatCollectionsInteger } from "@/app/dashboard/collections/format";
import type { CollectionsSummaryStats } from "@/app/dashboard/collections/types";

export function CollectionsSummaryCards({ summary }: { summary: CollectionsSummaryStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        description="Collected amount across the selected scope and period."
        title="Total Amount Collected"
        value={formatCollectionsCurrency(summary.totalAmount)}
      />
      <SummaryCard
        description="Recorded collection and missed-payment entries."
        title="Total Collection Entries"
        value={formatCollectionsInteger(summary.totalEntries)}
      />
      <SummaryCard
        description="Average amount per collection entry in the selected period."
        title="Average Collection Amount"
        value={formatCollectionsCurrency(summary.averageAmount)}
      />
      <SummaryCard
        description="Collection entries recorded as missed payments."
        title="Missed Payments"
        value={formatCollectionsInteger(summary.missedPayments)}
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
    <TremorCard className="p-5">
      <TremorTitle>{title}</TremorTitle>
      <TremorMetric>{value}</TremorMetric>
      <TremorDescription className="mt-2 text-[13px]">{description}</TremorDescription>
    </TremorCard>
  );
}
