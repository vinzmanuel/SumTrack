"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UI_PAGE_STACK_CLASS_NAME } from "@/app/dashboard/_components/ui-patterns";
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

  if (filters.range !== "last-30-days") {
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
  initialData,
  initialFilters,
}: {
  branchFilterLabel: string;
  branchOptions: CollectionsBranchOption[];
  canChooseBranch: boolean;
  initialData: CollectionsAnalyticsData;
  initialFilters: CollectionsFilterState;
}) {
  const [results, setResults] = useState<CollectionsAnalyticsData | null>(initialData);
  const [isPending, setIsPending] = useState(false);
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
    setResults(initialData);
    setIsPending(false);
    setErrorMessage(null);
    return () => abortRef.current?.abort();
  }, [initialData]);

  return (
    <div className={UI_PAGE_STACK_CLASS_NAME}>

      <CollectionsFilters
        branchFilterLabel={branchFilterLabel}
        branchOptions={branchOptions}
        canChooseBranch={canChooseBranch}
        initialFilters={initialFilters}
        isPending={isPending}
        onApply={loadResults}
      />

      <CollectionsResultsSection
        data={results}
        errorMessage={errorMessage}
        isPending={isPending}
      />
    </div>
  );
}
