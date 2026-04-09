import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function ManageUserAccountsSkeleton({
  canChooseBranch = true,
  showAction = true,
}: {
  canChooseBranch?: boolean;
  showAction?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:w-[360px] xl:shrink-0">
          <Skeleton className="h-11 w-full rounded-md" />
        </div>

        <div className="flex w-full flex-wrap items-center gap-2.5 xl:w-auto xl:justify-end">
          {canChooseBranch ? <Skeleton className="h-11 w-full min-w-[180px] rounded-md sm:w-[190px]" /> : null}
          <Skeleton className="h-11 w-full min-w-[160px] rounded-md sm:w-[170px]" />
          <Skeleton className="h-11 w-full min-w-[160px] rounded-md sm:w-[170px]" />
          <Skeleton className="h-11 w-[84px] rounded-md" />
          {showAction ? <Skeleton className="h-11 w-[120px] rounded-md" /> : null}
        </div>
      </div>

      <div className="space-y-4">
        <div className="px-1 py-1">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />
        </div>

        <div className="space-y-5">
          <div className="relative">
            <div className="overflow-x-auto rounded-md border border-border/70 bg-card shadow-sm">
              <Table className="min-w-[1280px] text-sm">
                <TableHeader>
                  <TableRow className="border-border/70 bg-card">
                    <TableHead className="h-auto py-3 pl-5">Full Name</TableHead>
                    <TableHead className="h-auto py-3">Company ID</TableHead>
                    <TableHead className="h-auto py-3">Role</TableHead>
                    <TableHead className="h-auto py-3">Branch / Scope</TableHead>
                    <TableHead className="h-auto py-3">Contact No.</TableHead>
                    <TableHead className="h-auto py-3">Email</TableHead>
                    <TableHead className="h-auto py-3">Date Created</TableHead>
                    <TableHead className="h-auto py-3">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 6 }).map((_, rowIndex) => (
                    <TableRow key={`manage-user-row-${rowIndex}`}>
                      <TableCell className="py-3 pl-5">
                        <Skeleton className="h-5 w-44" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-7 w-24 rounded-md" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-7 w-28 rounded-md" />
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="space-y-1">
                          <Skeleton className="h-5 w-36" />
                          <Skeleton className="h-4 w-28" />
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-5 w-28" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-5 w-40" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-5 w-28" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-9 w-9 rounded-md" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="px-1 py-1">
            <div className="flex flex-col gap-3 text-sm xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="flex flex-wrap items-center gap-2 xl:justify-center">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-9 w-[84px] rounded-md" />
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
