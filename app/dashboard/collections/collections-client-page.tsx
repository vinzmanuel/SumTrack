"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { CollectionsFilters } from "@/app/dashboard/collections/collections-filters";
import { CollectionsResultsSection } from "@/app/dashboard/collections/collections-results-section";
import type {
  CollectionsAnalyticsData,
  CollectionsBranchOption,
  CollectionsFilterInput,
  CollectionsFilterState,
} from "@/app/dashboard/collections/types";

function buildCollectionsPageUrl(filters: CollectionsFilterInput) {
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

  const queryString = params.toString();
  return queryString ? `/dashboard/collections?${queryString}` : "/dashboard/collections";
}

function buildCollectionsDataUrl(filters: CollectionsFilterInput) {
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

  return `/dashboard/collections/data?${params.toString()}`;
}

export function CollectionsClientPage({
  branchFilterLabel,
  branchOptions,
  canChooseBranch,
  fixedBranchName,
  initialFilters,
}: {
  branchFilterLabel: string;
  branchOptions: CollectionsBranchOption[];
  canChooseBranch: boolean;
  fixedBranchName: string | null;
  initialFilters: CollectionsFilterState;
}) {
  const normalizedInitialFilters = useMemo<CollectionsFilterInput>(
    () => ({
      branch: initialFilters.selectedBranchRaw || "all",
      range: initialFilters.selectedRange,
      from: initialFilters.fromRaw,
      to: initialFilters.toRaw,
    }),
    [initialFilters.fromRaw, initialFilters.selectedBranchRaw, initialFilters.selectedRange, initialFilters.toRaw],
  );

  const [results, setResults] = useState<CollectionsAnalyticsData | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadResults = useCallback(async (filters: CollectionsFilterInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(buildCollectionsDataUrl(filters), {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Unable to load collections analytics.");
      }

      const nextData = (await response.json()) as CollectionsAnalyticsData;
      setResults(nextData);
      window.history.replaceState(null, "", buildCollectionsPageUrl(filters));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setErrorMessage("Unable to refresh collections analytics right now.");
    } finally {
      if (abortRef.current === controller) {
        setIsPending(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadResults(normalizedInitialFilters);
    return () => abortRef.current?.abort();
  }, [loadResults, normalizedInitialFilters]);

  return (
    <div className="space-y-6">
      <TremorCard className="p-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              Collections Analytics
            </h2>
            <TremorDescription className="text-[13px]">
              {canChooseBranch
                ? "Track collected amount, missed-payment signals, and branch-level performance trends."
                : `Track collected amount, missed-payment signals, and operational patterns for ${fixedBranchName ?? "your branch"}.`}
            </TremorDescription>
          </div>
          <div className="w-full xl:max-w-3xl">
            <CollectionsFilters
              branchFilterLabel={branchFilterLabel}
              branchOptions={branchOptions}
              canChooseBranch={canChooseBranch}
              initialFilters={initialFilters}
              isPending={isPending}
              onApply={loadResults}
            />
          </div>
        </div>
      </TremorCard>

      <CollectionsResultsSection
        data={results}
        errorMessage={errorMessage}
        isPending={isPending}
      />
    </div>
  );
}
