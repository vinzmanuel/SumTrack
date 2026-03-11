"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BorrowersTable } from "@/app/dashboard/borrowers/borrowers-table";
import type { BorrowersPageData } from "@/app/dashboard/borrowers/types";

type BorrowersResultsSectionProps = {
  data: BorrowersPageData;
  isPending: boolean;
  errorMessage: string | null;
  onPageChange: (page: number) => void;
};

export function BorrowersResultsSection({
  data,
  isPending,
  errorMessage,
  onPageChange,
}: BorrowersResultsSectionProps) {
  const totalPages = Math.max(Math.ceil(data.totalCount / data.pageSize), 1);
  const safePage = Math.min(Math.max(data.page, 1), totalPages);
  const showingFrom = data.totalCount === 0 ? 0 : (safePage - 1) * data.pageSize + 1;
  const showingTo = data.totalCount === 0 ? 0 : Math.min(safePage * data.pageSize, data.totalCount);

  return (
    <Card className="relative">
      <CardHeader>
        <CardTitle>Borrower Accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <BorrowersTable borrowers={data.borrowers} />
        <div className="flex flex-col gap-3 border-t pt-4 text-sm md:flex-row md:items-center md:justify-between">
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
              Updating borrower results...
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
