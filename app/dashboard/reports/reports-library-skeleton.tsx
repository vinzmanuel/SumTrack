import { Skeleton } from "@/components/ui/skeleton";

const CONTROL_SKELETON_CLASS_NAME =
  "rounded-md border border-border/70 bg-white shadow-xs dark:bg-muted/70";

export function ReportsLibrarySkeleton({ canGenerate = true }: { canGenerate?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2.5">
          <Skeleton className={`h-11 w-[170px] ${CONTROL_SKELETON_CLASS_NAME}`} />
        </div>

        {canGenerate ? (
          <div className="flex flex-wrap items-center gap-2.5 xl:justify-end">
            <Skeleton className={`h-11 w-[172px] ${CONTROL_SKELETON_CLASS_NAME}`} />
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="border-b-2 border-border/80">
          <div className="-mb-px flex flex-wrap items-center gap-6">
            <Skeleton className="h-11 w-32 rounded-none" />
            <Skeleton className="h-11 w-28 rounded-none" />
            <Skeleton className="h-11 w-28 rounded-none" />
          </div>
        </div>

        <div className="pt-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <div className="overflow-x-auto rounded-md border border-border/70 bg-card shadow-sm">
            <div className="min-w-[1080px] text-sm">
              <div className="grid grid-cols-[minmax(0,2.3fr)_minmax(0,1.7fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_56px] border-b border-border/70 bg-card">
                <div className="py-3 pl-5">
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
                <div className="py-3">
                  <Skeleton className="h-4 w-24 rounded-md" />
                </div>
                <div className="py-3">
                  <Skeleton className="h-4 w-24 rounded-md" />
                </div>
                <div className="py-3">
                  <Skeleton className="h-4 w-16 rounded-md" />
                </div>
                <div className="py-3 pr-4">
                  <div className="flex justify-end">
                    <Skeleton className="h-4 w-4 rounded-sm" />
                  </div>
                </div>
              </div>

              {Array.from({ length: 6 }).map((_, rowIndex) => (
                <div
                  className="grid grid-cols-[minmax(0,2.3fr)_minmax(0,1.7fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_56px] border-b border-border/70 last:border-b-0"
                  key={`reports-library-row-${rowIndex}`}
                >
                  <div className="py-3 pl-5 pr-4">
                    <Skeleton className="h-5 w-72 max-w-[28rem]" />
                  </div>
                  <div className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Skeleton className="h-7 w-24 rounded-md" />
                      <Skeleton className="h-5 w-36" />
                    </div>
                  </div>
                  <div className="py-3">
                    <Skeleton className="h-5 w-32" />
                  </div>
                  <div className="py-3">
                    <Skeleton className="h-7 w-20 rounded-md" />
                  </div>
                  <div className="py-3 pr-4">
                    <div className="flex justify-end">
                      <Skeleton className="h-9 w-9 rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-1">
          <div className="flex flex-col gap-3 text-sm xl:flex-row xl:items-center xl:justify-between">
            <Skeleton className="h-4 w-32" />

            <div className="flex flex-wrap items-center gap-2 xl:justify-center">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-10" />
                <Skeleton className={`h-11 w-[84px] ${CONTROL_SKELETON_CLASS_NAME}`} />
              </div>

              <div className="ml-4 flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className={`h-9 w-9 ${CONTROL_SKELETON_CLASS_NAME}`} />
                <Skeleton className={`h-9 w-9 ${CONTROL_SKELETON_CLASS_NAME}`} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
