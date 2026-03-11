import { TremorCard, TremorDescription, TremorMetric, TremorTitle } from "@/components/tremor/raw/metric-card";
import {
  formatCollectorsCurrency,
  formatCollectorsInteger,
  formatCollectorsPercent,
} from "@/app/dashboard/collectors/format";
import type { CollectorPerformanceRow } from "@/app/dashboard/collectors/types";

export function CollectorsIndividualSummaryCards({
  collector,
}: {
  collector: CollectorPerformanceRow;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        description="Collected amount within the active date range."
        title="Total Collected"
        value={formatCollectorsCurrency(collector.totalCollected)}
      />
      <SummaryCard
        description="Average amount per collection entry."
        title="Average Collection Amount"
        value={formatCollectorsCurrency(collector.averageCollectionAmount)}
      />
      <SummaryCard
        description="Normalized monthly output for the selected period."
        title="Average Monthly Collections"
        value={formatCollectorsCurrency(collector.averageMonthlyCollections)}
      />
      <SummaryCard
        description="Live portfolio pressure and recovery progress."
        title="Completion Rate"
        value={formatCollectorsPercent(collector.completionRate)}
        supportingValue={`${formatCollectorsInteger(collector.assignedActiveLoans)} active loans`}
      />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  supportingValue,
}: {
  title: string;
  value: string;
  description: string;
  supportingValue?: string;
}) {
  return (
    <TremorCard className="p-5">
      <div className="space-y-2">
        <TremorTitle>{title}</TremorTitle>
        <TremorMetric className="text-xl md:text-2xl">{value}</TremorMetric>
        {supportingValue ? <p className="text-sm font-medium text-foreground">{supportingValue}</p> : null}
        <TremorDescription className="text-[13px]">{description}</TremorDescription>
      </div>
    </TremorCard>
  );
}
