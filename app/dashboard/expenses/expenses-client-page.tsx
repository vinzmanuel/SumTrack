"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BanknoteArrowDown, Plus } from "lucide-react";
import { appendBackNavigationToHref } from "@/app/dashboard/back-navigation";
import { resolveCollectionsPeriodTriggerLabel } from "@/app/dashboard/collections/filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EXPENSES_PAGE_SIZE_OPTIONS, EXPENSE_CATEGORIES } from "@/app/dashboard/expenses/filters";
import { ExpensesAnalyticsSection } from "@/app/dashboard/expenses/expenses-analytics-section";
import { ExpensesResultsSection } from "@/app/dashboard/expenses/expenses-results-section";
import type {
  ExpenseBranchOption,
  ExpensesFilterInput,
  ExpensesResultsData,
} from "@/app/dashboard/expenses/types";

const ExpensesFilters = dynamic(
  () => import("@/app/dashboard/expenses/expenses-filters").then((module) => module.ExpensesFilters),
  { ssr: false },
);

type ExpensesClientPageProps = {
  branchOptions: ExpenseBranchOption[];
  canChooseBranch: boolean;
  canCreateExpense: boolean;
  description: string;
  fixedBranchName: string | null;
  initialFilters: ExpensesFilterInput;
  initialResults: ExpensesResultsData;
};

type ExpensesWorkspaceTab = "records" | "analytics";

function filtersEqual(left: ExpensesFilterInput, right: ExpensesFilterInput) {
  return (
    left.branch === right.branch &&
    left.range === right.range &&
    left.from === right.from &&
    left.to === right.to &&
    left.category === right.category &&
    left.page === right.page &&
    left.pageSize === right.pageSize
  );
}

function buildExpensesPageUrl(filters: ExpensesFilterInput) {
  const params = new URLSearchParams();

  if (filters.branch && filters.branch !== "all") {
    params.set("branch", filters.branch);
  }

  if (filters.range !== "this-month") {
    params.set("range", filters.range);
  }

  if (filters.range === "custom" && filters.from && filters.to) {
    params.set("from", filters.from);
    params.set("to", filters.to);
  }

  if (filters.category && filters.category !== "all") {
    params.set("category", filters.category);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  if (filters.pageSize !== EXPENSES_PAGE_SIZE_OPTIONS[1]) {
    params.set("pageSize", String(filters.pageSize));
  }

  const queryString = params.toString();
  return queryString ? `/dashboard/expenses?${queryString}` : "/dashboard/expenses";
}

function buildExpensesDataUrl(
  filters: ExpensesFilterInput,
  options?: { includeAnalytics?: boolean },
) {
  const params = new URLSearchParams();

  if (filters.branch && filters.branch !== "all") {
    params.set("branch", filters.branch);
  }

  if (filters.range !== "this-month") {
    params.set("range", filters.range);
  }

  if (filters.range === "custom" && filters.from && filters.to) {
    params.set("from", filters.from);
    params.set("to", filters.to);
  }

  if (filters.category && filters.category !== "all") {
    params.set("category", filters.category);
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  if (filters.pageSize !== EXPENSES_PAGE_SIZE_OPTIONS[1]) {
    params.set("pageSize", String(filters.pageSize));
  }

  if (options?.includeAnalytics) {
    params.set("analytics", "1");
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
      range: initialFilters.range,
      from: initialFilters.from,
      to: initialFilters.to,
      category: initialFilters.category,
      page: initialResults.page,
      pageSize: initialResults.pageSize,
    }),
    [
      initialFilters.branch,
      initialFilters.range,
      initialFilters.from,
      initialFilters.to,
      initialFilters.category,
      initialResults.page,
      initialResults.pageSize,
    ],
  );

  const [results, setResults] = useState(initialResults);
  const [filters, setFilters] = useState<ExpensesFilterInput>(normalizedInitialFilters);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ExpensesWorkspaceTab>("records");
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const loadedRequestUrlRef = useRef(buildExpensesDataUrl(normalizedInitialFilters, { includeAnalytics: false }));

  const loadResults = useCallback(async (
    nextFilters: ExpensesFilterInput,
    options?: { force?: boolean; includeAnalytics?: boolean },
  ) => {
    const requestUrl = buildExpensesDataUrl(nextFilters, {
      includeAnalytics: options?.includeAnalytics,
    });
    if (!options?.force && requestUrl === loadedRequestUrlRef.current) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    abortRef.current = controller;
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(requestUrl, {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Unable to load expenses.");
      }

      const nextData = (await response.json()) as ExpensesResultsData;
      if (requestIdRef.current !== requestId) {
        return;
      }

      const normalizedFilters = {
        branch: nextFilters.branch,
        range: nextFilters.range,
        from: nextFilters.from,
        to: nextFilters.to,
        category: nextFilters.category,
        page: nextData.page,
        pageSize: nextData.pageSize,
      };
      setResults(nextData);
      loadedRequestUrlRef.current = buildExpensesDataUrl(normalizedFilters, {
        includeAnalytics: options?.includeAnalytics,
      });
      setFilters((current) => (filtersEqual(current, normalizedFilters) ? current : normalizedFilters));
      window.history.replaceState(null, "", buildExpensesPageUrl(normalizedFilters));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      if (requestIdRef.current !== requestId) {
        return;
      }

      setErrorMessage("Unable to refresh expense records right now.");
    } finally {
      if (abortRef.current === controller && requestIdRef.current === requestId) {
        setIsPending(false);
      }
    }
  }, []);

  useEffect(() => {
    setResults(initialResults);
    setFilters(normalizedInitialFilters);
    setErrorMessage(null);
    loadedRequestUrlRef.current = buildExpensesDataUrl(normalizedInitialFilters, {
      includeAnalytics: false,
    });
  }, [initialResults, normalizedInitialFilters]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    void loadResults(filters, { includeAnalytics: activeTab === "analytics" });
  }, [activeTab, filters, loadResults]);

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
      range: "this-month",
      from: "",
      to: "",
      category: "all",
      page: 1,
      pageSize: normalizedInitialFilters.pageSize,
    });
  }, [canChooseBranch, normalizedInitialFilters.branch, normalizedInitialFilters.pageSize]);

  const currentReturnTo = buildExpensesPageUrl(filters);
  const scopeLabel = canChooseBranch
    ? filters.branch === "all"
      ? "All branches"
      : branchOptions.find((option) => String(option.branch_id) === filters.branch)?.branch_name ?? "Selected branch"
    : fixedBranchName ?? "Assigned branch";
  const periodLabel = resolveCollectionsPeriodTriggerLabel({
    range: filters.range,
    from: filters.from,
    to: filters.to,
  });
  const categoryLabel = filters.category === "all" ? "All categories" : filters.category;

  return (
    <div className="w-full max-w-none space-y-5 pb-6 pt-1 sm:pb-6 sm:pt-2">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="bg-gradient-to-r from-slate-50 via-background to-emerald-50/60 p-6 dark:from-zinc-950 dark:via-background dark:to-emerald-950/45">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1">
              <div className="space-y-1">
                <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-foreground">
                  <BanknoteArrowDown className="size-7 text-muted-foreground" />
                  Expenses
                </h1>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Badge
                  className="border-zinc-200 bg-background/80 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100"
                  variant="outline"
                >
                  {results.totalExpenses} matches
                </Badge>
                <Badge
                  className="border-zinc-200 bg-background/80 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100"
                  variant="outline"
                >
                  {scopeLabel}
                </Badge>
                <Badge
                  className="border-zinc-200 bg-background/80 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100"
                  variant="outline"
                >
                  {periodLabel}
                </Badge>
                <Badge
                  className="border-zinc-200 bg-background/80 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100"
                  variant="outline"
                >
                  {categoryLabel}
                </Badge>
              </div>
            </div>

            {canCreateExpense && activeTab === "records" ? (
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
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="inline-flex shrink-0 flex-nowrap gap-2 rounded-xl border border-border/70 bg-muted/30 p-1">
              <WorkspaceTabButton
                active={activeTab === "records"}
                label="Records"
                onClick={() => setActiveTab("records")}
              />
              <WorkspaceTabButton
                active={activeTab === "analytics"}
                label="Analytics"
                onClick={() => setActiveTab("analytics")}
              />
            </div>

            <ExpensesFilters
              branches={branchOptions}
              canChooseBranch={canChooseBranch}
              categories={EXPENSE_CATEGORIES}
              isPending={isPending}
              onBranchChange={(value) => updateFilters({ branch: value })}
              onCategoryChange={(value) => updateFilters({ category: value })}
              onClear={handleClear}
              onPeriodChange={(value) =>
                updateFilters({
                  range: value.range,
                  from: value.from,
                  to: value.to,
                })}
              selectedBranchRaw={filters.branch}
              selectedCategory={filters.category}
              selectedRange={filters.range}
              fromRaw={filters.from}
              toRaw={filters.to}
            />
          </div>
        </div>
      </Card>

      {activeTab === "records" ? (
          <ExpensesResultsSection
            data={results}
            errorMessage={errorMessage}
            isPending={isPending}
            onPageChange={(page) => updateFilters({ page })}
            onPageSizeChange={(pageSize) => updateFilters({ pageSize })}
          />
      ) : null}

      {activeTab === "analytics" ? (
          <ExpensesAnalyticsSection
            data={results}
            isMultiBranchScope={canChooseBranch && filters.branch === "all"}
            isPending={isPending}
          />
      ) : null}
    </div>
  );
}

function WorkspaceTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
