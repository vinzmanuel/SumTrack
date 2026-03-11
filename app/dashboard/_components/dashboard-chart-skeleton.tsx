import { TremorCard } from "@/components/tremor/raw/metric-card";

export function DashboardChartSkeleton() {
  return (
    <TremorCard className="min-h-[470px] p-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
          </div>
          <div className="grid w-full gap-3 md:grid-cols-2 xl:max-w-3xl xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-10 w-24 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-[340px] animate-pulse rounded-xl bg-muted md:h-[380px]" />
        </div>
      </div>
    </TremorCard>
  );
}
