"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, ReceiptText } from "lucide-react";
import { appendBackNavigationToHref } from "@/app/dashboard/back-navigation";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { UI_PAGE_STACK_CLASS_NAME } from "@/app/dashboard/_components/ui-patterns";
import { Button } from "@/components/ui/button";
import { LoanRecordsModule } from "@/app/dashboard/loans/loan-records-module";
import { LoansFilters } from "@/app/dashboard/loans/loans-filters";
import type {
  LoanBranchOption,
  LoanListTab,
  LoanStatusFilter,
  StaffLoansPageData,
  StaffLoansScope,
} from "@/app/dashboard/loans/types";

type LoansClientPageProps = {
  initialData: StaffLoansPageData;
  initialScope: StaffLoansScope;
  branchOptions: LoanBranchOption[];
};

type LoanResultFilters = {
  branchId: number | null;
  tab: LoanListTab;
  status: LoanStatusFilter;
  query: string;
  page: number;
  pageSize: number;
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
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  if (filters.pageSize !== 20) {
    params.set("pageSize", String(filters.pageSize));
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
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  if (filters.pageSize !== 20) {
    params.set("pageSize", String(filters.pageSize));
  }

  const queryString = params.toString();
  return queryString ? `/dashboard/loans/data?${queryString}` : "/dashboard/loans/data";
}

export function LoansClientPage({
  initialData,
  initialScope,
  branchOptions,
}: LoansClientPageProps) {
  const headerConfig = useMemo(
    () => ({
      action: null,
      description: "Track, filter, and manage loan records across your current visible scope.",
      icon: <ReceiptText className="size-9 text-sidebar-foreground/65" />,
      title: "Loans",
    }),
    [],
  );

  const initialFilters = useMemo<LoanResultFilters>(
    () => ({
      branchId: initialScope.selectedBranchId,
      tab: initialScope.tab,
      status: initialScope.status,
      query: initialScope.searchQuery,
      page: initialData.page,
      pageSize: initialData.pageSize,
    }),
    [initialData.page, initialData.pageSize, initialScope.searchQuery, initialScope.selectedBranchId, initialScope.status, initialScope.tab],
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
        status: nextFilters.status,
        query: nextFilters.query,
        page: nextData.page,
        pageSize: nextData.pageSize,
      });
      updateHistory({
        branchId: nextFilters.branchId,
        tab: nextFilters.tab,
        status: nextFilters.status,
        query: nextFilters.query,
        page: nextData.page,
        pageSize: nextData.pageSize,
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
      filters.tab === appliedFilters.tab &&
      filters.status === appliedFilters.status
    ) {
      return;
    }

    void loadResults({
      branchId: filters.branchId,
      tab: filters.tab,
      status: filters.status,
      query: filters.query,
      page: 1,
      pageSize: filters.pageSize,
    });
  }, [
    appliedFilters.branchId,
    appliedFilters.status,
    appliedFilters.tab,
    filters.branchId,
    filters.pageSize,
    filters.query,
    filters.status,
    filters.tab,
    loadResults,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (filtersRef.current.query === appliedFilters.query) {
        return;
      }

      void loadResults({
        branchId: filtersRef.current.branchId,
        tab: filtersRef.current.tab,
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
      branchId: filters.branchId,
      tab: filters.tab,
      status: filters.status,
      query: filters.query,
      page,
      pageSize: filters.pageSize,
    });
  }, [filters.branchId, filters.pageSize, filters.query, filters.status, filters.tab, loadResults]);

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setFilters((previous) => ({
      ...previous,
      pageSize,
      page: 1,
    }));

    void loadResults({
      branchId: filtersRef.current.branchId,
      tab: filtersRef.current.tab,
      status: filtersRef.current.status,
      query: filtersRef.current.query,
      page: 1,
      pageSize,
    });
  }, [loadResults]);

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
      status: "all",
      page: 1,
    }));
  }, []);

  const handleStatusChange = useCallback((status: LoanStatusFilter) => {
    setFilters((previous) => ({
      ...previous,
      status,
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

  const handleClear = useCallback(() => {
    const clearedFilters: LoanResultFilters = {
      branchId: initialScope.canChooseBranchFilter ? null : initialScope.selectedBranchId,
      tab: "active",
      status: "all",
      query: "",
      page: 1,
      pageSize: 20,
    };

    setFilters(clearedFilters);
    void loadResults(clearedFilters);
  }, [initialScope.canChooseBranchFilter, initialScope.selectedBranchId, loadResults]);

  const currentReturnTo = buildResultsUrl(filters);

  return (
    <>
      <DashboardHeaderConfigurator config={headerConfig} />
      <div className={`w-full max-w-none ${UI_PAGE_STACK_CLASS_NAME}`}>
        <LoanRecordsModule
        controls={(
          <LoansFilters
            activeCount={results.activeCount}
            archivedCount={results.archivedCount}
            branches={branchOptions}
            action={
              initialScope.canCreateLoan ? (
                <Link href={appendBackNavigationToHref("/dashboard/create-loan", {
                  source: "loans",
                  returnTo: currentReturnTo,
                })}>
                  <Button
                    className="h-11 w-full rounded-md bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700 hover:text-white xl:w-auto"
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    Create Loan
                  </Button>
                </Link>
              ) : null
            }
            canChooseBranchFilter={initialScope.canChooseBranchFilter}
            isPending={isPending}
            onBranchChange={handleBranchChange}
            onClear={handleClear}
            onSearchChange={handleSearchChange}
            onStatusChange={handleStatusChange}
            onTabChange={handleTabChange}
            selectedBranchId={filters.branchId}
            selectedSearchQuery={filters.query}
            selectedStatus={filters.status}
            selectedTab={filters.tab}
          />
        )}
        data={results}
        errorMessage={errorMessage}
        isPending={isPending}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        returnTo={currentReturnTo}
        detailSource="loans"
      />
      </div>
    </>
  );
}
