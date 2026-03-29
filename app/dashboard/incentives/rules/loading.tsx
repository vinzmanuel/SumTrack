import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingIncentiveRulesPage() {
  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 pb-6 pt-2 sm:px-6">
      <Skeleton className="h-9 w-36" />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="bg-gradient-to-r from-slate-50 via-background to-amber-50/60 p-6">
          <CardHeader className="px-0 py-0">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Skeleton className="size-5 rounded-sm" />
                <Skeleton className="h-9 w-60" />
              </div>
              <Skeleton className="h-4 w-[34rem] max-w-full" />
              <div className="flex flex-wrap gap-2 pt-2">
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-32 rounded-full" />
              </div>
            </div>
          </CardHeader>
        </div>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <Skeleton className="h-7 w-28" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <label className="space-y-2">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-10 w-full" />
              </label>
              <label className="space-y-2">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-10 w-full" />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </label>
                <label className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </label>
              </div>
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0 flex flex-col gap-5">
          <Card className="min-w-0 gap-0 overflow-hidden py-0">
            <CardHeader className="gap-4 border-b py-5">
              <div className="flex flex-col gap-1">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-4 w-[28rem] max-w-full" />
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,220px)]">
                <label className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </label>
                <label className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 w-full" />
                </label>
              </div>
            </CardHeader>

            <CardContent className="p-5">
              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl border">
                  <div className="border-b px-5 py-3">
                    <div className="grid grid-cols-[140px_150px_130px_120px_130px_140px_140px] gap-4">
                      {Array.from({ length: 7 }).map((_, index) => (
                        <Skeleton className="h-4 w-20" key={index} />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-0">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <div className="border-b px-5 py-4 last:border-b-0" key={index}>
                        <div className="grid grid-cols-[140px_150px_130px_120px_130px_140px_140px] items-center gap-4">
                          <Skeleton className="h-5 w-24" />
                          <Skeleton className="h-5 w-28" />
                          <Skeleton className="h-7 w-24 rounded-full" />
                          <Skeleton className="h-5 w-16" />
                          <Skeleton className="h-5 w-20" />
                          <Skeleton className="h-5 w-24" />
                          <Skeleton className="h-5 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-border/70 pt-4 text-sm md:flex-row md:items-center md:justify-between">
                  <Skeleton className="h-4 w-44" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-9 w-16" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
