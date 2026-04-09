import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function FormSectionSkeleton({
  titleWidth,
  children,
}: {
  titleWidth: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-md border border-border/70 bg-muted/20 px-4 py-4">
      <div className="space-y-2">
        <Skeleton className={`h-4 ${titleWidth}`} />
        <Skeleton className="h-3 w-full max-w-[32rem]" />
      </div>
      {children}
    </section>
  );
}

function ControlSkeleton() {
  return <Skeleton className="h-11 rounded-md" />;
}

export default function LoadingCreateAccountPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="px-1 py-1">
        <Skeleton className="h-8 w-40 rounded-md" />
      </div>

      <div className="rounded-md border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border/70 px-4 py-4 md:px-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-full max-w-[34rem]" />
          </div>
        </div>

        <div className="space-y-4 px-4 py-4 md:px-5">
          <FormSectionSkeleton titleWidth="w-32">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <ControlSkeleton />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <ControlSkeleton />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <ControlSkeleton />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <ControlSkeleton />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <ControlSkeleton />
              </div>
            </div>

            <div className="rounded-md border border-border/70 bg-background/70 px-4 py-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-72 max-w-full" />
                <Skeleton className="h-4 w-full max-w-[28rem]" />
              </div>
            </div>
          </FormSectionSkeleton>

          <FormSectionSkeleton titleWidth="w-28">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <ControlSkeleton />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <ControlSkeleton />
              </div>
            </div>

            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <ControlSkeleton />
            </div>
          </FormSectionSkeleton>

          <FormSectionSkeleton titleWidth="w-24">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <ControlSkeleton />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <ControlSkeleton />
              </div>
            </div>

            <div className="rounded-md border border-border/70 bg-background/70 p-3">
              <div className="space-y-2">
                <Skeleton className="h-4 w-full max-w-[24rem]" />
                <Skeleton className="h-4 w-full max-w-[20rem]" />
                <Skeleton className="h-4 w-full max-w-[22rem]" />
              </div>
            </div>
          </FormSectionSkeleton>

          <div className="flex flex-col-reverse gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Skeleton className="h-4 w-44" />
            <Skeleton className="h-11 w-36 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
