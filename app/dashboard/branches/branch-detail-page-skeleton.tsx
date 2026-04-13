import { Card, CardContent } from "@/components/ui/card";

export function BranchDetailPageSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden rounded-md border-border/70 py-0 shadow-sm">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="h-9 w-64 animate-pulse rounded bg-muted" />
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="flex flex-wrap gap-2">
                <div className="h-6 w-32 animate-pulse rounded-md bg-muted" />
                <div className="h-6 w-28 animate-pulse rounded-md bg-muted" />
              </div>
            </div>

            <div className="flex gap-2">
              <div className="h-11 w-20 animate-pulse rounded-md bg-muted" />
              <div className="h-11 w-24 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="border-b-2 border-border/80">
        <div className="-mb-px flex flex-wrap items-center gap-6">
          <div className="h-11 w-24 animate-pulse rounded-md bg-muted" />
          <div className="h-11 w-28 animate-pulse rounded-md bg-muted" />
          <div className="h-11 w-20 animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      <Card className="rounded-md border-border/70 py-0 shadow-sm">
        <CardContent className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="h-20 animate-pulse rounded-md bg-muted/80" key={index} />
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="rounded-md border-border/70 py-0 shadow-sm">
          <CardContent className="grid gap-3 p-5 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div className="h-24 animate-pulse rounded-md bg-muted/80" key={index} />
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-md border-border/70 py-0 shadow-sm">
          <CardContent className="grid gap-3 p-5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div className="h-24 animate-pulse rounded-md bg-muted/80" key={index} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-md border-border/70 py-0 shadow-sm">
        <CardContent className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="h-24 animate-pulse rounded-md bg-muted/80" key={index} />
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-md border-border/70 py-0 shadow-sm">
        <CardContent className="p-5">
          <div className="space-y-3">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
            <div className="h-[280px] w-full animate-pulse rounded-md bg-muted/80" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
