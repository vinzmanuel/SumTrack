"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import {
  AnalyticsDateRangeFilter,
  AnalyticsSelectFilter,
} from "@/components/analytics/analytics-filter-controls";
import { Input } from "@/components/ui/input";
import { COLLECTORS_DATE_RANGE_OPTIONS } from "@/app/dashboard/collectors/filters";
import type {
  CollectorsBranchOption,
  CollectorsFilterInput,
  CollectorsFilterState,
} from "@/app/dashboard/collectors/types";

export function CollectorsFilters({
  branchFilterLabel,
  branchOptions,
  canChooseBranch,
  onBranchChange,
  onRangeChange,
  onSearchChange,
  selectedFilters,
}: {
  branchFilterLabel: string;
  branchOptions: CollectorsBranchOption[];
  canChooseBranch: boolean;
  onBranchChange: (value: string) => void;
  onRangeChange: (value: { range: CollectorsFilterInput["range"]; from: string; to: string }) => void;
  onSearchChange: (value: string) => void;
  selectedFilters: CollectorsFilterState;
}) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <label className="grid gap-2 text-sm font-medium">
        Search
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search collector name or company ID"
            value={selectedFilters.searchQuery}
          />
        </div>
      </label>

      {canChooseBranch ? (
        <AnalyticsSelectFilter
          label={branchFilterLabel}
          onChange={(event) => onBranchChange(event.target.value)}
          options={branchOptions}
          value={selectedFilters.selectedBranchRaw || "all"}
        />
      ) : (
        <div />
      )}

      <AnalyticsDateRangeFilter
        from={selectedFilters.fromRaw}
        isOpen={isCustomOpen}
        label="Date Range"
        onFromChange={(value) =>
          onRangeChange({
            range: selectedFilters.selectedRange,
            from: value,
            to: selectedFilters.toRaw,
          })
        }
        onOpenChange={setIsCustomOpen}
        onRangeChange={(value) => {
          setIsCustomOpen(value === "custom");
          onRangeChange({
            range: value,
            from: selectedFilters.fromRaw,
            to: selectedFilters.toRaw,
          });
        }}
        onToChange={(value) =>
          onRangeChange({
            range: selectedFilters.selectedRange,
            from: selectedFilters.fromRaw,
            to: value,
          })
        }
        options={COLLECTORS_DATE_RANGE_OPTIONS}
        to={selectedFilters.toRaw}
        value={selectedFilters.selectedRange}
      />
    </div>
  );
}
