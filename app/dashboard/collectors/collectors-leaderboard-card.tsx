import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { formatCollectorsCurrency, formatCollectorsInteger } from "@/app/dashboard/collectors/format";
import type { CollectorsTopPerformerItem } from "@/app/dashboard/collectors/types";

export function CollectorsLeaderboardCard({
  items,
}: {
  items: CollectorsTopPerformerItem[];
}) {
  return (
    <TremorCard className="p-6">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold tracking-tight text-foreground">Leaderboard</h3>
          <TremorDescription className="text-[13px]">
            Top collectors ranked by total collected amount in the selected period.
          </TremorDescription>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No leaderboard data is available for the selected filters.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div className="rounded-xl border bg-background px-4 py-3" key={item.collectorId}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      #{item.rank} {item.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.branchName} • {item.areaLabel}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {formatCollectorsCurrency(item.totalCollected)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatCollectorsInteger(item.completedLoans)} completed loans
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </TremorCard>
  );
}
