import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ManageUserAccountsResultsSection } from "@/app/dashboard/manage-user-accounts/manage-user-accounts-results-section";
import { ManageUserAccountsSortControl } from "@/app/dashboard/manage-user-accounts/manage-user-accounts-sort-control";
import type {
  ManagedCollectorReassignmentRequiredPayload,
  ManageUserAccountsSort,
  ManageUserAccountsPageData,
} from "@/app/dashboard/manage-user-accounts/types";

export function ManageUserAccountsModule({
  controls,
  data,
  errorMessage,
  isPending,
  onDeleted,
  onEdit,
  onPageChange,
  onPageSizeChange,
  onReassignmentRequired,
  onSortChange,
  selectedSort,
  scopeMessage,
}: {
  controls: ReactNode;
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
  onSortChange: (sort: ManageUserAccountsSort) => void;
  selectedSort: ManageUserAccountsSort;
  scopeMessage?: string;
}) {
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="p-0">
        <div className="px-5 pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {controls}
            </div>
            <ManageUserAccountsSortControl onSortChange={onSortChange} selectedSort={selectedSort} />
          </div>
          {scopeMessage ? <p className="mt-3 text-sm text-muted-foreground">{scopeMessage}</p> : null}
        </div>
        <div className="">
          <ManageUserAccountsResultsSection
            data={data}
            errorMessage={errorMessage}
            isPending={isPending}
            onDeleted={onDeleted}
            onEdit={onEdit}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            onReassignmentRequired={onReassignmentRequired}
          />
        </div>
      </CardContent>
    </Card>
  );
}
