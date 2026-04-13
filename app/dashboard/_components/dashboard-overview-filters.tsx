"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AnalyticsDateRangeFilter,
  AnalyticsFilterBar,
  AnalyticsSelectFilter,
} from "@/components/analytics/analytics-filter-controls";
import { DASHBOARD_DATE_RANGE_OPTIONS } from "@/app/dashboard/dashboard-chart-filters";
import type { DashboardChartFilterInput } from "@/app/dashboard/dashboard-chart-types";

type DashboardOverviewFiltersProps = {
  canChooseBranch: boolean;
  branchFilterLabel: string | null;
  branchOptions: Array<{ value: string; label: string }>;
  initialFilters: DashboardChartFilterInput;
};

export function DashboardOverviewFilters({
  canChooseBranch,
  branchFilterLabel,
  branchOptions,
  initialFilters,
}: DashboardOverviewFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [selectedBranch, setSelectedBranch] = useState(initialFilters.branch);
  const [selectedRange, setSelectedRange] = useState(initialFilters.range);
  const [fromValue, setFromValue] = useState(initialFilters.from);
  const [toValue, setToValue] = useState(initialFilters.to);
  const [isCustomOpen, setIsCustomOpen] = useState(initialFilters.range === "custom");

  const serializedTargetQuery = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());

    params.set("range", selectedRange);

    if (canChooseBranch) {
      if (selectedBranch && selectedBranch !== "all") {
        params.set("branch", selectedBranch);
      } else {
        params.delete("branch");
      }
    } else {
      params.delete("branch");
    }

    if (selectedRange === "custom") {
      if (!fromValue || !toValue) {
        return null;
      }
      params.set("from", fromValue);
      params.set("to", toValue);
    } else {
      params.delete("from");
      params.delete("to");
    }

    return params.toString();
  }, [canChooseBranch, fromValue, searchParams, selectedBranch, selectedRange, toValue]);

  useEffect(() => {
    if (serializedTargetQuery === null) {
      return;
    }

    const currentQuery = searchParams.toString();
    if (serializedTargetQuery === currentQuery) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      startTransition(() => {
        router.replace(
          serializedTargetQuery ? `${pathname}?${serializedTargetQuery}` : pathname,
          { scroll: false },
        );
      });
    }, 380);

    return () => window.clearTimeout(timeoutId);
  }, [pathname, router, searchParams, serializedTargetQuery]);

  return (
    <div className="space-y-2">
      <AnalyticsFilterBar
        action={
          isPending ? (
            <p className="text-xs font-medium text-muted-foreground">Updating dashboard…</p>
          ) : null
        }
        controls={
          <>
            {canChooseBranch ? (
              <AnalyticsSelectFilter
                label={branchFilterLabel ?? "Branch"}
                onChange={(event) => setSelectedBranch(event.target.value)}
                options={branchOptions}
                value={selectedBranch}
              />
            ) : null}
            <AnalyticsDateRangeFilter
              from={fromValue}
              isOpen={isCustomOpen}
              label="Range"
              onFromChange={setFromValue}
              onOpenChange={setIsCustomOpen}
              onRangeChange={(value) => {
                setSelectedRange(value);
                setIsCustomOpen(value === "custom");
              }}
              onToChange={setToValue}
              options={DASHBOARD_DATE_RANGE_OPTIONS}
              to={toValue}
              value={selectedRange}
            />
          </>
        }
      />
    </div>
  );
}
