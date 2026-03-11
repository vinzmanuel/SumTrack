import { TremorCard } from "@/components/tremor/raw/metric-card";

export function CollectorsResultsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <TremorCard className="p-5" key={index}>
            <div className="space-y-3">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
              <div className="h-8 w-32 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
            </div>
          </TremorCard>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <TremorCard className="xl:col-span-8">
          <div className="space-y-6 p-6">
            <div className="h-5 w-44 animate-pulse rounded bg-muted" />
            <div className="grid gap-3 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div className="h-28 w-full animate-pulse rounded-2xl bg-muted" key={index} />
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div className="h-10 w-full animate-pulse rounded bg-muted" key={index} />
              ))}
            </div>
          </div>
        </TremorCard>
        <div className="space-y-6 xl:col-span-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <TremorCard className="p-6" key={index}>
              <div className="space-y-3">
                <div className="h-5 w-40 animate-pulse rounded bg-muted" />
                <div className="h-4 w-56 animate-pulse rounded bg-muted" />
                {Array.from({ length: 4 }).map((__, itemIndex) => (
                  <div className="h-10 w-full animate-pulse rounded bg-muted" key={itemIndex} />
                ))}
              </div>
            </TremorCard>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <TremorCard className="p-6" key={index}>
            <div className="space-y-4">
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              <div className="h-[300px] w-full animate-pulse rounded-xl bg-muted" />
            </div>
          </TremorCard>
        ))}
      </div>
    </div>
  );
}
