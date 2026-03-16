import { Card, CardContent } from "@/components/ui/card";

export function BranchNetworkPageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="h-7 w-44 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      </div>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardContent className="p-0">
          <div className="space-y-4 px-4 pb-4 pt-3 md:px-5 md:pb-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
              <div className="flex-1 space-y-1">
                <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              </div>
              <div className="w-full space-y-1 sm:w-60">
                <div className="h-4 w-10 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              </div>
            </div>

            <div className="h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
          </div>

          <div className="border-t border-border/70 px-4 pb-4 pt-4 md:px-5 md:pb-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div className="rounded-xl border border-border/70 bg-background p-5 shadow-sm" key={index}>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-2">
                        <div className="h-6 w-36 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
                      </div>
                      <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
                    </div>

                    <div className="rounded-xl border border-border/70 px-4 py-3">
                      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                      <div className="mt-2 h-4 w-40 animate-pulse rounded bg-muted" />
                      <div className="mt-2 h-3 w-32 animate-pulse rounded bg-muted" />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {Array.from({ length: 3 }).map((__, statIndex) => (
                        <div className="h-20 animate-pulse rounded-lg bg-muted/80" key={statIndex} />
                      ))}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {Array.from({ length: 2 }).map((__, statIndex) => (
                        <div className="h-20 animate-pulse rounded-lg bg-muted/80" key={statIndex} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
