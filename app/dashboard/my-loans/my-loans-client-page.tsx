"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoanRecordsModule } from "@/app/dashboard/loans/loan-records-module";
import { LoansFilters } from "@/app/dashboard/loans/loans-filters";
import type {
  BorrowerLoansFilters,
  BorrowerLoansPageData,
} from "@/app/dashboard/my-loans/types";

function buildDataUrl(filters: BorrowerLoansFilters) {
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

  if (filters.pageSize !== 20) {
    params.set("pageSize", String(filters.pageSize));
  }

  const query = params.toString();
  return query ? `/dashboard/my-loans/data?${query}` : "/dashboard/my-loans/data";
}

function replaceMyLoansUrl(filters: BorrowerLoansFilters) {
  const url = new URL(window.location.href);

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

  if (filters.pageSize !== 20) {
    url.searchParams.set("pageSize", String(filters.pageSize));
  } else {
    url.searchParams.delete("pageSize");
  }

  const query = url.searchParams.toString();
  window.history.replaceState(null, "", query ? `${url.pathname}?${query}` : url.pathname);
}

function buildMyLoansReturnTo(filters: BorrowerLoansFilters) {
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

  if (filters.pageSize !== 20) {
    params.set("pageSize", String(filters.pageSize));
  }

  const query = params.toString();
  return query ? `/dashboard/my-loans?${query}` : "/dashboard/my-loans";
}

export function MyLoansClientPage({
  initialData,
  initialFilters,
}: {
  initialData: BorrowerLoansPageData;
  initialFilters: BorrowerLoansFilters;
}) {
  const normalizedInitialFilters = useMemo<BorrowerLoansFilters>(
    () => ({
      status: initialFilters.status,
      query: initialFilters.query,
      page: initialData.page,
      pageSize: initialData.pageSize,
    }),
    [initialData.page, initialData.pageSize, initialFilters.query, initialFilters.status],
  );
  const [results, setResults] = useState(initialData);
  const [filters, setFilters] = useState<BorrowerLoansFilters>(normalizedInitialFilters);
  const [appliedFilters, setAppliedFilters] = useState<BorrowerLoansFilters>(normalizedInitialFilters);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const filtersRef = useRef<BorrowerLoansFilters>(normalizedInitialFilters);

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

  const loadResults = useCallback(async (nextFilters: BorrowerLoansFilters) => {
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
        throw new Error("Unable to update your loans.");
      }

      const nextData = (await response.json()) as BorrowerLoansPageData;
      const normalized = {
        status: nextFilters.status,
        query: nextFilters.query,
        page: nextData.page,
        pageSize: nextData.pageSize,
      };
      setResults(nextData);
      setAppliedFilters(normalized);
      replaceMyLoansUrl(normalized);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setErrorMessage("Unable to refresh your loans right now.");
    } finally {
      if (abortRef.current === controller) {
        setIsPending(false);
      }
    }
  }, []);

  useEffect(() => {
    if (filters.status === appliedFilters.status && filters.pageSize === appliedFilters.pageSize) {
      return;
    }

    void loadResults({
      status: filters.status,
      query: filters.query,
      page: 1,
      pageSize: filters.pageSize,
    });
  }, [appliedFilters.pageSize, appliedFilters.status, filters.pageSize, filters.query, filters.status, loadResults]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (filtersRef.current.query === appliedFilters.query) {
        return;
      }

      void loadResults({
        status: filtersRef.current.status,
        query: filtersRef.current.query,
        page: 1,
        pageSize: filtersRef.current.pageSize,
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
      pageSize: filters.pageSize,
    });
  }, [filters.pageSize, filters.query, filters.status, loadResults]);

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setFilters((previous) => ({
      ...previous,
      pageSize,
      page: 1,
    }));
  }, []);

  const handleClear = useCallback(() => {
    const cleared: BorrowerLoansFilters = {
      status: "all",
      query: "",
      page: 1,
      pageSize: 20,
    };

    setFilters(cleared);
    void loadResults(cleared);
  }, [loadResults]);

  const currentReturnTo = buildMyLoansReturnTo(filters);

  return (
    <div className="w-full max-w-none space-y-4">
      <LoanRecordsModule
        controls={(
          <LoansFilters
            branches={[]}
            canChooseBranchFilter={false}
            isPending={isPending}
            onBranchChange={() => undefined}
            onClear={handleClear}
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
        )}
        data={{
          activeCount: 0,
          archivedCount: 0,
          branchOptions: [],
          loans: results.loans,
          page: results.page,
          pageSize: results.pageSize,
          totalCount: results.totalCount,
        }}
        detailSource="my-loans"
        errorMessage={errorMessage}
        isPending={isPending}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        returnTo={currentReturnTo}
      />
    </div>
  );
}

