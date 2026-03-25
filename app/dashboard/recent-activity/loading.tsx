import { TremorCard } from "@/components/tremor/raw/metric-card";

function HeaderBadgeSkeleton() {
  return <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />;
}

function FilterFieldSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

function LogRowSkeleton() {
  return (
    <div className="hidden grid-cols-[190px_minmax(0,1.45fr)_300px_145px_24px] items-start gap-4 border-b border-border/70 px-6 py-3 lg:grid">
      <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="flex items-start gap-2">
        <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
        <div className="h-5 w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="flex items-start gap-2">
        <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-5 w-24 animate-pulse rounded bg-muted" />
      <div className="h-5 w-4 animate-pulse rounded bg-muted" />
    </div>
  );
}

function MobileLogRowSkeleton() {
  return (
    <div className="space-y-3 border-b border-border/70 px-4 py-4 sm:px-6 lg:hidden">
      <div className="h-4 w-36 animate-pulse rounded bg-muted" />
      <div className="flex items-start gap-2">
        <div className="mt-0.5 h-6 w-28 animate-pulse rounded-full bg-muted" />
        <div className="h-10 flex-1 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex items-start gap-2">
        <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export default function LoadingRecentActivityPage() {
  return (
    <div className="w-full max-w-none space-y-5 px-4 pb-6 pt-1 sm:px-6 sm:pb-6 sm:pt-2">
      <TremorCard className="overflow-hidden p-0">
        <div className="bg-gradient-to-r from-slate-50 via-white to-emerald-50/60 p-6">
          <div className="space-y-2">
            <div className="h-8 w-52 animate-pulse rounded bg-muted" />
            <div className="h-4 w-[30rem] max-w-full animate-pulse rounded bg-muted" />
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <HeaderBadgeSkeleton />
              <HeaderBadgeSkeleton />
              <HeaderBadgeSkeleton />
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 p-6">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <FilterFieldSkeleton />
            <FilterFieldSkeleton />
            <FilterFieldSkeleton />
            <FilterFieldSkeleton />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
            <div className="h-4 w-64 animate-pulse rounded bg-muted" />
            <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </TremorCard>

      <TremorCard className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-6 py-4">
          <div className="space-y-2">
            <div className="h-5 w-28 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        </div>

        <div className="hidden grid-cols-[190px_minmax(0,1.45fr)_300px_145px_24px] gap-4 border-b border-border/70 bg-zinc-50/60 px-6 py-3 lg:grid">
          <div className="h-3 w-14 animate-pulse rounded bg-muted" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="h-3 w-14 animate-pulse rounded bg-muted" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div />
        </div>

        <div>
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index}>
              <MobileLogRowSkeleton />
              <LogRowSkeleton />
            </div>
          ))}
        </div>
      </TremorCard>
    </div>
  );
}
