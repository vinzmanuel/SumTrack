import type { ReactNode } from "react";
import { BorrowersResultsSection } from "@/app/dashboard/borrowers/borrowers-results-section";
import type { BorrowersPageData } from "@/app/dashboard/borrowers/types";

export function BorrowerRecordsModule({
  controls,
  data,
  errorMessage,
  isPending,
  onPageChange,
  onPageSizeChange,
  scopeMessage,
}: {
  controls: ReactNode;
  data: BorrowersPageData;
  errorMessage: string | null;
  isPending: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  scopeMessage?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="px-1">
        {controls}
        {scopeMessage ? <p className="mt-3 text-sm text-muted-foreground">{scopeMessage}</p> : null}
      </div>
      <div className="px-1">
        <BorrowersResultsSection
          data={data}
          embedded
          errorMessage={errorMessage}
          isPending={isPending}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
    </div>
  );
}
