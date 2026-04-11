import { Skeleton } from "@/components/ui/skeleton";

const CONTROL_SKELETON_CLASS_NAME =
  "rounded-md border border-border/70 bg-white shadow-xs dark:bg-muted/70";

export default function LoadingGenerateReportPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="border-b-2 border-border/80">
        <div className="-mb-px flex flex-wrap items-center gap-6">
          <Skeleton className="h-11 w-32 rounded-none" />
          <Skeleton className="h-11 w-32 rounded-none" />
        </div>
      </div>

      <div className="rounded-md border border-border/70 bg-card px-4 py-4 shadow-sm md:px-5">
        <div className="space-y-5">
          <div className="space-y-1">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-[36rem] max-w-full" />
          </div>

          <div className="space-y-3">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className={`h-11 w-full ${CONTROL_SKELETON_CLASS_NAME}`} />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className={`h-11 w-full ${CONTROL_SKELETON_CLASS_NAME}`} />
              </div>
            </div>

            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className={`h-11 w-full ${CONTROL_SKELETON_CLASS_NAME}`} />
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-border/70" />

        <div className="mt-4 space-y-5">
          <div className="space-y-1">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-[32rem] max-w-full" />
          </div>

          <div className="space-y-2 rounded-md border border-border/70 bg-background/70 p-3">
            <Skeleton className="h-4 w-[26rem] max-w-full" />
            <div className="grid gap-2 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="flex items-center gap-2" key={`branch-option-${index}`}>
                  <Skeleton className="h-4 w-4 rounded-sm" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-border/70" />

        <div className="mt-4 space-y-5">
          <div className="space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-[40rem] max-w-full" />
          </div>

          <div className="space-y-2 md:w-1/2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className={`h-11 w-full ${CONTROL_SKELETON_CLASS_NAME}`} />
          </div>
        </div>

        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className={`h-11 w-52 ${CONTROL_SKELETON_CLASS_NAME}`} />
        </div>
      </div>
    </div>
  );
}
