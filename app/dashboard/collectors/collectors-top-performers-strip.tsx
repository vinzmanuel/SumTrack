import { Badge } from "@/components/ui/badge";
import {
  collectorRankBadgeClassName,
  collectorRankCardClassName,
  collectorRankMetricClassName,
} from "@/app/dashboard/collectors/collectors-rank-styles";
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
      {items.map((item) => (
        <div className={`relative overflow-hidden rounded-2xl border p-4 ${collectorRankCardClassName(item.rank)}`} key={item.collectorId}>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 top-0 h-10 rounded-b-full bg-white/35 blur-xl"
          />
          <div className="flex items-start">
            <div>
              <Badge className={collectorRankBadgeClassName(item.rank)} variant="outline">
                #{item.rank}
              </Badge>
              <p className="mt-2.5 text-sm leading-5 text-foreground">
                <span className="font-semibold">{item.fullName}</span>{" "}
                <span className="font-normal">({item.companyId})</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.branchName}, {item.provinceName} / {item.areaLabel}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Metric
              className={collectorRankMetricClassName(item.rank)}
              label="Collected"
              value={formatCollectorsCurrency(item.totalCollected)}
            />
            <Metric
              className={collectorRankMetricClassName(item.rank)}
              label="Active Loans"
              value={formatCollectorsInteger(item.assignedActiveLoans)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Metric({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={`rounded-xl px-3 py-2 backdrop-blur-[1px] ${className ?? "border border-border/70 bg-muted/55"}`}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
