"use client";

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
}: BorrowersFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2 md:col-span-3">
          <label className="text-sm font-medium" htmlFor="borrowerSearch">
            Search
          </label>
          <input
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            id="borrowerSearch"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search borrower name or company ID"
            value={selectedSearchQuery}
          />
        </div>

        {canChooseBranch ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="branchId">
              Branch
            </label>
            <select
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
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

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="areaId">
            Area
          </label>
          <select
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
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

        <div className="flex items-end gap-2 md:col-span-3">
          <button
            className="border-input hover:bg-accent hover:text-accent-foreground rounded-md border px-3 py-2 text-sm"
            onClick={onClear}
            type="button"
          >
            Clear
          </button>
        </div>
      </div>
      {isPending ? <p className="text-muted-foreground text-sm">Updating borrower results...</p> : null}
    </div>
  );
}
