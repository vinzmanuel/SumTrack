"use client";

import type { ReactNode } from "react";
import type { LoanBranchOption, LoanStatusFilter } from "@/app/dashboard/loans/types";

type LoansFiltersProps = {
  canChooseBranchFilter: boolean;
  selectedBranchId: number | null;
  selectedStatus: LoanStatusFilter;
  selectedSearchQuery: string;
  branches: LoanBranchOption[];
  isPending: boolean;
  onBranchChange: (branchId: number | null) => void;
  onStatusChange: (status: LoanStatusFilter) => void;
  onSearchChange: (query: string) => void;
  action?: ReactNode;
};

export function LoansFilters({
  canChooseBranchFilter,
  selectedBranchId,
  selectedStatus,
  selectedSearchQuery,
  branches,
  isPending,
  onBranchChange,
  onStatusChange,
  onSearchChange,
  action,
}: LoansFiltersProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className={`grid flex-1 gap-3 ${canChooseBranchFilter ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="loanSearch">
              Search
            </label>
            <input
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              id="loanSearch"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search loan code or borrower name"
              value={selectedSearchQuery}
            />
          </div>
          {canChooseBranchFilter ? (
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="branchId">
                Branch
              </label>
              <select
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
                id="branchId"
                onChange={(event) => onBranchChange(event.target.value ? Number(event.target.value) : null)}
                value={selectedBranchId ? String(selectedBranchId) : ""}
              >
                <option value="">All allowed branches</option>
                {branches.map((item) => (
                  <option key={item.branch_id} value={item.branch_id}>
                    {item.branch_name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="status">
              Status
            </label>
            <select
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              id="status"
              onChange={(event) => onStatusChange(event.target.value as LoanStatusFilter)}
              value={selectedStatus}
            >
              <option value="all">All statuses</option>
              <option value="Active">Active</option>
              <option value="Overdue">Overdue</option>
              <option value="Completed">Completed</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>

        {action ? <div className="shrink-0 xl:pb-px xl:self-end">{action}</div> : null}
      </div>

      {isPending ? <p className="text-muted-foreground text-sm">Updating loan records...</p> : null}
    </div>
  );
}
