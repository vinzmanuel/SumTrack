"use client";

import type { ReactNode } from "react";
import { SegmentedStatusControl } from "@/app/dashboard/_components/segmented-status-control";
import type { LoanBranchOption, LoanListTab, LoanStatusFilter } from "@/app/dashboard/loans/types";

type LoansFiltersProps = {
  canChooseBranchFilter: boolean;
  selectedBranchId: number | null;
  selectedTab?: LoanListTab;
  selectedSearchQuery: string;
  branches: LoanBranchOption[];
  isPending: boolean;
  onBranchChange: (branchId: number | null) => void;
  onTabChange?: (tab: LoanListTab) => void;
  onSearchChange: (query: string) => void;
  selectedStatus?: LoanStatusFilter;
  onStatusChange?: (status: LoanStatusFilter) => void;
  action?: ReactNode;
};

export function LoansFilters({
  canChooseBranchFilter,
  selectedBranchId,
  selectedTab,
  selectedSearchQuery,
  branches,
  isPending,
  onBranchChange,
  onTabChange,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  action,
}: LoansFiltersProps) {
  const statusOptions =
    selectedTab === "archived"
      ? [
          { value: "all", label: "All archived statuses" },
          { value: "Archived", label: "Archived" },
          { value: "Abandoned", label: "Abandoned" },
        ]
      : [
          { value: "all", label: "All active statuses" },
          { value: "Active", label: "Active" },
          { value: "Overdue", label: "Overdue" },
          { value: "Completed", label: "Completed" },
        ];

  return (
    <div className="space-y-2.5">
      {onTabChange ? (
        <SegmentedStatusControl
          onChange={onTabChange}
          options={[
            { value: "active", label: "Active", tone: "active" },
            { value: "archived", label: "Archived", tone: "archived" },
          ]}
          selectedValue={selectedTab ?? "active"}
        />
      ) : null}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div
          className={`grid flex-1 gap-3 ${
            canChooseBranchFilter && onStatusChange
              ? "md:grid-cols-4"
              : canChooseBranchFilter
                ? "md:grid-cols-3"
                : onStatusChange
                  ? "md:grid-cols-3"
                  : "md:grid-cols-2"
          }`}
        >
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
          {onStatusChange ? (
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="loanStatus">
                Status
              </label>
              <select
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
                id="loanStatus"
                onChange={(event) => onStatusChange(event.target.value as LoanStatusFilter)}
                value={selectedStatus ?? "all"}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {action ? <div className="shrink-0 xl:pb-px xl:self-end">{action}</div> : null}
      </div>

      {isPending ? <p className="text-muted-foreground text-sm">Updating loan records...</p> : null}
    </div>
  );
}
