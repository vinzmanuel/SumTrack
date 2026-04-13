import type { ReactNode } from "react";
import { ManageUserAccountsResultsSection } from "@/app/dashboard/manage-user-accounts/manage-user-accounts-results-section";
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
}) {
  return (
    <div className="space-y-4">
      <div className="px-1 py-1">
        <div className="flex items-center gap-3">{controls}</div>
      </div>

      <ManageUserAccountsResultsSection
        data={data}
        errorMessage={errorMessage}
        isPending={isPending}
        onDeleted={onDeleted}
        onEdit={onEdit}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onReassignmentRequired={onReassignmentRequired}
        onSortChange={onSortChange}
        selectedSort={selectedSort}
      />
    </div>
  );
}
