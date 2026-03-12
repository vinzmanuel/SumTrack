"use client";

import type { ReactNode } from "react";
import type { BorrowerAreaOption, BorrowerBranchOption } from "@/app/dashboard/borrowers/types";

type BorrowersFiltersProps = {
  canChooseBranch: boolean;
  selectedBranchId: number | null;
  selectedAreaId: number | null;
  selectedSearchQuery: string;
  branches: BorrowerBranchOption[];
  areas: BorrowerAreaOption[];
  allBranchLabel?: string;
  isPending: boolean;
  onBranchChange: (branchId: number | null) => void;
  onAreaChange: (areaId: number | null) => void;
  onSearchChange: (query: string) => void;
  onClear: () => void;
  action?: ReactNode;
};

export function BorrowersFilters({
  canChooseBranch,
  selectedBranchId,
  selectedAreaId,
  selectedSearchQuery,
  branches,
  areas,
  allBranchLabel = "All branches",
  isPending,
  onBranchChange,
  onAreaChange,
  onSearchChange,
  onClear,
  action,
}: BorrowersFiltersProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className={`grid flex-1 gap-3 ${canChooseBranch ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="borrowerSearch">
              Search
            </label>
            <input
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              id="borrowerSearch"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search borrower name or company ID"
              value={selectedSearchQuery}
            />
          </div>

          {canChooseBranch ? (
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
                <option value="">{allBranchLabel}</option>
                {branches.map((item) => (
                  <option key={item.branch_id} value={String(item.branch_id)}>
                    {item.branch_name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="areaId">
              Area
            </label>
            <select
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              id="areaId"
              onChange={(event) => onAreaChange(event.target.value ? Number(event.target.value) : null)}
              value={selectedAreaId ? String(selectedAreaId) : ""}
            >
              <option value="">All areas</option>
              {areas.map((item) => (
                <option key={item.area_id} value={String(item.area_id)}>
                  {item.area_code}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-end gap-2 xl:self-end">
          <button
            className="border-input hover:bg-accent hover:text-accent-foreground rounded-md border px-3 py-2 text-sm"
            onClick={onClear}
            type="button"
          >
            Clear
          </button>
          {action}
        </div>
      </div>

      {isPending ? <p className="text-muted-foreground text-sm">Updating borrower results...</p> : null}
    </div>
  );
}
