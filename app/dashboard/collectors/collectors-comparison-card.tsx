import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { formatCollectorsCurrency, formatCollectorsInteger } from "@/app/dashboard/collectors/format";
import type { CollectorsComparisonItem } from "@/app/dashboard/collectors/types";

export function CollectorsComparisonCard({
  items,
}: {
  items: CollectorsComparisonItem[];
}) {
  const maxLoans = Math.max(...items.map((item) => item.assignedActiveLoans), 0);
  const maxCollected = Math.max(...items.map((item) => item.totalCollected), 0);

  return (
    <TremorCard className="p-6">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Portfolio Load vs Collection Output
          </h3>
          <TremorDescription className="text-[13px]">
            Compare the heaviest live portfolios with their current cash-in output.
          </TremorDescription>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comparison data is available for the selected filters.</p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const loansWidth = maxLoans > 0 ? Math.max((item.assignedActiveLoans / maxLoans) * 100, 8) : 8;
              const collectedWidth = maxCollected > 0 ? Math.max((item.totalCollected / maxCollected) * 100, 8) : 8;

              return (
                <div className="space-y-3 rounded-2xl border bg-background/80 p-4" key={item.collectorId}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        #{item.rank} {item.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.branchName} / {item.areaLabel}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Collected</p>
                      <p className="text-sm font-semibold text-foreground">{formatCollectorsCurrency(item.totalCollected)}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Portfolio load</span>
                        <span>{formatCollectorsInteger(item.assignedActiveLoans)} active loans</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-sky-500/80" style={{ width: `${loansWidth}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Collection output</span>
                        <span>{formatCollectorsCurrency(item.totalCollected)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-emerald-500/80" style={{ width: `${collectedWidth}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TremorCard>
  );
}
