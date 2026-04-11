import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingExpensesPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex w-full flex-wrap items-center gap-2.5">
          <Skeleton className="h-11 w-[190px] rounded-md bg-muted/70 dark:bg-muted/40" />
          <Skeleton className="h-11 w-[190px] rounded-md bg-muted/70 dark:bg-muted/40" />
          <Skeleton className="h-11 w-[190px] rounded-md bg-muted/70 dark:bg-muted/40" />
          <Skeleton className="h-11 w-[110px] rounded-md bg-muted/70 dark:bg-muted/40" />
        </div>
        <Skeleton className="h-11 w-[158px] rounded-md bg-muted/70 dark:bg-muted/40" />
      </div>

      <div className="space-y-4">
        <div className="border-b-2 border-border/80">
          <div className="-mb-px flex flex-wrap items-center gap-6">
            <Skeleton className="h-11 w-[120px] rounded-none" />
            <Skeleton className="h-11 w-[126px] rounded-none" />
          </div>
        </div>

        <Card className="gap-0 overflow-hidden py-0">
          <CardContent className="space-y-4 px-0 pb-0 pt-0">
            <div className="overflow-hidden rounded-md border border-border/70 bg-card shadow-sm">
              <div className="border-b border-border/70 bg-card px-5 py-3">
                <div className="grid grid-cols-[190px_140px_160px_minmax(0,1fr)_120px] gap-4">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="ml-auto h-4 w-12" />
                </div>
              </div>

              <div className="space-y-0">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div className="border-b px-5 py-3 last:border-b-0" key={index}>
                    <div className="grid grid-cols-[190px_140px_160px_minmax(0,1fr)_120px] items-center gap-4">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-28" />
                      <Skeleton className="h-5 w-24" />
                      <div className="flex min-w-0 items-center gap-2">
                        <Skeleton className="h-6 w-28 rounded-md" />
                        <Skeleton className="h-5 w-32" />
                      </div>
                      <Skeleton className="ml-auto h-8 w-24 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 px-1 text-sm xl:flex-row xl:items-center xl:justify-between">
              <Skeleton className="h-4 w-44" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-11 w-20 rounded-md bg-muted/70 dark:bg-muted/40" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-11 w-11 rounded-md bg-muted/70 dark:bg-muted/40" />
                <Skeleton className="h-11 w-11 rounded-md bg-muted/70 dark:bg-muted/40" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
