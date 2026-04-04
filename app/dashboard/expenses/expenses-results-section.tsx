"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExpensesSummary } from "@/app/dashboard/expenses/expenses-summary";
import { ExpensesTable } from "@/app/dashboard/expenses/expenses-table";
import { EXPENSES_PAGE_SIZE_OPTIONS } from "@/app/dashboard/expenses/filters";
import type { ExpensesResultsData } from "@/app/dashboard/expenses/types";

type ExpensesResultsSectionProps = {
  data: ExpensesResultsData;
  errorMessage: string | null;
  isPending: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function ExpensesResultsSection({
  data,
  errorMessage,
  isPending,
  onPageChange,
  onPageSizeChange,
}: ExpensesResultsSectionProps) {
  const totalPages = Math.max(Math.ceil(data.totalExpenses / data.pageSize), 1);
  const safePage = Math.min(Math.max(data.page, 1), totalPages);
  const showingFrom = data.totalExpenses === 0 ? 0 : (safePage - 1) * data.pageSize + 1;
  const showingTo = data.totalExpenses === 0 ? 0 : Math.min(safePage * data.pageSize, data.totalExpenses);

  return (
    <div className="relative">
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="pb-2 pt-4">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">Expense Records</CardTitle>
            <p className="text-sm text-muted-foreground">Branch expense records that match the current filters.</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-3 pb-5 px-5">
          <ExpensesSummary totalAmount={data.totalAmount} totalExpenses={data.totalExpenses} />
          <ExpensesTable expenses={data.expenses} />
          <div className="flex flex-col gap-3 px-4 pt-1 text-sm xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-1">
              <p className="text-muted-foreground">
                Showing {showingFrom}-{showingTo} of {data.totalExpenses}
              </p>
              {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:justify-center">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Rows</span>
                <Select
                  disabled={isPending}
                  onValueChange={(value) => onPageSizeChange(Number(value))}
                  value={String(data.pageSize)}
                >
                  <SelectTrigger className="w-[84px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSES_PAGE_SIZE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="ml-4 flex items-center gap-2">
                <span className="text-muted-foreground">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  disabled={isPending || safePage <= 1}
                  onClick={() => onPageChange(safePage - 1)}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Previous page</span>
                </Button>
                <Button
                  disabled={isPending || safePage >= totalPages}
                  onClick={() => onPageChange(safePage + 1)}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Next page</span>
                </Button>
              </div>
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
