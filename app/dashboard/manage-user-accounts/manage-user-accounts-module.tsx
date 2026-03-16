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
        <div className="px-4 pb-3 pt-2 md:px-5 md:pb-4 md:pt-3">
          {controls}
          <div className="mt-3">
            <ManageUserAccountsSortControl onSortChange={onSortChange} selectedSort={selectedSort} />
          </div>
          {scopeMessage ? <p className="mt-2 text-sm text-muted-foreground">{scopeMessage}</p> : null}
        </div>
        <div className="border-t border-border/70 px-4 pb-4 pt-3 md:px-5 md:pb-5">
          <ManageUserAccountsResultsSection
            data={data}
            errorMessage={errorMessage}
            isPending={isPending}
            onDeleted={onDeleted}
            onEdit={onEdit}
            onPageChange={onPageChange}
            onReassignmentRequired={onReassignmentRequired}
          />
        </div>
      </CardContent>
    </Card>
  );
}
