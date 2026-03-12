import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LoansResultsSection } from "@/app/dashboard/loans/loans-results-section";
import type { StaffLoansPageData } from "@/app/dashboard/loans/types";

export function LoanRecordsModule({
  controls,
  data,
  errorMessage,
  isPending,
  onPageChange,
}: {
  controls: ReactNode;
  data: StaffLoansPageData;
  errorMessage: string | null;
  isPending: boolean;
  onPageChange: (page: number) => void;
}) {
  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="p-0">
        <div className="px-4 pb-4 md:px-5 md:pb-5 md:pt-1">
          {controls}
        </div>
        <div className="border-t border-border/70 px-4 pb-4 pt-1 md:px-5 md:pb-5">
          <LoansResultsSection
            data={data}
            embedded
            errorMessage={errorMessage}
            isPending={isPending}
            onPageChange={onPageChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
