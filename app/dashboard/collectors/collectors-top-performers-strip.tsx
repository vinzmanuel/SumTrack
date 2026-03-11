import { Badge } from "@/components/ui/badge";
import { collectorRankBadgeClassName, collectorRankCardClassName } from "@/app/dashboard/collectors/collectors-rank-styles";
import { formatCollectorsCurrency, formatCollectorsInteger } from "@/app/dashboard/collectors/format";
import type { CollectorsTopPerformerItem } from "@/app/dashboard/collectors/types";

export function CollectorsTopPerformersStrip({
  items,
}: {
  items: CollectorsTopPerformerItem[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {items.map((item, index) => (
        <div className={`rounded-2xl border p-4 ${collectorRankCardClassName(item.rank)}`} key={item.collectorId}>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Badge className={collectorRankBadgeClassName(item.rank)} variant="outline">
                #{item.rank}
              </Badge>
              <p className="text-sm font-semibold text-foreground">{item.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {item.branchName} / {item.areaLabel}
              </p>
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Top {index + 1}
            </p>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Metric label="Collected" value={formatCollectorsCurrency(item.totalCollected)} />
            <Metric label="Active Loans" value={formatCollectorsInteger(item.assignedActiveLoans)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-muted/55 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
