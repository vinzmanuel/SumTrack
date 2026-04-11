import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function AuditLogSkeleton({ canChooseBranch = true }: { canChooseBranch?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:w-[360px] xl:shrink-0">
            <Skeleton className="h-11 w-full rounded-md" />
          </div>

          <div className="flex w-full flex-wrap items-center gap-2.5 xl:w-auto xl:justify-end">
            <Skeleton className="h-11 w-full min-w-[180px] rounded-md sm:w-[190px]" />
            {canChooseBranch ? <Skeleton className="h-11 w-full min-w-[180px] rounded-md sm:w-[190px]" /> : null}
            <Skeleton className="h-11 w-full min-w-[180px] rounded-md sm:w-[190px]" />
            <Skeleton className="h-11 w-full min-w-[180px] rounded-md sm:w-[190px]" />
            <Skeleton className="h-11 w-full min-w-[180px] rounded-md sm:w-[190px]" />
            <Skeleton className="h-11 w-[84px] rounded-md" />
          </div>
        </div>

        <div className="px-1 py-1">
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        <div className="space-y-4">
          <div className="overflow-x-auto rounded-md border border-border/70 bg-card shadow-sm">
              <Table className="min-w-[1180px] table-fixed text-sm">
                <TableHeader>
                  <TableRow className="border-border/70 bg-card">
                    <TableHead className="h-auto w-[20%] py-3 pl-5">
                      <Skeleton className="h-4 w-24 rounded-md" />
                    </TableHead>
                    <TableHead className="h-auto w-[22%] py-3">
                      <Skeleton className="h-4 w-28 rounded-md" />
                    </TableHead>
                    <TableHead className="h-auto w-[20%] py-3">
                      <Skeleton className="h-4 w-16 rounded-md" />
                    </TableHead>
                    <TableHead className="h-auto w-[20%] py-3">
                      <Skeleton className="h-4 w-18 rounded-md" />
                    </TableHead>
                    <TableHead className="h-auto w-[14%] py-3">
                      <Skeleton className="h-4 w-24 rounded-md" />
                    </TableHead>
                    <TableHead className="h-auto w-[4%] py-3 pr-5">
                      <div className="flex justify-end">
                        <Skeleton className="h-4 w-4 rounded-sm" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, rowIndex) => (
                  <TableRow key={`audit-log-row-${rowIndex}`}>
                    <TableCell className="py-3 pl-5">
                      <Skeleton className="h-5 w-36" />
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-7 w-24 rounded-md" />
                        <Skeleton className="h-5 w-40" />
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-7 w-16 rounded-md" />
                        <Skeleton className="h-5 w-32" />
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-5 w-40" />
                    </TableCell>
                    <TableCell className="py-3">
                      <Skeleton className="h-5 w-28" />
                    </TableCell>
                    <TableCell className="py-3 pr-5">
                      <div className="flex justify-end">
                        <Skeleton className="h-9 w-9 rounded-md" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="px-1 py-1">
            <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-11 w-28 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
