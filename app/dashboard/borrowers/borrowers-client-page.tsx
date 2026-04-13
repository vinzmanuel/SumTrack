"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { appendBackNavigationToHref } from "@/app/dashboard/back-navigation";
import { Button } from "@/components/ui/button";
import { UI_PAGE_STACK_CLASS_NAME } from "@/app/dashboard/_components/ui-patterns";
import { BorrowerRecordsModule } from "@/app/dashboard/borrowers/borrower-records-module";
import { BorrowersFilters } from "@/app/dashboard/borrowers/borrowers-filters";
import type { BorrowersPageData, BorrowersStaffScope } from "@/app/dashboard/borrowers/types";

type BorrowersClientPageProps = {
  initialData: BorrowersPageData;
  initialScope: BorrowersStaffScope;
};

type BorrowerResultFilters = {
  branchId: number | null;
  areaId: number | null;
  query: string;
  page: number;
  pageSize: number;
};

function buildResultsUrl(filters: BorrowerResultFilters) {
  const params = new URLSearchParams();

  if (filters.branchId) {
    params.set("branchId", String(filters.branchId));
  }

  if (filters.areaId) {
    params.set("areaId", String(filters.areaId));
  }

  if (filters.query.trim()) {
    params.set("query", filters.query.trim());
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  if (filters.pageSize !== 20) {
    params.set("pageSize", String(filters.pageSize));
  }

  const queryString = params.toString();
  const pathname = "/dashboard/borrowers";
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function buildDataUrl(filters: BorrowerResultFilters) {
  const params = new URLSearchParams();

  if (filters.branchId) {
    params.set("branchId", String(filters.branchId));
  }

  if (filters.areaId) {
    params.set("areaId", String(filters.areaId));
  }

  if (filters.query.trim()) {
    params.set("query", filters.query.trim());
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  if (filters.pageSize !== 20) {
    params.set("pageSize", String(filters.pageSize));
  }

  const queryString = params.toString();
  return queryString ? `/dashboard/borrowers/data?${queryString}` : "/dashboard/borrowers/data";
}

export function BorrowersClientPage({
  initialData,
  initialScope,
}: BorrowersClientPageProps) {
  const initialFilters = useMemo<BorrowerResultFilters>(
    () => ({
      branchId: initialScope.selectedBranchId,
      areaId: initialData.selectedAreaId,
      query: initialScope.searchQuery,
      page: initialData.page,
      pageSize: initialData.pageSize,
    }),
    [initialData.page, initialData.pageSize, initialData.selectedAreaId, initialScope.searchQuery, initialScope.selectedBranchId],
  );
  const [results, setResults] = useState(initialData);
  const [filters, setFilters] = useState<BorrowerResultFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<BorrowerResultFilters>(initialFilters);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const filtersRef = useRef<BorrowerResultFilters>(initialFilters);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setResults(initialData);
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
  }, [initialData, initialFilters]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const updateHistory = useCallback((nextFilters: BorrowerResultFilters) => {
    const nextUrl = buildResultsUrl(nextFilters);
    window.history.replaceState(null, "", nextUrl);
  }, []);

  const loadResults = useCallback(async (nextFilters: BorrowerResultFilters) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
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
        throw new Error("Unable to update borrowers.");
      }

      const nextData = (await response.json()) as BorrowersPageData;
      if (requestIdRef.current !== requestId) {
        return;
      }

      setResults(nextData);
      const nextApplied = {
        branchId: nextFilters.branchId,
        areaId: nextData.selectedAreaId,
        query: nextFilters.query,
        page: nextData.page,
        pageSize: nextData.pageSize,
      };
      setAppliedFilters(nextApplied);
      updateHistory(nextApplied);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      if (requestIdRef.current !== requestId) {
        return;
      }

      setErrorMessage("Unable to refresh borrower results right now.");
    } finally {
      if (abortRef.current === controller && requestIdRef.current === requestId) {
        setIsPending(false);
      }
    }
  }, [updateHistory]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (
      filters.branchId === appliedFilters.branchId &&
      filters.areaId === appliedFilters.areaId
    ) {
      return;
    }

    void loadResults({
      branchId: filters.branchId,
      areaId: filters.areaId,
      query: filters.query,
      page: 1,
      pageSize: filters.pageSize,
    });
  }, [appliedFilters.areaId, appliedFilters.branchId, filters.areaId, filters.branchId, filters.pageSize, filters.query, loadResults]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (filtersRef.current.query === appliedFilters.query) {
        return;
      }

      void loadResults({
        branchId: filtersRef.current.branchId,
        areaId: filtersRef.current.areaId,
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
      branchId: filtersRef.current.branchId,
      areaId: filtersRef.current.areaId,
      query: filtersRef.current.query,
      page,
      pageSize: filtersRef.current.pageSize,
    });
  }, [loadResults]);

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setFilters((previous) => ({
      ...previous,
      pageSize,
      page: 1,
    }));

    void loadResults({
      branchId: filtersRef.current.branchId,
      areaId: filtersRef.current.areaId,
      query: filtersRef.current.query,
      page: 1,
      pageSize,
    });
  }, [loadResults]);

  const handleBranchChange = useCallback((branchId: number | null) => {
    setFilters((previous) => ({
      ...previous,
      branchId,
      areaId: null,
      page: 1,
      pageSize: previous.pageSize,
    }));
  }, []);

  const handleAreaChange = useCallback((areaId: number | null) => {
    setFilters((previous) => ({
      ...previous,
      areaId,
      page: 1,
      pageSize: previous.pageSize,
    }));
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setFilters((previous) => ({
      ...previous,
      query,
      page: 1,
      pageSize: previous.pageSize,
    }));
  }, []);

  const handleClear = useCallback(() => {
    setFilters({
      branchId: initialScope.canChooseBranch ? null : initialScope.selectedBranchId,
      areaId: null,
      query: "",
      page: 1,
      pageSize: 20,
    });
  }, [initialScope.canChooseBranch, initialScope.selectedBranchId]);

  const canCreateBorrower =
    initialScope.roleName === "Admin" ||
    initialScope.roleName === "Branch Manager" ||
    initialScope.roleName === "Secretary";

  return (
    <>
      <div className={`w-full max-w-none ${UI_PAGE_STACK_CLASS_NAME}`}>
      <BorrowerRecordsModule
        controls={
          <BorrowersFilters
            action={
              canCreateBorrower ? (
                <Link href={appendBackNavigationToHref("/dashboard/create-account?prefillRole=Borrower&context=borrower", {
                  source: "borrowers",
                  returnTo: buildResultsUrl(appliedFilters)
                })}>
                  <Button
                    className="h-11 w-full rounded-md bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700 hover:text-white xl:w-auto"
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    Create Borrower
                  </Button>
                </Link>
              ) : null
            }
            allBranchLabel={initialScope.allBranchLabel}
            areas={results.areas}
            branches={results.branches}
            canChooseBranch={initialScope.canChooseBranch}
            isPending={isPending}
            onAreaChange={handleAreaChange}
            onBranchChange={handleBranchChange}
            onClear={handleClear}
            onSearchChange={handleSearchChange}
            selectedAreaId={filters.areaId}
            selectedBranchId={filters.branchId}
            selectedSearchQuery={filters.query}
          />
        }
        data={results}
        errorMessage={errorMessage}
        isPending={isPending}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
      </div>
    </>
  );
}
