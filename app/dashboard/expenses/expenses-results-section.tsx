"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpensesSummary } from "@/app/dashboard/expenses/expenses-summary";
import { ExpensesTable } from "@/app/dashboard/expenses/expenses-table";
import type { ExpensesResultsData } from "@/app/dashboard/expenses/types";

type ExpensesResultsSectionProps = {
  data: ExpensesResultsData;
  errorMessage: string | null;
  isPending: boolean;
  onPageChange: (page: number) => void;
};

export function ExpensesResultsSection({
  data,
  errorMessage,
  isPending,
  onPageChange,
}: ExpensesResultsSectionProps) {
  const totalPages = Math.max(Math.ceil(data.totalExpenses / data.pageSize), 1);
  const safePage = Math.min(Math.max(data.page, 1), totalPages);
  const showingFrom = data.totalExpenses === 0 ? 0 : (safePage - 1) * data.pageSize + 1;
  const showingTo = data.totalExpenses === 0 ? 0 : Math.min(safePage * data.pageSize, data.totalExpenses);

  return (
    <div className="relative space-y-6">
      <ExpensesSummary totalAmount={data.totalAmount} totalExpenses={data.totalExpenses} />

      <Card>
        <CardHeader>
          <CardTitle>Expense Records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ExpensesTable expenses={data.expenses} />
          <div className="flex flex-col gap-3 border-t pt-4 text-sm md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="text-muted-foreground">
                Showing {showingFrom}-{showingTo} of {data.totalExpenses}
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
        </CardContent>
      </Card>

      {isPending ? (
        <div className="bg-background/65 absolute inset-0 flex items-center justify-center rounded-xl backdrop-blur-[1px]">
          <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
            Updating expense records...
          </div>
        </div>
      ) : null}
    </div>
  );
}
