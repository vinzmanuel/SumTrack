import { TremorCard } from "@/components/tremor/raw/metric-card";
import { CollectionsResultsSkeleton } from "@/app/dashboard/collections/collections-results-skeleton";

export default function LoadingCollectionsPage() {
  return (
    <div className="space-y-6">
      <TremorCard className="p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="h-7 w-56 animate-pulse rounded bg-muted" />
            <div className="h-4 w-[26rem] max-w-full animate-pulse rounded bg-muted" />
          </div>

          <div className="w-full xl:max-w-3xl">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_auto]">
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-lg bg-muted xl:w-28" />
            </div>
          </div>
        </div>
      </TremorCard>

      <CollectionsResultsSkeleton />
    </div>
  );
}
