"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { appendBackNavigationToHref } from "@/app/dashboard/back-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

function formatMonthLabel(value: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return "All months";
  }

  const [yearRaw, monthRaw] = value.split("-");
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, 1);

  return date.toLocaleDateString("en-PH", {
    month: "short",
    year: "numeric",
  });
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

  const currentReturnTo = buildExpensesPageUrl(filters);
  const scopeLabel = canChooseBranch
    ? filters.branch === "all"
      ? "All branches"
      : branchOptions.find((option) => String(option.branch_id) === filters.branch)?.branch_name ?? "Selected branch"
    : fixedBranchName ?? "Assigned branch";
  const monthLabel = formatMonthLabel(filters.month);
  const categoryLabel = filters.category === "all" ? "All categories" : filters.category;

  return (
    <div className="w-full max-w-none space-y-5 px-4 pb-6 pt-1 sm:px-6 sm:pb-6 sm:pt-2">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="bg-gradient-to-r from-slate-50 via-background to-emerald-50/60 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Expenses</h1>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Badge className="border-zinc-200 bg-background/80 text-zinc-700" variant="outline">
                  {results.totalExpenses} matches
                </Badge>
                <Badge className="border-zinc-200 bg-background/80 text-zinc-700" variant="outline">
                  {scopeLabel}
                </Badge>
                <Badge className="border-zinc-200 bg-background/80 text-zinc-700" variant="outline">
                  {monthLabel}
                </Badge>
                <Badge className="border-zinc-200 bg-background/80 text-zinc-700" variant="outline">
                  {categoryLabel}
                </Badge>
              </div>
            </div>

            {canCreateExpense ? (
              <Link href={appendBackNavigationToHref("/dashboard/expenses/create", {
                source: "expenses",
                returnTo: currentReturnTo,
              })}>
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                  size="sm"
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  Create expense
                </Button>
              </Link>
            ) : null}
          </div>
        </div>

        <div className="border-t border-border/70 px-6 pb-4 pt-3">
          <ExpensesFilters
            branches={branchOptions}
            canChooseBranch={canChooseBranch}
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
        </div>
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
