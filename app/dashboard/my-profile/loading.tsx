import { Card, CardContent, CardHeader } from "@/components/ui/card";

function OverviewItemSkeleton() {
  return (
    <div className="space-y-1 rounded-md border border-border/70 bg-muted/30 px-3 py-3 dark:bg-muted/20">
      <div className="h-3 w-28 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
      <div className="h-4 w-full animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
    </div>
  );
}

export default function LoadingMyProfilePage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid items-start gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="border-border bg-card shadow-sm xl:sticky xl:top-6">
          <CardHeader className="space-y-4 border-b border-border/70 bg-muted/30 pb-5 dark:bg-muted/20">
            <div className="space-y-2">
              <div className="h-3 w-20 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
              <div className="h-8 w-64 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
              <div className="h-4 w-56 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="h-6 w-28 animate-pulse rounded-full bg-muted/70 dark:bg-muted/40" />
              <div className="h-6 w-24 animate-pulse rounded-full bg-muted/70 dark:bg-muted/40" />
              <div className="h-6 w-20 animate-pulse rounded-full bg-muted/70 dark:bg-muted/40" />
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
          <Card className="min-h-[360px] border-border bg-card shadow-sm">
            <CardHeader className="space-y-2">
              <div className="h-6 w-44 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
              <div className="h-4 w-80 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div className="space-y-2" key={index}>
                    <div className="h-4 w-24 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
                    <div className="h-10 w-full animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div className="space-y-2" key={index}>
                    <div className="h-4 w-24 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
                    <div className="h-10 w-full animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
                    <div className="h-3 w-48 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                <div className="h-4 w-72 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
                <div className="h-10 w-40 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-[320px] border-border bg-card shadow-sm">
            <CardHeader className="space-y-2">
              <div className="h-6 w-40 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
              <div className="h-4 w-96 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
                  <div className="h-10 w-full animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
                  <div className="h-3 w-44 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
                </div>
                <div className="flex items-center justify-end">
                  <div className="h-10 w-36 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
                </div>
              </div>

              <div className="border-t border-border/70 pt-6" />

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div className="space-y-2" key={index}>
                      <div className="h-4 w-28 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
                      <div className="h-10 w-full animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
                    </div>
                  ))}
                </div>
                <div className="h-3 w-80 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
                <div className="flex items-center justify-end">
                  <div className="h-10 w-36 animate-pulse rounded bg-muted/70 dark:bg-muted/40" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

