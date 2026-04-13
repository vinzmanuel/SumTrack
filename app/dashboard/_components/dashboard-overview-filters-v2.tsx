"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DASHBOARD_DATE_RANGE_OPTIONS } from "@/app/dashboard/dashboard-chart-filters";
import type { DashboardChartFilterInput } from "@/app/dashboard/dashboard-chart-types";

type DashboardOverviewFiltersProps = {
  canChooseBranch: boolean;
  branchFilterLabel: string | null;
  branchOptions: Array<{ value: string; label: string }>;
  initialFilters: DashboardChartFilterInput;
};

const RANGE_OPTIONS = DASHBOARD_DATE_RANGE_OPTIONS.filter((option) => option.value !== "custom");
type DashboardRangeValue = (typeof RANGE_OPTIONS)[number]["value"];

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
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [selectedBranch, setSelectedBranch] = useState(initialFilters.branch);
  const [selectedRange, setSelectedRange] = useState<DashboardRangeValue>(
    initialFilters.range === "custom" ? "last-30-days" : initialFilters.range,
  );
  const handleRangeChange = (value: string) => {
    setSelectedRange(value as DashboardRangeValue);
  };

  const serializedTargetQuery = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());

    params.set("range", selectedRange);
    params.delete("from");
    params.delete("to");

    if (canChooseBranch) {
      if (selectedBranch && selectedBranch !== "all") {
        params.set("branch", selectedBranch);
      } else {
        params.delete("branch");
      }
    } else {
      params.delete("branch");
    }

    return params.toString();
  }, [canChooseBranch, searchParams, selectedBranch, selectedRange]);

  useEffect(() => {
    if (!isHydrated) {
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
  }, [isHydrated, pathname, router, searchParams, serializedTargetQuery, startTransition]);

  return (
    <div className="space-y-2">
      {isPending ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-40 bg-background/20 backdrop-blur-[1.5px]"
        >
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_0,transparent_8px,rgba(0,0,0,0.03)_8px,rgba(0,0,0,0.03)_9px,transparent_9px)] dark:bg-[linear-gradient(45deg,transparent_0,transparent_8px,rgba(255,255,255,0.04)_8px,rgba(255,255,255,0.04)_9px,transparent_9px)]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-md border border-border bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              Updating dashboard...
            </div>
          </div>
        </div>
      ) : null}
      <div className={canChooseBranch ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
        {!isHydrated ? (
          <>
            {canChooseBranch ? (
              <div
                aria-hidden="true"
                className="!h-11 w-full rounded-md border border-border/70 bg-muted/30 dark:bg-muted/20"
              />
            ) : null}
            <div
              aria-hidden="true"
              className="!h-11 w-full rounded-md border border-border/70 bg-muted/30 dark:bg-muted/20"
            />
          </>
        ) : (
          <>
            {canChooseBranch ? (
              <Select onValueChange={setSelectedBranch} value={selectedBranch}>
                <SelectTrigger className="!h-11 w-full rounded-md">
                  <SelectValue placeholder={branchFilterLabel ?? "Branch"} />
                </SelectTrigger>
                <SelectContent className="rounded-md">
                  {branchOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            <Select onValueChange={handleRangeChange} value={selectedRange}>
              <SelectTrigger className="!h-11 w-full rounded-md">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent className="rounded-md">
                {RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
    </div>
  );
}
