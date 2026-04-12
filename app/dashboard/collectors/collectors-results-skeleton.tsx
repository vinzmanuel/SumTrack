import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CollectorsResultsSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden rounded-md py-0">
        <CardHeader className="flex flex-col gap-3 pb-3 pt-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-10 w-full sm:w-[240px]" />
        </CardHeader>
        <CardContent className="space-y-4 px-5 pb-5 pt-3">
          <div className="space-y-2 rounded-md border border-border/70">
            <div className="grid grid-cols-[72px_minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_92px] gap-3 border-b border-border/70 px-5 py-3">
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton className="h-4 w-full" key={index} />
              ))}
            </div>
            {Array.from({ length: 10 }).map((_, index) => (
              <div
                className="grid grid-cols-[72px_minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_92px] gap-3 px-5 py-3"
                key={index}
              >
                {Array.from({ length: 7 }).map((__, cellIndex) => (
                  <Skeleton className="h-4 w-full" key={cellIndex} />
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-4 w-36" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-11 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-11 w-11" />
              <Skeleton className="h-11 w-11" />
            </div>
          </div>
        </CardContent>
      </Card>
  );
}
