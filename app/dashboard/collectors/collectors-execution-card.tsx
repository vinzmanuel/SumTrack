import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { collectorsTrendTone, formatCollectorsPercent, formatCollectorsSignedPercent } from "@/app/dashboard/collectors/format";
import type { CollectorsExecutionItem } from "@/app/dashboard/collectors/types";

export function CollectorsExecutionCard({
  items,
}: {
  items: CollectorsExecutionItem[];
}) {
  return (
    <TremorCard className="p-6">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Execution Quality
          </h3>
          <TremorDescription className="text-[13px]">
            Compare cadence, missed-payment rate, and trend for the strongest execution profiles.
          </TremorDescription>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No execution data is available for the selected filters.</p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div className="space-y-3 rounded-2xl border bg-background/80 p-4" key={item.collectorId}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      #{item.rank} {item.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">Execution profile</p>
                  </div>
                  <div className={`text-right text-xs font-medium ${collectorsTrendTone(item.periodChangePercent)}`}>
                    {formatCollectorsSignedPercent(item.periodChangePercent)}
                  </div>
                </div>

                <MetricBar
                  label="Consistency (weekly coverage)"
                  note={`${item.collectionDays.toLocaleString("en-PH")} collection days`}
                  value={item.consistencyScore}
                />
                <MetricBar
                  label="Missed-Payment Rate"
                  note={formatCollectorsPercent(item.missedPaymentRate)}
                  value={100 - item.missedPaymentRate}
                />
                <MetricBar
                  label="Delinquency Control"
                  note={`${formatCollectorsPercent(item.completionRate)} completion`}
                  value={item.delinquencyControl}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </TremorCard>
  );
}

function MetricBar({
  label,
  note,
  value,
}: {
  label: string;
  note: string;
  value: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{note}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-violet-500/80" style={{ width: `${Math.max(Math.min(value, 100), 6)}%` }} />
      </div>
    </div>
  );
}
