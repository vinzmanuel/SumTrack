import { Card, CardContent } from "@/components/ui/card";

export function BranchDetailPageSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardContent className="p-0">
          <div className="space-y-4 bg-gradient-to-r from-slate-50 via-white to-emerald-50/60 p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
                  <div className="space-y-2">
                    <div className="h-9 w-64 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="h-6 w-32 animate-pulse rounded-full bg-muted" />
                  <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
                  <div className="h-6 w-32 animate-pulse rounded-full bg-muted" />
                </div>
              </div>

              <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
            </div>
          </div>

          <div className="border-t border-border/70 p-6">
            <div className="inline-flex flex-wrap gap-2 rounded-xl border border-border/70 bg-muted/30 p-1">
              <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
              <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
              <div className="h-9 w-20 animate-pulse rounded-lg bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-muted" />
            <div className="h-8 w-56 animate-pulse rounded bg-muted" />
            <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="h-24 animate-pulse rounded-lg bg-muted/80" key={index} />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 shadow-sm">
          <CardContent className="grid gap-3 p-6 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div className="h-28 animate-pulse rounded-xl bg-muted/80" key={index} />
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardContent className="grid gap-3 p-6 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="h-24 animate-pulse rounded-xl bg-muted/80" key={index} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="h-24 animate-pulse rounded-xl bg-muted/80" key={index} />
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
            <div className="h-[280px] w-full animate-pulse rounded-xl bg-muted/80" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
