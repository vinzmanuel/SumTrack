import { TremorCard, TremorDescription, TremorMetric, TremorTitle } from "@/components/tremor/raw/metric-card";
import {
  collectorsTrendTone,
  formatCollectorsCurrency,
  formatCollectorsInteger,
  formatCollectorsPercent,
  formatCollectorsSignedPercent,
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
        supportingValue={`${formatCollectorsSignedPercent(collector.periodChangePercent)} vs previous period`}
        supportingValueClassName={collectorsTrendTone(collector.periodChangePercent)}
        title="Total Collected"
        value={formatCollectorsCurrency(collector.totalCollected)}
      />
      <SummaryCard
        description="Collected amount as a share of the currently assigned active principal load."
        supportingValue={formatCollectorsCurrency(collector.activePrincipalLoad)}
        title="Portfolio Recovery Rate"
        value={formatCollectorsPercent(collector.portfolioRecoveryRate)}
      />
      <SummaryCard
        description="Normalized monthly output for the selected period."
        title="Average Monthly Collections"
        value={formatCollectorsCurrency(collector.averageMonthlyCollections)}
      />
      <SummaryCard
        description="Missed payments normalized against actual collection activity."
        title="Missed-Payment Rate"
        value={formatCollectorsPercent(collector.missedPaymentRate)}
        supportingValue={`${formatCollectorsInteger(collector.missedPaymentCount)} missed entries`}
      />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  supportingValue,
  supportingValueClassName,
}: {
  title: string;
  value: string;
  description: string;
  supportingValue?: string;
  supportingValueClassName?: string;
}) {
  return (
    <TremorCard className="p-5">
      <div className="space-y-2">
        <TremorTitle>{title}</TremorTitle>
        <TremorMetric className="text-xl md:text-2xl">{value}</TremorMetric>
        {supportingValue ? (
          <p className={`text-sm font-medium ${supportingValueClassName ?? "text-foreground"}`}>{supportingValue}</p>
        ) : null}
        <TremorDescription className="text-[13px]">{description}</TremorDescription>
      </div>
    </TremorCard>
  );
}
