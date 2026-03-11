"use client";

import { useState, type FormEvent } from "react";
import {
  AnalyticsDateRangeFilter,
  AnalyticsFilterBar,
  AnalyticsSelectFilter,
} from "@/components/analytics/analytics-filter-controls";
import { Button } from "@/components/ui/button";
import { DASHBOARD_DATE_RANGE_OPTIONS } from "@/app/dashboard/dashboard-chart-filters";
import type { DashboardChartData, DashboardChartFilterInput } from "@/app/dashboard/dashboard-chart-types";

export function DashboardChartFilters({
  data,
  isPending,
  onApply,
}: {
  data: DashboardChartData;
  isPending: boolean;
  onApply: (filters: DashboardChartFilterInput) => Promise<void>;
}) {
  const [selectedBranch, setSelectedBranch] = useState(data.filters.selectedBranchRaw);
  const [selectedRange, setSelectedRange] = useState(data.filters.selectedRange);
  const [fromValue, setFromValue] = useState(data.filters.fromRaw);
  const [toValue, setToValue] = useState(data.filters.toRaw);
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

  function handleRangeChange(value: DashboardChartFilterInput["range"]) {
    setSelectedRange(value);
    setIsCustomOpen(value === "custom");
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
            {data.canChooseBranch ? (
              <AnalyticsSelectFilter
                label={data.branchFilterLabel ?? "Branch"}
                onChange={(event) => setSelectedBranch(event.target.value)}
                options={data.branchOptions}
                value={selectedBranch}
              />
            ) : null}
            <AnalyticsDateRangeFilter
              from={fromValue}
              isOpen={isCustomOpen}
              label="Range"
              onFromChange={setFromValue}
              onOpenChange={setIsCustomOpen}
              onRangeChange={handleRangeChange}
              onToChange={setToValue}
              options={DASHBOARD_DATE_RANGE_OPTIONS}
              to={toValue}
              value={selectedRange}
            />
          </>
        }
      />
    </form>
  );
}
