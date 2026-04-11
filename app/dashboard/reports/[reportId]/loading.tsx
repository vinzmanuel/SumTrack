import { Skeleton } from "@/components/ui/skeleton";

const CONTROL_SKELETON_CLASS_NAME =
  "rounded-md border border-border/70 bg-white shadow-xs dark:bg-muted/70";

export default function LoadingReportSnapshotViewerPage() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="space-y-5">
        <article className="mx-auto max-w-5xl rounded-2xl border border-border/70 bg-background px-6 py-8 shadow-sm md:px-10">
          <div className="space-y-4 border-b border-border/70 pb-6">
            <div className="space-y-2">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-8 w-[34rem] max-w-full" />
              <Skeleton className="h-4 w-56" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div className="space-y-1" key={`report-meta-${index}`}>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-full max-w-[14rem]" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 pt-8">
            <div className="rounded-md border border-border/70 bg-card p-4">
              <Skeleton className="h-5 w-56" />
              <Skeleton className="mt-3 h-[260px] w-full rounded-md" />
            </div>
            <div className="rounded-md border border-border/70 bg-card p-4">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="mt-3 h-[220px] w-full rounded-md" />
            </div>
          </div>

          <div className="mt-10 border-t border-border/70 pt-5">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Skeleton className={`h-10 w-24 ${CONTROL_SKELETON_CLASS_NAME}`} />
              <Skeleton className={`h-10 w-24 ${CONTROL_SKELETON_CLASS_NAME}`} />
              <Skeleton className={`h-10 w-24 ${CONTROL_SKELETON_CLASS_NAME}`} />
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
