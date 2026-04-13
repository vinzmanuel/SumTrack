export function BranchNetworkPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="h-7 w-44 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="h-11 w-full max-w-[360px] animate-pulse rounded-md bg-muted" />
          <div className="flex items-center gap-2">
            <div className="h-11 w-24 animate-pulse rounded-md bg-muted" />
            <div className="h-11 w-36 animate-pulse rounded-md bg-muted" />
          </div>
        </div>
        <div className="h-11 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="rounded-md border border-border/70 bg-background p-4 shadow-sm" key={index}>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div className="h-6 w-36 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-9 w-9 animate-pulse rounded-md bg-muted" />
              </div>

              <div className="rounded-md border border-border/70 px-3 py-3">
                <div className="h-5 w-20 animate-pulse rounded bg-muted" />
                <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="mt-1.5 h-3 w-32 animate-pulse rounded bg-muted" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((__, statIndex) => (
                  <div className="h-20 animate-pulse rounded-md bg-muted/80" key={statIndex} />
                ))}
              </div>
              <div className="h-20 animate-pulse rounded-md bg-muted/80" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
