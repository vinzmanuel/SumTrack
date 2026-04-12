"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { SegmentedStatusControl } from "@/app/dashboard/_components/segmented-status-control";
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
import {
  UI_CONTROL_CLASS_NAME,
  UI_FILTER_CONTROLS_CLASS_NAME,
  UI_FILTER_ROW_CLASS_NAME,
  UI_SEARCH_CONTAINER_CLASS_NAME,
  UI_SEARCH_ICON_CLASS_NAME,
  UI_SEARCH_INPUT_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";
import type { LoanBranchOption, LoanListTab, LoanStatusFilter } from "@/app/dashboard/loans/types";

type LoansFiltersProps = {
  canChooseBranchFilter: boolean;
  selectedBranchId: number | null;
  selectedTab?: LoanListTab;
  activeCount?: number;
  archivedCount?: number;
  selectedSearchQuery: string;
  branches: LoanBranchOption[];
  isPending: boolean;
  onBranchChange: (branchId: number | null) => void;
  onTabChange?: (tab: LoanListTab) => void;
  onSearchChange: (query: string) => void;
  selectedStatus?: LoanStatusFilter;
  onStatusChange?: (status: LoanStatusFilter) => void;
  onClear?: () => void;
  action?: ReactNode;
};

export function LoansFilters({
  canChooseBranchFilter,
  selectedBranchId,
  selectedTab,
  activeCount = 0,
  archivedCount = 0,
  selectedSearchQuery,
  branches,
  isPending,
  onBranchChange,
  onTabChange,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  onClear,
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
    <div className="space-y-3">
      <div className={UI_FILTER_ROW_CLASS_NAME}>
        <div className={UI_SEARCH_CONTAINER_CLASS_NAME}>
          <Search className={UI_SEARCH_ICON_CLASS_NAME} />
          <Input
            aria-label="Search loans"
            className={UI_SEARCH_INPUT_CLASS_NAME}
            id="loanSearch"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search loan code or borrower name"
            value={selectedSearchQuery}
          />
        </div>

        <div className={UI_FILTER_CONTROLS_CLASS_NAME}>
          {canChooseBranchFilter ? (
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
                  <SelectItem value="__all">All allowed branches</SelectItem>
                  {branches.map((item) => (
                    <SelectItem key={item.branch_id} value={String(item.branch_id)}>
                      {item.branch_name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}

          {onStatusChange ? (
            <Select
              onValueChange={(value) => onStatusChange(value as LoanStatusFilter)}
              value={selectedStatus ?? "all"}
            >
              <SelectTrigger aria-label="Status" className={`${UI_CONTROL_CLASS_NAME} w-full min-w-[190px] sm:w-[210px]`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Status</SelectLabel>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : null}

          {onClear ? (
            <Button className={`${UI_CONTROL_CLASS_NAME} px-4`} onClick={onClear} type="button" variant="outline">
              Clear
            </Button>
          ) : null}
          {action}
        </div>
      </div>

      {onTabChange ? (
        <SegmentedStatusControl
          onChange={onTabChange}
          options={[
            { value: "active", label: `Active (${activeCount})`, tone: "active" },
            { value: "archived", label: `Archived (${archivedCount})`, tone: "archived" },
          ]}
          selectedValue={selectedTab ?? "active"}
        />
      ) : null}

      {isPending ? <p className="text-muted-foreground text-sm">Updating loan records...</p> : null}
    </div>
  );
}
