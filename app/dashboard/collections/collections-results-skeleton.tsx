import { TremorCard } from "@/components/tremor/raw/metric-card";

export function CollectionsResultsSkeleton({
  errorMessage,
}: {
  errorMessage?: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <TremorCard className="p-5" key={index}>
            <div className="space-y-3">
              <div className="h-4 w-32 animate-pulse rounded bg-muted" />
              <div className="h-8 w-28 animate-pulse rounded bg-muted" />
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
            </div>
          </TremorCard>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <TremorCard className="xl:col-span-8">
          <div className="space-y-5 p-6">
            <div className="space-y-2">
              <div className="h-5 w-52 animate-pulse rounded bg-muted" />
              <div className="h-4 w-72 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-[380px] animate-pulse rounded-xl bg-muted" />
          </div>
        </TremorCard>

        <TremorCard className="xl:col-span-4">
          <div className="space-y-5 p-6">
            <div className="space-y-2">
              <div className="h-5 w-44 animate-pulse rounded bg-muted" />
              <div className="h-4 w-60 animate-pulse rounded bg-muted" />
            </div>
            <div className="h-[380px] animate-pulse rounded-xl bg-muted" />
          </div>
        </TremorCard>

        {Array.from({ length: 3 }).map((_, index) => (
          <TremorCard className={index === 0 ? "xl:col-span-5" : index === 1 ? "xl:col-span-4" : "xl:col-span-3"} key={index}>
            <div className="space-y-4 p-6">
              <div className="h-5 w-40 animate-pulse rounded bg-muted" />
              <div className="h-4 w-64 animate-pulse rounded bg-muted" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((__, itemIndex) => (
                  <div className="space-y-2" key={itemIndex}>
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    <div className="h-2 w-full animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          </TremorCard>
        ))}
      </div>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
    </div>
  );
}
