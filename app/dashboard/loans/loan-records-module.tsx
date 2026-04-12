import type { ReactNode } from "react";
import { LoansResultsSection } from "@/app/dashboard/loans/loans-results-section";
import type { StaffLoansPageData } from "@/app/dashboard/loans/types";

export function LoanRecordsModule({
  controls,
  data,
  errorMessage,
  isPending,
  onPageChange,
  onPageSizeChange,
  returnTo,
  detailSource,
}: {
  controls: ReactNode;
  data: StaffLoansPageData;
  errorMessage: string | null;
  isPending: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  returnTo: string;
  detailSource?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="px-1">
        {controls}
      </div>
      <div className="px-1">
        <LoansResultsSection
          data={data}
          embedded
          errorMessage={errorMessage}
          isPending={isPending}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          returnTo={returnTo}
          detailSource={detailSource}
        />
      </div>
    </div>
  );
}
