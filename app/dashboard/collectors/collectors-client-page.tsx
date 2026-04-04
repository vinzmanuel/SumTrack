"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { CollectorsFilters } from "@/app/dashboard/collectors/collectors-filters";
import {
  resolveCollectorsPeriodTriggerLabel,
  supportsAverageMonthlyCollectionsSelection,
  supportsIncentivesSelection,
} from "@/app/dashboard/collectors/filters";
import { CollectorsResultsSection } from "@/app/dashboard/collectors/collectors-results-section";
import type {
  CollectorsAnalyticsData,
  CollectorsBranchOption,
  CollectorsFilterInput,
  CollectorsFilterState,
} from "@/app/dashboard/collectors/types";

function buildPageUrl(filters: CollectorsFilterInput) {
  const params = new URLSearchParams();

  if (filters.branch && filters.branch !== "all") {
    params.set("branch", filters.branch);
  }
  if (filters.range !== "this-month") {
    params.set("range", filters.range);
  }
  if (filters.range === "custom") {
    if (filters.from) {
      params.set("from", filters.from);
    }
    if (filters.to) {
      params.set("to", filters.to);
    }
  }
  if (filters.query.trim()) {
    params.set("query", filters.query.trim());
  }
  if (filters.basis !== "average-monthly-collections") {
    params.set("basis", filters.basis);
  }
  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }
  if (filters.pageSize !== 10) {
    params.set("pageSize", String(filters.pageSize));
  }

  const queryString = params.toString();
  return queryString ? `/dashboard/collectors?${queryString}` : "/dashboard/collectors";
}

function buildDataUrl(filters: CollectorsFilterInput) {
  const params = new URLSearchParams();
  if (filters.branch && filters.branch !== "all") {
    params.set("branch", filters.branch);
  }
  params.set("range", filters.range);
  if (filters.range === "custom") {
    if (filters.from) {
      params.set("from", filters.from);
    }
    if (filters.to) {
      params.set("to", filters.to);
    }
  }
  if (filters.query.trim()) {
    params.set("query", filters.query.trim());
  }
  params.set("basis", filters.basis);
  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }
  params.set("pageSize", String(filters.pageSize));
  return `/dashboard/collectors/data?${params.toString()}`;
}

export function CollectorsClientPage({
  branchFilterLabel,
  branchOptions,
  canChooseBranch,
  fixedBranchName,
  initialData,
  initialFilters,
}: {
  branchFilterLabel: string;
  branchOptions: CollectorsBranchOption[];
  canChooseBranch: boolean;
  fixedBranchName: string | null;
  initialData: CollectorsAnalyticsData;
  initialFilters: CollectorsFilterState;
}) {
  const normalizedInitialFilters = useMemo<CollectorsFilterInput>(
    () => ({
      branch: initialFilters.selectedBranchRaw || "all",
      range: initialFilters.selectedRange,
      from: initialFilters.fromRaw,
      to: initialFilters.toRaw,
      query: initialFilters.searchQuery,
      basis: initialFilters.selectedBasis,
      page: initialFilters.page,
      pageSize: initialFilters.pageSize,
    }),
    [
      initialFilters.fromRaw,
      initialFilters.page,
      initialFilters.pageSize,
      initialFilters.searchQuery,
      initialFilters.selectedBasis,
      initialFilters.selectedBranchRaw,
      initialFilters.selectedRange,
      initialFilters.toRaw,
    ],
  );

  const [results, setResults] = useState<CollectorsAnalyticsData | null>(initialData);
  const [filters, setFilters] = useState<CollectorsFilterInput>(normalizedInitialFilters);
  const [appliedFilters, setAppliedFilters] = useState<CollectorsFilterInput>(normalizedInitialFilters);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const filtersRef = useRef<CollectorsFilterInput>(normalizedInitialFilters);

  const loadResults = useCallback(async (nextFilters: CollectorsFilterInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(buildDataUrl(nextFilters), {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Unable to load collectors analytics.");
      }

      const nextData = (await response.json()) as CollectorsAnalyticsData;
      const normalized = { ...nextFilters, page: nextData.page };
      setResults(nextData);
      setAppliedFilters(normalized);
      window.history.replaceState(null, "", buildPageUrl(normalized));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setErrorMessage("Unable to refresh collectors analytics right now.");
    } finally {
      if (abortRef.current === controller) {
        setIsPending(false);
      }
    }
  }, []);

  useEffect(() => {
    setFilters(normalizedInitialFilters);
    setAppliedFilters(normalizedInitialFilters);
    setResults(initialData);
    setIsPending(false);
    setErrorMessage(null);
    return () => abortRef.current?.abort();
  }, [initialData, normalizedInitialFilters]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    if (
      filters.branch === appliedFilters.branch &&
      filters.range === appliedFilters.range &&
      filters.from === appliedFilters.from &&
      filters.to === appliedFilters.to &&
      filters.basis === appliedFilters.basis &&
      filters.page === appliedFilters.page &&
      filters.pageSize === appliedFilters.pageSize
    ) {
      return;
    }

    if (filters.range === "custom" && (!filters.from || !filters.to)) {
      return;
    }

    void loadResults(filters);
  }, [
    appliedFilters.basis,
    appliedFilters.branch,
    appliedFilters.from,
    appliedFilters.page,
    appliedFilters.pageSize,
    appliedFilters.range,
    appliedFilters.to,
    filters,
    loadResults,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (filtersRef.current.query === appliedFilters.query) {
        return;
      }

      void loadResults({
        ...filtersRef.current,
        page: 1,
      });
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [appliedFilters.query, filters.query, loadResults]);

  const scopeLabel = canChooseBranch
    ? filters.branch === "all"
      ? "All visible branches"
      : branchOptions.find((option) => option.value === filters.branch)?.label ?? "Selected branch"
    : fixedBranchName ?? "Assigned branch";

  return (
    <div className="w-full max-w-none space-y-5 px-4 pb-6 pt-1 sm:px-6 sm:pb-6 sm:pt-2">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="bg-gradient-to-r from-slate-50 via-background to-emerald-50/60 p-6 dark:from-zinc-950 dark:via-background dark:to-emerald-950/45">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1">
              <div className="space-y-1">
                <CardTitle className="text-3xl font-semibold tracking-tight">Collectors</CardTitle>
                <CardDescription>
                  {canChooseBranch
                    ? "Rank collectors, compare output, and review workload context across the visible branches."
                    : `Rank collectors, compare output, and review workload context in ${fixedBranchName ?? "your branch"}.`}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Badge
                  className="border-zinc-200 bg-background/80 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100"
                  variant="outline"
                >
                  {results?.totalCount ?? 0} collectors
                </Badge>
                <Badge
                  className="border-zinc-200 bg-background/80 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100"
                  variant="outline"
                >
                  {resolveCollectorsPeriodTriggerLabel({
                    range: filters.range,
                    from: filters.from,
                    to: filters.to,
                  })}
                </Badge>
                <Badge
                  className="border-zinc-200 bg-background/80 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100"
                  variant="outline"
                >
                  {scopeLabel}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <CardContent className="border-t border-border/70 px-6 pb-4 pt-3">
          <CollectorsFilters
            branchFilterLabel={branchFilterLabel}
            branchOptions={branchOptions}
            canChooseBranch={canChooseBranch}
            onBranchChange={(value) =>
              setFilters((previous) => ({
                ...previous,
                branch: value,
                page: 1,
              }))
            }
            onSearchChange={(value) =>
              setFilters((previous) => ({
                ...previous,
                query: value,
                page: 1,
              }))
            }
            onClear={() =>
              setFilters({
                branch: canChooseBranch ? "all" : normalizedInitialFilters.branch,
                range: "this-month",
                from: "",
                to: "",
                query: "",
                basis: "total-collected",
                page: 1,
                pageSize: 10,
              })
            }
            selectedFilters={{
              selectedBranchRaw: filters.branch,
              selectedRange: filters.range,
              fromRaw: filters.from,
              toRaw: filters.to,
              searchQuery: filters.query,
              selectedBasis: filters.basis,
              page: filters.page,
              pageSize: filters.pageSize,
            }}
          />
        </CardContent>
      </Card>

      <CollectorsResultsSection
        data={results}
        errorMessage={errorMessage}
        filters={filters}
        isPending={isPending}
        onBasisChange={(basis) =>
          setFilters((previous) => ({
            ...previous,
            basis,
            page: 1,
          }))
        }
        onRangeChange={(value) =>
          setFilters((previous) => ({
            ...previous,
            range: value.range,
            from: value.from,
            to: value.to,
            basis:
              previous.basis === "average-monthly-collections" &&
              !supportsAverageMonthlyCollectionsSelection({
                range: value.range,
                from: value.from,
                to: value.to,
              })
                ? "total-collected"
                : previous.basis === "incentives" &&
                    !supportsIncentivesSelection({
                      range: value.range,
                      from: value.from,
                      to: value.to,
                    })
                  ? "total-collected"
                  : previous.basis,
            page: 1,
          }))
        }
        onPageChange={(page) =>
          setFilters((previous) => ({
            ...previous,
            page,
          }))
        }
        onPageSizeChange={(pageSize) =>
          setFilters((previous) => ({
            ...previous,
            page: 1,
            pageSize,
          }))
        }
      />
    </div>
  );
}
