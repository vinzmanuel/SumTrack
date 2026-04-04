"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
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

function startCaseLabel(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function CollectionsClientPage({
  branchFilterLabel,
  branchOptions,
  canChooseBranch,
  fixedBranchName,
  initialData,
  initialFilters,
}: {
  branchFilterLabel: string;
  branchOptions: CollectionsBranchOption[];
  canChooseBranch: boolean;
  fixedBranchName: string | null;
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

  const scopeLabel = canChooseBranch
    ? results?.filters.selectedBranchRaw && results.filters.selectedBranchRaw !== "all"
      ? branchOptions.find((option) => option.value === results.filters.selectedBranchRaw)?.label ?? "Selected branch"
      : "All visible branches"
    : fixedBranchName ?? "Assigned branch";

  return (
    <div className="w-full space-y-6">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="bg-gradient-to-r from-slate-50 via-background to-emerald-50/60 px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-3">
            <div className="space-y-1">
              <div className="space-y-1">
                <CardTitle className="text-[1.75rem] font-semibold tracking-tight sm:text-3xl">Collections</CardTitle>
                <CardDescription className="text-sm leading-5">
                  Analyze collection composition, reliability, and pattern behavior across the selected branch scope.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1.5">
                <Badge className="border-zinc-200 bg-background/80 px-2.5 py-1 text-zinc-700" variant="outline">
                  {scopeLabel}
                </Badge>
                <Badge className="border-zinc-200 bg-background/80 px-2.5 py-1 text-zinc-700" variant="outline">
                  {results ? startCaseLabel(results.dateRangeLabel) : "Selected period"}
                </Badge>
                <Badge className="border-zinc-200 bg-background/80 px-2.5 py-1 text-zinc-700" variant="outline">
                  {results
                    ? `${results.summary.activeCollectionDays.toLocaleString("en-PH")} active days`
                    : "Collections analytics"}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <CardContent className="border-t border-border/70 px-5 pb-3.5 pt-2.5 sm:px-6">
          <div className="flex w-full justify-end">
            <CollectionsFilters
              branchFilterLabel={branchFilterLabel}
              branchOptions={branchOptions}
              canChooseBranch={canChooseBranch}
              initialFilters={initialFilters}
              isPending={isPending}
              onApply={loadResults}
            />
          </div>
        </CardContent>
      </Card>

      <CollectionsResultsSection
        data={results}
        errorMessage={errorMessage}
        isPending={isPending}
      />
    </div>
  );
}
