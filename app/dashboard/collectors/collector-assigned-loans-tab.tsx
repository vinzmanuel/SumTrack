"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoanRecordsModule } from "@/app/dashboard/loans/loan-records-module";
import { LoansFilters } from "@/app/dashboard/loans/loans-filters";
import type {
  CollectorAssignedLoansData,
  CollectorAssignedLoansFilters,
} from "@/app/dashboard/collectors/types";

function buildDataUrl(collectorId: string, filters: CollectorAssignedLoansFilters) {
  const params = new URLSearchParams();

  if (filters.query.trim()) {
    params.set("loanQuery", filters.query.trim());
  }

  if (filters.status !== "all") {
    params.set("loanStatus", filters.status);
  }

  if (filters.page > 1) {
    params.set("loansPage", String(filters.page));
  }

  const query = params.toString();
  return query
    ? `/dashboard/collectors/${collectorId}/assigned-loans/data?${query}`
    : `/dashboard/collectors/${collectorId}/assigned-loans/data`;
}

function replaceAssignedLoansUrl(filters: CollectorAssignedLoansFilters) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", "assigned-loans");

  if (filters.query.trim()) {
    url.searchParams.set("loanQuery", filters.query.trim());
  } else {
    url.searchParams.delete("loanQuery");
  }

  if (filters.status !== "all") {
    url.searchParams.set("loanStatus", filters.status);
  } else {
    url.searchParams.delete("loanStatus");
  }

  if (filters.page > 1) {
    url.searchParams.set("loansPage", String(filters.page));
  } else {
    url.searchParams.delete("loansPage");
  }

  const query = url.searchParams.toString();
  window.history.replaceState(null, "", query ? `${url.pathname}?${query}` : url.pathname);
}

export function CollectorAssignedLoansTab({
  collectorId,
  initialData,
  initialFilters,
}: {
  collectorId: string;
  initialData: CollectorAssignedLoansData;
  initialFilters: CollectorAssignedLoansFilters;
}) {
  const normalizedInitialFilters = useMemo<CollectorAssignedLoansFilters>(
    () => ({
      status: initialFilters.status,
      query: initialFilters.query,
      page: initialData.page,
    }),
    [initialData.page, initialFilters.query, initialFilters.status],
  );
  const [results, setResults] = useState(initialData);
  const [filters, setFilters] = useState<CollectorAssignedLoansFilters>(normalizedInitialFilters);
  const [appliedFilters, setAppliedFilters] = useState<CollectorAssignedLoansFilters>(normalizedInitialFilters);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const filtersRef = useRef<CollectorAssignedLoansFilters>(normalizedInitialFilters);

  useEffect(() => {
    setResults(initialData);
    setFilters(normalizedInitialFilters);
    setAppliedFilters(normalizedInitialFilters);
    setErrorMessage(null);
  }, [initialData, normalizedInitialFilters]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const loadResults = useCallback(async (nextFilters: CollectorAssignedLoansFilters) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(buildDataUrl(collectorId, nextFilters), {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Unable to update assigned loans.");
      }

      const nextData = (await response.json()) as CollectorAssignedLoansData;
      const normalized = {
        status: nextFilters.status,
        query: nextFilters.query,
        page: nextData.page,
      };
      setResults(nextData);
      setAppliedFilters(normalized);
      replaceAssignedLoansUrl(normalized);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setErrorMessage("Unable to refresh assigned loans right now.");
    } finally {
      if (abortRef.current === controller) {
        setIsPending(false);
      }
    }
  }, [collectorId]);

  useEffect(() => {
    if (filters.status === appliedFilters.status) {
      return;
    }

    void loadResults({
      status: filters.status,
      query: filters.query,
      page: 1,
    });
  }, [appliedFilters.status, filters.query, filters.status, loadResults]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (filtersRef.current.query === appliedFilters.query) {
        return;
      }

      void loadResults({
        status: filtersRef.current.status,
        query: filtersRef.current.query,
        page: 1,
      });
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [appliedFilters.query, filters.query, loadResults]);

  const handlePageChange = useCallback((page: number) => {
    setFilters((previous) => ({
      ...previous,
      page,
    }));

    void loadResults({
      status: filters.status,
      query: filters.query,
      page,
    });
  }, [filters.query, filters.status, loadResults]);

  return (
    <LoanRecordsModule
      controls={
        <LoansFilters
          branches={[]}
          canChooseBranchFilter={false}
          isPending={isPending}
          onBranchChange={() => undefined}
          onSearchChange={(query) =>
            setFilters((previous) => ({
              ...previous,
              query,
              page: 1,
            }))
          }
          onStatusChange={(status) =>
            setFilters((previous) => ({
              ...previous,
              status,
              page: 1,
            }))
          }
          selectedBranchId={null}
          selectedSearchQuery={filters.query}
          selectedStatus={filters.status}
        />
      }
      data={{
        branchOptions: [],
        loans: results.loans,
        page: results.page,
        pageSize: results.pageSize,
        totalCount: results.totalCount,
      }}
      errorMessage={errorMessage}
      isPending={isPending}
      onPageChange={handlePageChange}
    />
  );
}
