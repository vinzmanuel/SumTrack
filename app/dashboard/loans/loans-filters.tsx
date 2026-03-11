"use client";

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
}: LoansFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-1 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="loanSearch">
            Search
          </label>
          <input
            className="border-input w-full rounded-md border px-3 py-2 text-sm"
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
              className="border-input w-full rounded-md border px-3 py-2 text-sm"
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
            className="border-input w-full rounded-md border px-3 py-2 text-sm"
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
      {isPending ? <p className="text-muted-foreground text-sm">Updating loan records...</p> : null}
    </div>
  );
}
