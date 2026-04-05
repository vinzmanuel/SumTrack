import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function LoadingManageUserAccountsPage() {
  return (
    <div className="w-full max-w-none space-y-5 pb-6 pt-1 sm:pb-6 sm:pt-2">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="bg-gradient-to-r from-slate-50 via-background to-emerald-50/60 p-6 dark:from-zinc-950 dark:via-background dark:to-emerald-950/45">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1">
              <div className="space-y-1">
                <Skeleton className="h-9 w-72 max-w-full" />
                <Skeleton className="h-4 w-96 max-w-full" />
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-full" />
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="h-8 w-28 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>

        <div className="border-t border-border/70 px-6 pb-4 pt-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1 md:col-span-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-4 w-10" />
              <div className="flex items-end gap-3">
                <Skeleton className="h-9 flex-1 rounded-md" />
                <Skeleton className="h-9 w-16 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="w-full overflow-hidden border-border/70 shadow-sm">
        <CardContent className="p-0">
          <div className="px-5 pb-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-28 rounded-md" />
                  <Skeleton className="h-8 w-28 rounded-md" />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-9 w-20 rounded-md" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>

          <div>
            <div className="relative space-y-5">
              <div className="overflow-x-auto border-y border-border">
                <Table className="min-w-[1180px] text-sm">
                  <TableHeader>
                    <TableRow className="border-border/70 bg-[var(--app-table-header)]">
                      <TableHead className="h-auto py-3 pl-5">Full Name</TableHead>
                      <TableHead className="h-auto py-3">Company ID</TableHead>
                      <TableHead className="h-auto py-3">Role</TableHead>
                      <TableHead className="h-auto py-3">Branch / Scope</TableHead>
                      <TableHead className="h-auto py-3">Contact No.</TableHead>
                      <TableHead className="h-auto py-3">Email</TableHead>
                      <TableHead className="h-auto py-3">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from({ length: 5 }).map((_, rowIndex) => (
                      <TableRow key={`row-${rowIndex}`}>
                        <TableCell className="py-3 pl-5">
                          <Skeleton className="h-5 w-40" />
                        </TableCell>
                        <TableCell className="py-3">
                          <Skeleton className="h-6 w-24 rounded-full" />
                        </TableCell>
                        <TableCell className="py-3">
                          <Skeleton className="h-6 w-28 rounded-full" />
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="space-y-1">
                            <Skeleton className="h-5 w-36" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Skeleton className="h-5 w-28" />
                        </TableCell>
                        <TableCell className="py-3">
                          <Skeleton className="h-5 w-40" />
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <Skeleton className="h-9 w-16 rounded-md" />
                            <Skeleton className="h-9 w-14 rounded-md" />
                            <Skeleton className="h-9 w-24 rounded-md" />
                            <Skeleton className="h-9 w-16 rounded-md" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 px-5 pt-0 text-sm xl:flex-row xl:items-center xl:justify-between">
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
        </CardContent>
      </Card>
    </div>
  );
}
