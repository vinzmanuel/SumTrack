"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ManageUserAccountsTable } from "@/app/dashboard/manage-user-accounts/manage-user-accounts-table";
import type {
  ManagedCollectorReassignmentRequiredPayload,
  ManageUserAccountsPageData,
} from "@/app/dashboard/manage-user-accounts/types";

const MANAGE_USERS_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export function ManageUserAccountsResultsSection({
  data,
  errorMessage,
  isPending,
  onDeleted,
  onEdit,
  onPageChange,
  onPageSizeChange,
  onReassignmentRequired,
}: {
  data: ManageUserAccountsPageData;
  errorMessage: string | null;
  isPending: boolean;
  onDeleted: () => void;
  onEdit: (userId: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onReassignmentRequired: (
    blocked: ManagedCollectorReassignmentRequiredPayload,
    retryAction: () => Promise<void>,
  ) => void;
}) {
  const totalPages = Math.max(Math.ceil(data.totalCount / data.pageSize), 1);
  const safePage = Math.min(Math.max(data.page, 1), totalPages);
  const showingFrom = data.totalCount === 0 ? 0 : (safePage - 1) * data.pageSize + 1;
  const showingTo = data.totalCount === 0 ? 0 : Math.min(safePage * data.pageSize, data.totalCount);

  return (
    <div className="relative space-y-5">
      <ManageUserAccountsTable
        onDeleted={onDeleted}
        onEdit={onEdit}
        onReassignmentRequired={onReassignmentRequired}
        users={data.users}
      />
      <div className="flex flex-col gap-3 px-5 pt-0 text-sm xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-1">
          <p className="text-muted-foreground">
            Showing {showingFrom}-{showingTo} of {data.totalCount}
          </p>
          {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-center">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Rows</span>
            <Select
              onValueChange={(value) => onPageSizeChange(Number(value))}
              value={String(data.pageSize)}
            >
              <SelectTrigger className="w-[84px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MANAGE_USERS_PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-4 flex items-center gap-2">
            <span className="text-muted-foreground">
              Page {safePage} of {totalPages}
            </span>
            <Button
              disabled={isPending || safePage <= 1}
              onClick={() => onPageChange(safePage - 1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronLeft />
              <span className="sr-only">Previous page</span>
            </Button>
            <Button
              disabled={isPending || safePage >= totalPages}
              onClick={() => onPageChange(safePage + 1)}
              size="icon"
              type="button"
              variant="outline"
            >
              <ChevronRight />
              <span className="sr-only">Next page</span>
            </Button>
          </div>
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
