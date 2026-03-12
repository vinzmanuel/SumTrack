import { Card, CardContent } from "@/components/ui/card";

export function LoanRecordsModuleSkeleton({
  canChooseBranchFilter,
  showAction,
}: {
  canChooseBranchFilter: boolean;
  showAction: boolean;
}) {
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="p-0">
        <div className="space-y-2.5 px-4 pb-4 pt-2 md:px-5 md:pb-5 md:pt-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className={`grid flex-1 gap-3 ${canChooseBranchFilter ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
              <div className="space-y-1 md:col-span-2">
                <div className="h-4 w-14 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              </div>

              {canChooseBranchFilter ? (
                <div className="space-y-1">
                  <div className="h-4 w-14 animate-pulse rounded bg-muted" />
                  <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
                </div>
              ) : null}

              <div className="space-y-1">
                <div className="h-4 w-14 animate-pulse rounded bg-muted" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              </div>
            </div>

            {showAction ? <div className="h-9 w-28 animate-pulse rounded-md bg-muted" /> : null}
          </div>
        </div>

        <div className="border-t border-border/70 px-4 pb-4 pt-3 md:px-5 md:pb-5">
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <div className="min-w-[1100px]">
                <div className="grid grid-cols-10 gap-4 border-b pb-2.5">
                  {Array.from({ length: 10 }).map((_, index) => (
                    <div className="h-4 animate-pulse rounded bg-muted" key={`header-${index}`} />
                  ))}
                </div>
                <div className="space-y-0">
                  {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <div className="grid grid-cols-10 gap-4 border-b py-3" key={`row-${rowIndex}`}>
                      {Array.from({ length: 10 }).map((_, columnIndex) => (
                        <div className="h-5 animate-pulse rounded bg-muted/80" key={`cell-${rowIndex}-${columnIndex}`} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t pt-3 text-sm md:flex-row md:items-center md:justify-between">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
              <div className="flex items-center gap-2">
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
                <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
