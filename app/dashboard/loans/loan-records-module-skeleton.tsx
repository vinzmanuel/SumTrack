export function LoanRecordsModuleSkeleton({
  canChooseBranchFilter,
  showAction,
}: {
  canChooseBranchFilter: boolean;
  showAction: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3 px-1">
        <div className="h-11 w-72 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="h-11 w-full animate-pulse rounded-md bg-zinc-200 xl:w-[360px] dark:bg-zinc-800" />
          <div className="flex w-full flex-wrap items-center gap-2.5 xl:w-auto xl:justify-end">
            {canChooseBranchFilter ? <div className="h-11 w-[210px] animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" /> : null}
            <div className="h-11 w-[210px] animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-11 w-[100px] animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
            {showAction ? <div className="h-11 w-32 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" /> : null}
          </div>
        </div>
      </div>

      <div className="space-y-4 px-1">
        <div className="overflow-x-auto rounded-md border border-border/70 bg-card shadow-sm">
          <div className="min-w-[1200px]">
            <div className="grid grid-cols-11 gap-4 border-b px-5 py-3">
              {Array.from({ length: 11 }).map((_, index) => (
                <div className="h-4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" key={`header-${index}`} />
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, rowIndex) => (
              <div className="grid grid-cols-11 gap-4 border-b px-5 py-3 last:border-b-0" key={`row-${rowIndex}`}>
                {Array.from({ length: 11 }).map((_, columnIndex) => (
                  <div className="h-5 animate-pulse rounded bg-zinc-200/90 dark:bg-zinc-800/90" key={`cell-${rowIndex}-${columnIndex}`} />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 px-1 text-sm xl:flex-row xl:items-center xl:justify-between">
          <div className="h-4 w-44 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex items-center gap-2">
            <div className="h-4 w-10 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-11 w-[84px] animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
            <div className="ml-4 h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-10 w-10 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-10 w-10 animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}
