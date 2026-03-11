"use client";

import { useState, type FormEvent } from "react";
import {
  AnalyticsDateRangeFilter,
  AnalyticsFilterBar,
  AnalyticsSelectFilter,
} from "@/components/analytics/analytics-filter-controls";
import { Button } from "@/components/ui/button";
import { COLLECTIONS_DATE_RANGE_OPTIONS } from "@/app/dashboard/collections/filters";
import type {
  CollectionsBranchOption,
  CollectionsFilterInput,
  CollectionsFilterState,
} from "@/app/dashboard/collections/types";

export function CollectionsFilters({
  branchFilterLabel,
  branchOptions,
  canChooseBranch,
  initialFilters,
  isPending,
  onApply,
}: {
  branchFilterLabel: string;
  branchOptions: CollectionsBranchOption[];
  canChooseBranch: boolean;
  initialFilters: CollectionsFilterState;
  isPending: boolean;
  onApply: (filters: CollectionsFilterInput) => Promise<void>;
}) {
  const [selectedBranch, setSelectedBranch] = useState(
    initialFilters.selectedBranchRaw || "all",
  );
  const [selectedRange, setSelectedRange] = useState(initialFilters.selectedRange);
  const [fromValue, setFromValue] = useState(initialFilters.fromRaw);
  const [toValue, setToValue] = useState(initialFilters.toRaw);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const isApplyDisabled = isPending || (selectedRange === "custom" && (!fromValue || !toValue));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onApply({
      branch: selectedBranch,
      range: selectedRange,
      from: fromValue,
      to: toValue,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <AnalyticsFilterBar
        action={
          <Button
            className="bg-foreground text-background hover:bg-foreground/90"
            disabled={isApplyDisabled}
            type="submit"
          >
            {isPending ? "Applying..." : "Apply"}
          </Button>
        }
        controls={
          <>
            {canChooseBranch ? (
              <AnalyticsSelectFilter
                label={branchFilterLabel}
                onChange={(event) => setSelectedBranch(event.target.value)}
                options={branchOptions}
                value={selectedBranch}
              />
            ) : null}
            <AnalyticsDateRangeFilter
              from={fromValue}
              isOpen={isCustomOpen}
              label="Date Range"
              onFromChange={setFromValue}
              onOpenChange={setIsCustomOpen}
              onRangeChange={(value) => {
                setSelectedRange(value);
                setIsCustomOpen(value === "custom");
              }}
              onToChange={setToValue}
              options={COLLECTIONS_DATE_RANGE_OPTIONS}
              to={toValue}
              value={selectedRange}
            />
          </>
        }
      />
    </form>
  );
}
