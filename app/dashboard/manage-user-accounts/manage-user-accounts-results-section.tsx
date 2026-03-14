"use client";

import { Button } from "@/components/ui/button";
import { ManageUserAccountsTable } from "@/app/dashboard/manage-user-accounts/manage-user-accounts-table";
import type { ManageUserAccountsPageData } from "@/app/dashboard/manage-user-accounts/types";

export function ManageUserAccountsResultsSection({
  data,
  errorMessage,
  isPending,
  onDeleted,
  onEdit,
  onPageChange,
}: {
  data: ManageUserAccountsPageData;
  errorMessage: string | null;
  isPending: boolean;
  onDeleted: () => void;
  onEdit: (userId: string) => void;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(Math.ceil(data.totalCount / data.pageSize), 1);
  const safePage = Math.min(Math.max(data.page, 1), totalPages);
  const showingFrom = data.totalCount === 0 ? 0 : (safePage - 1) * data.pageSize + 1;
  const showingTo = data.totalCount === 0 ? 0 : Math.min(safePage * data.pageSize, data.totalCount);

  return (
    <div className="relative space-y-3">
      <ManageUserAccountsTable onDeleted={onDeleted} onEdit={onEdit} users={data.users} />
      <div className="flex flex-col gap-3 border-t pt-3 text-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-muted-foreground">
            Showing {showingFrom}-{showingTo} of {data.totalCount}
          </p>
          {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            Page {safePage} of {totalPages}
          </span>
          <Button
            disabled={isPending || safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            Previous
          </Button>
          <Button
            disabled={isPending || safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            size="sm"
            type="button"
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>
      {isPending ? (
        <div className="bg-background/65 absolute inset-0 flex items-center justify-center rounded-xl backdrop-blur-[1px]">
          <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
            Updating user accounts...
          </div>
        </div>
      ) : null}
    </div>
  );
}
