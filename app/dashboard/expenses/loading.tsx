import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingExpensesPage() {
  return (
    <div className="w-full max-w-none space-y-5 px-4 pb-6 pt-1 sm:px-6 sm:pb-6 sm:pt-2">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="bg-gradient-to-r from-slate-50 via-background to-emerald-50/60 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1">
              <div className="space-y-1">
                <Skeleton className="h-9 w-48 max-w-full" />
                <Skeleton className="h-4 w-[30rem] max-w-full" />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
        </div>

        <div className="border-t border-border/70 px-6 pb-4 pt-3">
          <div className="grid gap-4 lg:grid-cols-4">
            <label className="space-y-1">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-10 w-full" />
            </label>
            <label className="space-y-1">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-10 w-full" />
            </label>
            <label className="space-y-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </label>
            <div className="flex items-end justify-start lg:justify-end">
              <Skeleton className="h-9 w-16" />
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>

        <Card className="gap-0 overflow-hidden py-0">
          <div className="border-b px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-72 max-w-full" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          </div>

          <CardContent className="space-y-4 p-5">
            <div className="overflow-hidden rounded-2xl border">
              <div className="border-b px-5 py-3">
                <div className="grid grid-cols-[90px_140px_130px_minmax(0,1fr)_120px_130px_210px_170px] gap-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <Skeleton className="h-4 w-20" key={index} />
                  ))}
                </div>
              </div>

              <div className="space-y-0">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div className="border-b px-5 py-4 last:border-b-0" key={index}>
                    <div className="grid grid-cols-[90px_140px_130px_minmax(0,1fr)_120px_130px_210px_170px] items-center gap-4">
                      <Skeleton className="h-5 w-12" />
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="ml-auto h-5 w-20" />
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-5 w-44" />
                      <Skeleton className="h-5 w-28" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t pt-4 text-sm md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-44" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
