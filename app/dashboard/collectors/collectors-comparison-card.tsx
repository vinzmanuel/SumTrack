import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { formatCollectorsCurrency, formatCollectorsInteger, formatCollectorsPercent } from "@/app/dashboard/collectors/format";
import type { CollectorsComparisonItem } from "@/app/dashboard/collectors/types";

export function CollectorsComparisonCard({
  items,
}: {
  items: CollectorsComparisonItem[];
}) {
  const maxPrincipal = Math.max(...items.map((item) => item.activePrincipalLoad), 0);

  return (
    <TremorCard className="p-6">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            Portfolio Load vs Recovery
          </h3>
          <TremorDescription className="text-[13px]">
            Compare live principal responsibility against current recovery rate.
          </TremorDescription>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comparison data is available for the selected filters.</p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const principalWidth = maxPrincipal > 0 ? Math.max((item.activePrincipalLoad / maxPrincipal) * 100, 8) : 8;

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
                      <p className="text-xs text-muted-foreground">Recovery rate</p>
                      <p className="text-sm font-semibold text-foreground">{formatCollectorsPercent(item.portfolioRecoveryRate)}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Active principal load</span>
                        <span>{formatCollectorsCurrency(item.activePrincipalLoad)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-sky-500/80" style={{ width: `${principalWidth}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Portfolio recovery</span>
                        <span>
                          {formatCollectorsPercent(item.portfolioRecoveryRate)} on {formatCollectorsInteger(item.assignedActiveLoans)} loans
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-emerald-500/80" style={{ width: `${Math.max(Math.min(item.portfolioRecoveryRate, 100), 8)}%` }} />
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
