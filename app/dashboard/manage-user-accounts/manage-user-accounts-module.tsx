import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ManageUserAccountsResultsSection } from "@/app/dashboard/manage-user-accounts/manage-user-accounts-results-section";
import type { ManageUserAccountsPageData } from "@/app/dashboard/manage-user-accounts/types";

export function ManageUserAccountsModule({
  controls,
  data,
  errorMessage,
  isPending,
  onDeleted,
  onEdit,
  onPageChange,
  scopeMessage,
}: {
  controls: ReactNode;
  data: ManageUserAccountsPageData;
  errorMessage: string | null;
  isPending: boolean;
  onDeleted: () => void;
  onEdit: (userId: string) => void;
  onPageChange: (page: number) => void;
  scopeMessage?: string;
}) {
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="p-0">
        <div className="px-4 pb-4 pt-2 md:px-5 md:pb-5 md:pt-3">
          {controls}
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
          />
        </div>
      </CardContent>
    </Card>
  );
}
