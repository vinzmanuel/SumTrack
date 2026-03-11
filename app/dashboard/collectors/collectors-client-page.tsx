"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { CollectorsFilters } from "@/app/dashboard/collectors/collectors-filters";
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
  if (filters.page > 1) {
    params.set("page", String(filters.page));
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
  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }
  return `/dashboard/collectors/data?${params.toString()}`;
}

export function CollectorsClientPage({
  branchFilterLabel,
  branchOptions,
  canChooseBranch,
  fixedBranchName,
  initialFilters,
}: {
  branchFilterLabel: string;
  branchOptions: CollectorsBranchOption[];
  canChooseBranch: boolean;
  fixedBranchName: string | null;
  initialFilters: CollectorsFilterState;
}) {
  const normalizedInitialFilters = useMemo<CollectorsFilterInput>(
    () => ({
      branch: initialFilters.selectedBranchRaw || "all",
      range: initialFilters.selectedRange,
      from: initialFilters.fromRaw,
      to: initialFilters.toRaw,
      query: initialFilters.searchQuery,
      page: initialFilters.page,
    }),
    [
      initialFilters.fromRaw,
      initialFilters.page,
      initialFilters.searchQuery,
      initialFilters.selectedBranchRaw,
      initialFilters.selectedRange,
      initialFilters.toRaw,
    ],
  );

  const [results, setResults] = useState<CollectorsAnalyticsData | null>(null);
  const [filters, setFilters] = useState<CollectorsFilterInput>(normalizedInitialFilters);
  const [appliedFilters, setAppliedFilters] = useState<CollectorsFilterInput>(normalizedInitialFilters);
  const [isPending, setIsPending] = useState(true);
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
    setResults(null);
    void loadResults(normalizedInitialFilters);
    return () => abortRef.current?.abort();
  }, [loadResults, normalizedInitialFilters]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    if (
      filters.branch === appliedFilters.branch &&
      filters.range === appliedFilters.range &&
      filters.from === appliedFilters.from &&
      filters.to === appliedFilters.to &&
      filters.page === appliedFilters.page
    ) {
      return;
    }

    if (filters.range === "custom" && (!filters.from || !filters.to)) {
      return;
    }

    void loadResults(filters);
  }, [
    appliedFilters.branch,
    appliedFilters.from,
    appliedFilters.page,
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

  return (
    <div className="space-y-6">
      <TremorCard className="p-6">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Collectors Performance
            </h2>
            <TremorDescription className="text-[13px]">
              {canChooseBranch
                ? "Monitor collector performance, ranking, portfolio load, and execution quality across the visible branches."
                : `Monitor collector performance, ranking, portfolio load, and execution quality in ${fixedBranchName ?? "your branch"}.`}
            </TremorDescription>
          </div>

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
            onRangeChange={(value) =>
              setFilters((previous) => ({
                ...previous,
                range: value.range,
                from: value.from,
                to: value.to,
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
            selectedFilters={{
              selectedBranchRaw: filters.branch,
              selectedRange: filters.range,
              fromRaw: filters.from,
              toRaw: filters.to,
              searchQuery: filters.query,
              page: filters.page,
            }}
          />
        </div>
      </TremorCard>

      <CollectorsResultsSection
        data={results}
        errorMessage={errorMessage}
        filters={filters}
        isPending={isPending}
        onPageChange={(page) =>
          setFilters((previous) => ({
            ...previous,
            page,
          }))
        }
      />
    </div>
  );
}
