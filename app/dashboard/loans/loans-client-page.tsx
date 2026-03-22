"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LoanRecordsModule } from "@/app/dashboard/loans/loan-records-module";
import { LoansFilters } from "@/app/dashboard/loans/loans-filters";
import type { LoanBranchOption, LoanListTab, StaffLoansPageData, StaffLoansScope } from "@/app/dashboard/loans/types";

type LoansClientPageProps = {
  initialData: StaffLoansPageData;
  initialScope: StaffLoansScope;
  branchOptions: LoanBranchOption[];
};

type LoanResultFilters = {
  branchId: number | null;
  tab: LoanListTab;
  query: string;
  page: number;
};

function buildResultsUrl(filters: LoanResultFilters) {
  const params = new URLSearchParams();

  if (filters.branchId) {
    params.set("branchId", String(filters.branchId));
  }

  if (filters.query.trim()) {
    params.set("query", filters.query.trim());
  }

  params.set("tab", filters.tab);

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  const queryString = params.toString();
  const pathname = "/dashboard/loans";
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function buildDataUrl(filters: LoanResultFilters) {
  const params = new URLSearchParams();

  if (filters.branchId) {
    params.set("branchId", String(filters.branchId));
  }

  if (filters.query.trim()) {
    params.set("query", filters.query.trim());
  }

  params.set("tab", filters.tab);

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  const queryString = params.toString();
  return queryString ? `/dashboard/loans/data?${queryString}` : "/dashboard/loans/data";
}

export function LoansClientPage({
  initialData,
  initialScope,
  branchOptions,
}: LoansClientPageProps) {
  const initialFilters = useMemo<LoanResultFilters>(
    () => ({
      branchId: initialScope.selectedBranchId,
      tab: initialScope.tab,
      query: initialScope.searchQuery,
      page: initialData.page,
    }),
    [initialData.page, initialScope.searchQuery, initialScope.selectedBranchId, initialScope.tab],
  );
  const [results, setResults] = useState(initialData);
  const [filters, setFilters] = useState<LoanResultFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<LoanResultFilters>(initialFilters);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const filtersRef = useRef<LoanResultFilters>(initialFilters);

  useEffect(() => {
    setResults(initialData);
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
  }, [initialData, initialFilters]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const updateHistory = useCallback((nextFilters: LoanResultFilters) => {
    const nextUrl = buildResultsUrl(nextFilters);
    window.history.replaceState(null, "", nextUrl);
  }, []);

  const loadResults = useCallback(async (nextFilters: LoanResultFilters) => {
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
        throw new Error("Unable to update loans.");
      }

      const nextData = (await response.json()) as StaffLoansPageData;
      setResults(nextData);
      setAppliedFilters({
        branchId: nextFilters.branchId,
        tab: nextFilters.tab,
        query: nextFilters.query,
        page: nextData.page,
      });
      updateHistory({
        branchId: nextFilters.branchId,
        tab: nextFilters.tab,
        query: nextFilters.query,
        page: nextData.page,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setErrorMessage("Unable to refresh loan records right now.");
    } finally {
      if (abortRef.current === controller) {
        setIsPending(false);
      }
    }
  }, [updateHistory]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (
      filters.branchId === appliedFilters.branchId &&
      filters.tab === appliedFilters.tab
    ) {
      return;
    }

    void loadResults({
      branchId: filters.branchId,
      tab: filters.tab,
      query: filters.query,
      page: 1,
    });
  }, [appliedFilters.branchId, appliedFilters.tab, filters.branchId, filters.query, filters.tab, loadResults]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (filtersRef.current.query === appliedFilters.query) {
        return;
      }

      void loadResults({
        branchId: filtersRef.current.branchId,
        tab: filtersRef.current.tab,
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
      branchId: filters.branchId,
      tab: filters.tab,
      query: filters.query,
      page,
    });
  }, [filters.branchId, filters.query, filters.tab, loadResults]);

  const handleBranchChange = useCallback((branchId: number | null) => {
    setFilters((previous) => ({
      ...previous,
      branchId,
      page: 1,
    }));
  }, []);

  const handleTabChange = useCallback((tab: LoanListTab) => {
    setFilters((previous) => ({
      ...previous,
      tab,
      page: 1,
    }));
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setFilters((previous) => ({
      ...previous,
      query,
      page: 1,
    }));
  }, []);

  return (
    <LoanRecordsModule
      controls={(
        <LoansFilters
          branches={branchOptions}
          action={
            initialScope.canCreateLoan ? (
              <Link href="/dashboard/create-loan">
                <Button className="w-full xl:w-auto" size="sm" type="button" variant="secondary">
                  Create loan
                </Button>
              </Link>
            ) : null
          }
          canChooseBranchFilter={initialScope.canChooseBranchFilter}
          isPending={isPending}
          onBranchChange={handleBranchChange}
          onSearchChange={handleSearchChange}
          onTabChange={handleTabChange}
          selectedBranchId={filters.branchId}
          selectedSearchQuery={filters.query}
          selectedTab={filters.tab}
        />
      )}
      data={results}
      errorMessage={errorMessage}
      isPending={isPending}
      onPageChange={handlePageChange}
    />
  );
}
