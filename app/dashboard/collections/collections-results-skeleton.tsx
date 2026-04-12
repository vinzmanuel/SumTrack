import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CollectionsResultsSkeleton({
  errorMessage,
}: {
  errorMessage?: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card className="gap-0 overflow-hidden rounded-md py-0 shadow-sm" key={index}>
            <CardHeader className="gap-0 pb-1.5 pt-3.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-4 w-full" />
            </CardHeader>
            <CardContent className="pb-4.5 pt-0">
              <Skeleton className="h-8 w-32" />
              {index === 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-32 rounded-full" />
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="gap-0 overflow-hidden rounded-md py-0 shadow-sm">
        <CardHeader className="gap-0 pb-1.5 pt-3.5">
          <Skeleton className="h-5 w-52" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </CardHeader>
        <CardContent className="pb-4.5 pt-0">
          <div className="rounded-md border border-border/70 p-2.5">
            <Skeleton className="h-[260px] rounded-md md:h-[300px]" />
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden rounded-md py-0 shadow-sm">
        <CardHeader className="gap-0 pb-1.5 pt-3.5">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
        </CardHeader>
        <CardContent className="pb-4.5 pt-0">
          <div className="rounded-md border border-border/70 p-2.5">
            <Skeleton className="h-[260px] rounded-md md:h-[300px]" />
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden rounded-md py-0 shadow-sm">
        <CardHeader className="gap-0 pb-1.5 pt-3.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </CardHeader>
        <CardContent className="flex flex-col gap-2.5 pb-4 pt-0">
          {Array.from({ length: 4 }).map((_, itemIndex) => (
            <div className="border-b border-border/60 px-3 py-2.5 last:border-b-0" key={itemIndex}>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3.5 w-44" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="ml-auto h-5 w-24" />
                  <Skeleton className="ml-auto h-3.5 w-14" />
                </div>
              </div>
              <Skeleton className="mt-2 h-1.5 w-full rounded-full" />
              <div className="mt-2 flex items-center justify-between">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
    </div>
  );
}
