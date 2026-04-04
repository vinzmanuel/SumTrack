import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CollectionsResultsSkeleton } from "@/app/dashboard/collections/collections-results-skeleton";

export default function LoadingCollectionsPage() {
  return (
    <div className="w-full max-w-none space-y-4 pb-6 pt-1 sm:pb-6 sm:pt-2">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3">
            <div className="space-y-2">
              <Skeleton className="h-8 w-44 max-w-full" />
              <Skeleton className="h-4 w-[34rem] max-w-full" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-7 w-36 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
              <Skeleton className="h-7 w-32 rounded-full" />
            </div>
          </div>
        </div>
        <CardContent className="border-t border-border/70 px-5 pb-3.5 pt-2.5 sm:px-6">
          <div className="flex w-full justify-end">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
              <div className="space-y-1">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-1">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-20" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <CollectionsResultsSkeleton />
    </div>
  );
}
