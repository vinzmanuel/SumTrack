import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BorrowersResultsSection } from "@/app/dashboard/borrowers/borrowers-results-section";
import type { BorrowersPageData } from "@/app/dashboard/borrowers/types";

export function BorrowerRecordsModule({
  controls,
  data,
  errorMessage,
  isPending,
  onPageChange,
  scopeMessage,
}: {
  controls: ReactNode;
  data: BorrowersPageData;
  errorMessage: string | null;
  isPending: boolean;
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
          <BorrowersResultsSection
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
