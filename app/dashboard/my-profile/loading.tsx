import { Card, CardContent, CardHeader } from "@/components/ui/card";

function OverviewItemSkeleton() {
  return (
    <div className="space-y-1 rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3 py-3">
      <div className="h-3 w-28 animate-pulse rounded bg-muted" />
      <div className="h-4 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

export default function LoadingMyProfilePage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="border-zinc-200/80 shadow-sm xl:sticky xl:top-6">
          <CardHeader className="space-y-4 border-b bg-zinc-50/70 pb-5">
            <div className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="h-8 w-64 animate-pulse rounded bg-muted" />
              <div className="h-4 w-56 animate-pulse rounded bg-muted" />
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
              <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pb-6">
            <OverviewItemSkeleton />
            <OverviewItemSkeleton />
            <OverviewItemSkeleton />
            <OverviewItemSkeleton />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="min-h-[360px]">
            <CardHeader className="space-y-2">
              <div className="h-6 w-44 animate-pulse rounded bg-muted" />
              <div className="h-4 w-80 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div className="space-y-2" key={index}>
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-10 w-full animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div className="space-y-2" key={index}>
                    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-10 w-full animate-pulse rounded bg-muted" />
                    <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 border-t pt-4">
                <div className="h-4 w-72 animate-pulse rounded bg-muted" />
                <div className="h-10 w-40 animate-pulse rounded bg-muted" />
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-[320px]">
            <CardHeader className="space-y-2">
              <div className="h-6 w-40 animate-pulse rounded bg-muted" />
              <div className="h-4 w-96 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-10 w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-44 animate-pulse rounded bg-muted" />
                </div>
                <div className="flex items-center justify-end">
                  <div className="h-10 w-36 animate-pulse rounded bg-muted" />
                </div>
              </div>

              <div className="border-t pt-6" />

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div className="space-y-2" key={index}>
                      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                      <div className="h-10 w-full animate-pulse rounded bg-muted" />
                    </div>
                  ))}
                </div>
                <div className="h-3 w-80 animate-pulse rounded bg-muted" />
                <div className="flex items-center justify-end">
                  <div className="h-10 w-36 animate-pulse rounded bg-muted" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
