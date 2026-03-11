import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { CollectorRadarChart } from "@/app/dashboard/collectors/collector-radar-chart";
import {
  formatCollectorsCurrency,
  formatCollectorsInteger,
  formatCollectorsPercent,
} from "@/app/dashboard/collectors/format";
import type { CollectorProfileData } from "@/app/dashboard/collectors/types";

export function CollectorProfilePanel({
  data,
  profileHref,
  onClose,
  showProfileButton = true,
}: {
  data: CollectorProfileData;
  profileHref: string;
  onClose?: () => void;
  showProfileButton?: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <TremorCard className="p-5">
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Performance Profile
            </p>
            <h3 className="text-xl font-semibold tracking-tight text-foreground">{data.fullName}</h3>
            <TremorDescription>{data.companyId}</TremorDescription>
          </div>
          <CollectorRadarChart metrics={data.radarMetrics} />
          <div className="rounded-xl bg-indigo-50 p-4 text-sm text-indigo-950">
            This profile compares collection volume, completion output, consistency, portfolio load, collection size, and delinquency control inside the current visible scope.
          </div>
        </div>
      </TremorCard>

      <TremorCard className="p-5">
        <div className="flex h-full flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Collector Snapshot
              </p>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">{data.fullName}</h3>
              <TremorDescription>
                {data.branchName} • {data.areaLabel}
              </TremorDescription>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Stat label="Status" value={data.status} />
              <Stat label="Rank" value={`#${formatCollectorsInteger(data.rank)}`} />
              <Stat label="Total Collected" value={formatCollectorsCurrency(data.totalCollected)} />
              <Stat
                label="Average Collection Amount"
                value={formatCollectorsCurrency(data.averageCollectionAmount)}
              />
              <Stat
                label="Assigned Active Loans"
                value={formatCollectorsInteger(data.assignedActiveLoans)}
              />
              <Stat label="Completed Loans" value={formatCollectorsInteger(data.completedLoans)} />
              <Stat
                label="Missed-Payment Count"
                value={formatCollectorsInteger(data.missedPaymentCount)}
              />
              <Stat label="Collection Entries" value={formatCollectorsInteger(data.collectionEntries)} />
              <Stat label="Completion Rate" value={formatCollectorsPercent(data.completionRate)} />
              <Stat label="Consistency" value={formatCollectorsPercent(data.consistencyScore)} />
              <Stat
                label="Delinquency Control"
                value={formatCollectorsPercent(data.delinquencyControl)}
              />
              <Stat label="Collection Days" value={formatCollectorsInteger(data.collectionDays)} />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            {showProfileButton ? (
              <Link href={profileHref}>
                <Button size="sm" type="button" variant="outline">
                  View Profile
                </Button>
              </Link>
            ) : null}
            {onClose ? (
              <Button onClick={onClose} size="sm" type="button">
                Close
              </Button>
            ) : null}
          </div>
        </div>
      </TremorCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
