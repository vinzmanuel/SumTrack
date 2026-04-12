"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
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
import type { BorrowerAreaOption, BorrowerBranchOption } from "@/app/dashboard/borrowers/types";
import {
  UI_CONTROL_CLASS_NAME,
  UI_FILTER_CONTROLS_CLASS_NAME,
  UI_FILTER_ROW_CLASS_NAME,
  UI_SEARCH_CONTAINER_CLASS_NAME,
  UI_SEARCH_ICON_CLASS_NAME,
  UI_SEARCH_INPUT_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";

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
    <div className="space-y-3">
      <div className={UI_FILTER_ROW_CLASS_NAME}>
        <div className={UI_SEARCH_CONTAINER_CLASS_NAME}>
          <Search className={UI_SEARCH_ICON_CLASS_NAME} />
          <Input
            aria-label="Search borrowers"
            className={UI_SEARCH_INPUT_CLASS_NAME}
            id="borrowerSearch"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search borrower name or company ID"
            value={selectedSearchQuery}
          />
        </div>

        <div className={UI_FILTER_CONTROLS_CLASS_NAME}>
          {canChooseBranch ? (
            <Select
              onValueChange={(value) => onBranchChange(value === "__all" ? null : Number(value))}
              value={selectedBranchId ? String(selectedBranchId) : "__all"}
            >
              <SelectTrigger aria-label="Branch" className={`${UI_CONTROL_CLASS_NAME} w-full min-w-[190px] sm:w-[210px]`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Branch</SelectLabel>
                  <SelectItem value="__all">{allBranchLabel}</SelectItem>
                  {branches.map((item) => (
                    <SelectItem key={item.branch_id} value={String(item.branch_id)}>
                      {item.branch_name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}

          <Select
            onValueChange={(value) => onAreaChange(value === "__all" ? null : Number(value))}
            value={selectedAreaId ? String(selectedAreaId) : "__all"}
          >
            <SelectTrigger aria-label="Area" className={`${UI_CONTROL_CLASS_NAME} w-full min-w-[170px] sm:w-[190px]`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Area</SelectLabel>
                <SelectItem value="__all">All areas</SelectItem>
                {areas.map((item) => (
                  <SelectItem key={item.area_id} value={String(item.area_id)}>
                    {item.area_code}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button className={`${UI_CONTROL_CLASS_NAME} px-4`} onClick={onClear} type="button" variant="outline">
            Clear
          </Button>
          {action}
        </div>
      </div>

      {isPending ? <p className="text-muted-foreground text-sm">Updating borrower results...</p> : null}
    </div>
  );
}
