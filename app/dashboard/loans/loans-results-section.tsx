"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoansTable } from "@/app/dashboard/loans/loans-table";
import type { StaffLoansPageData } from "@/app/dashboard/loans/types";
import {
  UI_PAGINATION_CONTAINER_CLASS_NAME,
  UI_PAGINATION_TEXT_CLASS_NAME,
  UI_TABLE_AND_PAGINATION_STACK_CLASS_NAME,
  UI_TABLE_OVERLAY_CLASS_NAME,
  UI_TABLE_OVERLAY_TEXT_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";

const LOANS_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

type LoansResultsSectionProps = {
  data: StaffLoansPageData;
  isPending: boolean;
  errorMessage: string | null;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  returnTo: string;
  detailSource?: string;
  embedded?: boolean;
};

export function LoansResultsSection({
  data,
  isPending,
  errorMessage,
  onPageChange,
  onPageSizeChange,
  returnTo,
  detailSource,
  embedded = false,
}: LoansResultsSectionProps) {
  const totalPages = Math.max(Math.ceil(data.totalCount / data.pageSize), 1);
  const safePage = Math.min(Math.max(data.page, 1), totalPages);
  const showingFrom = data.totalCount === 0 ? 0 : (safePage - 1) * data.pageSize + 1;
  const showingTo = data.totalCount === 0 ? 0 : Math.min(safePage * data.pageSize, data.totalCount);

  return (
    <div className={`${UI_TABLE_AND_PAGINATION_STACK_CLASS_NAME} ${embedded ? "" : "pt-1"}`}>
      <div className="relative">
        <LoansTable loans={data.loans} returnTo={returnTo} source={detailSource} />
        {isPending ? (
          <div className={UI_TABLE_OVERLAY_CLASS_NAME}>
            <div className={UI_TABLE_OVERLAY_TEXT_CLASS_NAME}>
              Updating loan records...
            </div>
          </div>
        ) : null}
      </div>
      <div className={UI_PAGINATION_CONTAINER_CLASS_NAME}>
        <div className="flex flex-col gap-3 text-sm xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <p className={UI_PAGINATION_TEXT_CLASS_NAME}>
              Showing {showingFrom}-{showingTo} of {data.totalCount}
            </p>
            {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:justify-center">
            {onPageSizeChange ? (
              <div className="flex items-center gap-2">
                <span className={UI_PAGINATION_TEXT_CLASS_NAME}>Rows</span>
                <Select
                  onValueChange={(value) => onPageSizeChange(Number(value))}
                  value={String(data.pageSize)}
                >
                  <SelectTrigger className="w-[84px] rounded-md bg-white dark:bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Rows</SelectLabel>
                      {LOANS_PAGE_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option} value={String(option)}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="ml-4 flex items-center gap-2">
              <span className={UI_PAGINATION_TEXT_CLASS_NAME}>
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
      </div>
    </div>
  );
}
