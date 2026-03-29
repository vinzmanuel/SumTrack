"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-end gap-4">
        {canChooseBranch ? (
          <label className="w-full space-y-1 sm:w-[220px]">
            <Label htmlFor="branch">Branch</Label>
            <Select
              disabled={isPending}
              onValueChange={onBranchChange}
              value={selectedBranchRaw}
            >
              <SelectTrigger id="branch" className="w-full">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Branches</SelectLabel>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches.map((item) => (
                    <SelectItem key={item.branch_id} value={String(item.branch_id)}>
                      {item.branch_name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
        ) : null}

        <label className="w-full space-y-1 sm:w-[220px]">
          <Label htmlFor="month">Month</Label>
          <Input
            id="month"
            onChange={(event) => onMonthChange(event.target.value)}
            type="month"
            value={selectedMonthRaw}
          />
        </label>

        <label className="w-full space-y-1 sm:w-[220px]">
          <Label htmlFor="category">Category</Label>
          <Select
            disabled={isPending}
            onValueChange={onCategoryChange}
            value={selectedCategory}
          >
            <SelectTrigger id="category" className="w-full">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Categories</SelectLabel>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>

        <div className="flex items-end">
          <Button className="active:scale-[0.98]" onClick={onClear} size="sm" type="button" variant="outline">
            Clear
          </Button>
        </div>
      </div>

      {isPending ? <p className="text-muted-foreground text-sm">Updating expense records...</p> : null}
    </div>
  );
}
