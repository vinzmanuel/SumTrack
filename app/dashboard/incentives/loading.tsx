import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingIncentivesPage() {
  return (
    <div className="w-full max-w-none space-y-5 pb-6 pt-1 sm:pb-6 sm:pt-2">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="bg-linear-to-r from-slate-50 via-background to-emerald-50/50 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl space-y-1">
              <div className="space-y-1">
                <Skeleton className="h-9 w-64 max-w-full" />
                <Skeleton className="h-4 w-lg max-w-full" />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Skeleton className="h-8 w-28 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-10 w-36" />
          </div>
        </div>

        <CardContent className="border-t border-border/70 px-6 pb-4 pt-3">
          <div className="flex flex-wrap items-end justify-end gap-4">
            <label className="w-full space-y-1 sm:w-[220px]">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-10 w-full" />
            </label>
            <label className="w-full space-y-1 sm:w-[220px]">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-10 w-full" />
            </label>
            <div className="flex items-end">
              <Skeleton className="h-9 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        <CardContent className="flex flex-col gap-6 py-6">
          <div className="flex items-center gap-3">
            <Skeleton className="size-6 rounded-sm" />
            <Skeleton className="h-8 w-80 max-w-full" />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>

          <div className="overflow-hidden rounded-2xl border">
            <div className="border-b px-5 py-3">
              <div className="grid grid-cols-[140px_minmax(0,1.9fr)_170px_170px_140px] gap-4">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="ml-auto h-4 w-16" />
              </div>
            </div>
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, index) => (
                <div className="border-b px-5 py-4 last:border-b-0" key={index}>
                  <div className="grid grid-cols-[140px_minmax(0,1.9fr)_170px_170px_140px] items-center gap-4">
                    <Skeleton className="h-7 w-28 rounded-full" />
                    <Skeleton className="h-5 w-52" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-7 w-24 rounded-full" />
                    <Skeleton className="ml-auto h-5 w-24" />
                  </div>
                </div>
              ))}
              <div className="px-5 py-4">
                <div className="grid grid-cols-[140px_minmax(0,1.9fr)_170px_170px_140px] items-center gap-4">
                  <div />
                  <div />
                  <div />
                  <Skeleton className="h-5 w-14" />
                  <Skeleton className="ml-auto h-5 w-24" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden py-0">
        <CardContent className="py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <Skeleton className="h-14 w-full max-w-2xl" />
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
