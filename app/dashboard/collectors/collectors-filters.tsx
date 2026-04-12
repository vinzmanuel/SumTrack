"use client";

import { Search } from "lucide-react";
import {
  UI_CONTROL_CLASS_NAME,
  UI_FILTER_CONTROLS_CLASS_NAME,
  UI_FILTER_ROW_CLASS_NAME,
  UI_SEARCH_CONTAINER_CLASS_NAME,
  UI_SEARCH_ICON_CLASS_NAME,
  UI_SEARCH_INPUT_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <div className={UI_FILTER_ROW_CLASS_NAME}>
      <div className={UI_SEARCH_CONTAINER_CLASS_NAME}>
        <Search className={UI_SEARCH_ICON_CLASS_NAME} />
        <Input
          aria-label="Search collectors"
          className={UI_SEARCH_INPUT_CLASS_NAME}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search collector name or company ID"
          value={selectedFilters.searchQuery}
        />
      </div>

      <div className={UI_FILTER_CONTROLS_CLASS_NAME}>
        {canChooseBranch ? (
          <Select onValueChange={onBranchChange} value={selectedFilters.selectedBranchRaw || "all"}>
            <SelectTrigger aria-label={branchFilterLabel} className={`${UI_CONTROL_CLASS_NAME} w-full min-w-[190px] sm:w-[210px]`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{branchFilterLabel}</SelectLabel>
                {branchOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}

        <Button className={`${UI_CONTROL_CLASS_NAME} px-4`} onClick={onClear} type="button" variant="outline">
          Clear
        </Button>
      </div>
    </div>
  );
}
