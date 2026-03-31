"use client";

import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CollectorsBranchOption, CollectorsFilterState } from "@/app/dashboard/collectors/types";

export function CollectorsFilters({
  branchFilterLabel,
  branchOptions,
  canChooseBranch,
  onBranchChange,
  onClear,
  onSearchChange,
  selectedFilters,
}: {
  branchFilterLabel: string;
  branchOptions: CollectorsBranchOption[];
  canChooseBranch: boolean;
  onBranchChange: (value: string) => void;
  onClear: () => void;
  onSearchChange: (value: string) => void;
  selectedFilters: CollectorsFilterState;
}) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <label className="flex min-w-0 flex-col gap-1 xl:w-1/2">
        <Label>Search</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search collector name or company ID"
            value={selectedFilters.searchQuery}
          />
        </div>
      </label>

      <div className="flex flex-wrap items-end gap-3 xl:flex-1 xl:justify-end">
        {canChooseBranch ? (
          <label className="flex w-full flex-col gap-1 sm:w-55 xl:min-w-60 xl:flex-1">
            <Label>{branchFilterLabel}</Label>
            <Select onValueChange={onBranchChange} value={selectedFilters.selectedBranchRaw || "all"}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branchOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : null}

        <Button className="h-9 px-4" onClick={onClear} type="button" variant="outline">
          Clear
        </Button>
      </div>
    </div>
  );
}
