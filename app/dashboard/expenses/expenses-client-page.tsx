"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EXPENSE_CATEGORIES } from "@/app/dashboard/expenses/filters";
import { ExpensesFilters } from "@/app/dashboard/expenses/expenses-filters";
import { ExpensesResultsSection } from "@/app/dashboard/expenses/expenses-results-section";
import type {
  ExpenseBranchOption,
  ExpensesFilterInput,
  ExpensesResultsData,
} from "@/app/dashboard/expenses/types";

type ExpensesClientPageProps = {
  branchOptions: ExpenseBranchOption[];
  canChooseBranch: boolean;
  canCreateExpense: boolean;
  description: string;
  fixedBranchName: string | null;
  initialFilters: ExpensesFilterInput;
  initialResults: ExpensesResultsData;
};

function buildExpensesPageUrl(filters: ExpensesFilterInput) {
  const params = new URLSearchParams();

  if (filters.branch && filters.branch !== "all") {
    params.set("branch", filters.branch);
  }

  if (filters.month) {
    params.set("month", filters.month);
  }

  if (filters.category && filters.category !== "all") {
    params.set("category", filters.category);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  const queryString = params.toString();
  return queryString ? `/dashboard/expenses?${queryString}` : "/dashboard/expenses";
}

function buildExpensesDataUrl(filters: ExpensesFilterInput) {
  const params = new URLSearchParams();

  if (filters.branch && filters.branch !== "all") {
    params.set("branch", filters.branch);
  }

  if (filters.month) {
    params.set("month", filters.month);
  }

  if (filters.category && filters.category !== "all") {
    params.set("category", filters.category);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  const queryString = params.toString();
  return queryString ? `/dashboard/expenses/data?${queryString}` : "/dashboard/expenses/data";
}

export function ExpensesClientPage({
  branchOptions,
  canChooseBranch,
  canCreateExpense,
  description,
  fixedBranchName,
  initialFilters,
  initialResults,
}: ExpensesClientPageProps) {
  const normalizedInitialFilters = useMemo<ExpensesFilterInput>(
    () => ({
      branch: initialFilters.branch,
      month: initialFilters.month,
      category: initialFilters.category,
      page: initialResults.page,
    }),
    [initialFilters.branch, initialFilters.category, initialFilters.month, initialResults.page],
  );

  const [results, setResults] = useState(initialResults);
  const [filters, setFilters] = useState<ExpensesFilterInput>(normalizedInitialFilters);
  const [appliedFilters, setAppliedFilters] = useState<ExpensesFilterInput>(normalizedInitialFilters);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadResults = useCallback(async (nextFilters: ExpensesFilterInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(buildExpensesDataUrl(nextFilters), {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Unable to load expenses.");
      }

      const nextData = (await response.json()) as ExpensesResultsData;
      const normalizedFilters = {
        branch: nextFilters.branch,
        month: nextFilters.month,
        category: nextFilters.category,
        page: nextData.page,
      };
      setResults(nextData);
      setFilters(normalizedFilters);
      setAppliedFilters(normalizedFilters);
      window.history.replaceState(null, "", buildExpensesPageUrl(normalizedFilters));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setErrorMessage("Unable to refresh expense records right now.");
    } finally {
      if (abortRef.current === controller) {
        setIsPending(false);
      }
    }
  }, []);

  useEffect(() => {
    setResults(initialResults);
    setFilters(normalizedInitialFilters);
    setAppliedFilters(normalizedInitialFilters);
    setErrorMessage(null);
  }, [initialResults, normalizedInitialFilters]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (
      filters.branch === appliedFilters.branch &&
      filters.month === appliedFilters.month &&
      filters.category === appliedFilters.category &&
      filters.page === appliedFilters.page
    ) {
      return;
    }

    void loadResults(filters);
  }, [appliedFilters, filters, loadResults]);

  const updateFilters = useCallback((updates: Partial<ExpensesFilterInput>) => {
    setFilters((previous) => ({
      ...previous,
      ...updates,
      page: updates.page ?? 1,
    }));
  }, []);

  const handleClear = useCallback(() => {
    setFilters({
      branch: canChooseBranch ? "all" : normalizedInitialFilters.branch,
      month: "",
      category: "all",
      page: 1,
    });
  }, [canChooseBranch, normalizedInitialFilters.branch]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/dashboard">
            <Button type="button" variant="outline">
              Back to dashboard
            </Button>
          </Link>
          {canCreateExpense ? (
            <Link href="/dashboard/expenses/create">
              <Button type="button" variant="secondary">
                Create expense
              </Button>
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          {canChooseBranch ? (
            <ExpensesFilters
              branches={branchOptions}
              canChooseBranch
              categories={EXPENSE_CATEGORIES}
              isPending={isPending}
              onBranchChange={(value) => updateFilters({ branch: value })}
              onCategoryChange={(value) => updateFilters({ category: value })}
              onClear={handleClear}
              onMonthChange={(value) => updateFilters({ month: value })}
              selectedBranchRaw={filters.branch}
              selectedCategory={filters.category}
              selectedMonthRaw={filters.month}
            />
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="fixed_branch">
                  Branch
                </label>
                <input
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                  id="fixed_branch"
                  readOnly
                  value={fixedBranchName ?? "N/A"}
                />
              </div>
              <ExpensesFilters
                branches={[]}
                canChooseBranch={false}
                categories={EXPENSE_CATEGORIES}
                isPending={isPending}
                onBranchChange={() => undefined}
                onCategoryChange={(value) => updateFilters({ category: value })}
                onClear={handleClear}
                onMonthChange={(value) => updateFilters({ month: value })}
                selectedBranchRaw={filters.branch}
                selectedCategory={filters.category}
                selectedMonthRaw={filters.month}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <ExpensesResultsSection
        data={results}
        errorMessage={errorMessage}
        isPending={isPending}
        onPageChange={(page) => updateFilters({ page })}
      />
    </div>
  );
}
