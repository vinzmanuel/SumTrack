"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  UI_CONTROL_CLASS_NAME,
  UI_PAGINATION_CONTAINER_CLASS_NAME,
  UI_PAGINATION_TEXT_CLASS_NAME,
  UI_TABLE_AND_PAGINATION_STACK_CLASS_NAME,
  UI_TABLE_OVERLAY_CLASS_NAME,
  UI_TABLE_OVERLAY_TEXT_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <div className={UI_TABLE_AND_PAGINATION_STACK_CLASS_NAME}>
      <div className="relative">
        <ExpensesTable expenses={data.expenses} />

        {isPending ? (
          <div className={UI_TABLE_OVERLAY_CLASS_NAME}>
            <div className={UI_TABLE_OVERLAY_TEXT_CLASS_NAME}>Updating expense records...</div>
          </div>
        ) : null}
      </div>

      <div className={UI_PAGINATION_CONTAINER_CLASS_NAME}>
        <div className="flex flex-col gap-3 text-sm xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <p className={UI_PAGINATION_TEXT_CLASS_NAME}>
              Showing {showingFrom}-{showingTo} of {data.totalExpenses}
            </p>
            {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-center">
            <div className="flex items-center gap-2">
              <span className={UI_PAGINATION_TEXT_CLASS_NAME}>Rows</span>
              <Select
                disabled={isPending}
                onValueChange={(value) => onPageSizeChange(Number(value))}
                value={String(data.pageSize)}
              >
                <SelectTrigger className={`${UI_CONTROL_CLASS_NAME} w-[84px]`}>
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
              <span className={UI_PAGINATION_TEXT_CLASS_NAME}>
                Page {safePage} of {totalPages}
              </span>
              <Button
                className="h-11 w-11 rounded-md"
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
                className="h-11 w-11 rounded-md"
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
      </div>
    </div>
  );
}
