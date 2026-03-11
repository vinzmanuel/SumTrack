"use client";

import { Button } from "@/components/ui/button";
import type { ExpenseBranchOption } from "@/app/dashboard/expenses/types";

type ExpensesFiltersProps = {
  canChooseBranch: boolean;
  isPending: boolean;
  selectedBranchRaw: string;
  selectedMonthRaw: string;
  selectedCategory: string;
  branches: ExpenseBranchOption[];
  categories: readonly string[];
  onBranchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onClear: () => void;
  onMonthChange: (value: string) => void;
};

export function ExpensesFilters({
  canChooseBranch,
  isPending,
  selectedBranchRaw,
  selectedMonthRaw,
  selectedCategory,
  branches,
  categories,
  onBranchChange,
  onCategoryChange,
  onClear,
  onMonthChange,
}: ExpensesFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-4">
        {canChooseBranch ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="branch">
              Branch
            </label>
            <select
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              id="branch"
              onChange={(event) => onBranchChange(event.target.value)}
              value={selectedBranchRaw}
            >
              <option value="all">All branches</option>
              {branches.map((item) => (
                <option key={item.branch_id} value={String(item.branch_id)}>
                  {item.branch_name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="month">
            Month
          </label>
          <input
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            id="month"
            onChange={(event) => onMonthChange(event.target.value)}
            type="month"
            value={selectedMonthRaw}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="category">
            Category
          </label>
          <select
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            id="category"
            onChange={(event) => onCategoryChange(event.target.value)}
            value={selectedCategory}
          >
            <option value="all">All categories</option>
            {categories.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <Button className="active:scale-[0.98]" onClick={onClear} type="button" variant="outline">
            Clear
          </Button>
        </div>
      </div>
      {isPending ? <p className="text-muted-foreground text-sm">Updating expense records...</p> : null}
    </div>
  );
}
