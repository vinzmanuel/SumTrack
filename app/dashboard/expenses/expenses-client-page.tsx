"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BarChart3, BanknoteArrowDown, Plus, ReceiptText } from "lucide-react";
import { appendBackNavigationToHref } from "@/app/dashboard/back-navigation";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import {
  getUiTabTriggerClassName,
  UI_FILTER_ROW_CLASS_NAME,
  UI_PAGE_STACK_CLASS_NAME,
  UI_TAB_ICON_ACTIVE_CLASS_NAME,
  UI_TAB_LIST_CLASS_NAME,
  UI_TAB_SEPARATOR_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";
import { Button } from "@/components/ui/button";
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

  return (
    <div className={UI_PAGE_STACK_CLASS_NAME}>
      <DashboardHeaderConfigurator
        config={{
          icon: <BanknoteArrowDown className="size-9 text-sidebar-foreground/65" />,
          title: "Expenses",
          description,
        }}
      />

      <div className={UI_PAGE_STACK_CLASS_NAME}>
        <div className={UI_FILTER_ROW_CLASS_NAME}>
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

          {canCreateExpense && activeTab === "records" ? (
            <div className="flex flex-wrap items-center gap-2.5 xl:justify-end">
              <Link
                href={appendBackNavigationToHref("/dashboard/expenses/create", {
                  source: "expenses",
                  returnTo: currentReturnTo,
                })}
              >
                <Button className="h-11 rounded-md bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700 hover:text-white dark:bg-green-500/60 dark:text-white dark:hover:bg-green-500/80 dark:hover:text-white">
                  <Plus className="h-4 w-4" />
                  Record Expense
                </Button>
              </Link>
            </div>
          ) : null}
        </div>

        <div className={UI_TAB_SEPARATOR_CLASS_NAME}>
          <div className={UI_TAB_LIST_CLASS_NAME}>
            <WorkspaceTabButton
              active={activeTab === "records"}
              icon={<ReceiptText className="size-4" />}
              label="Records"
              onClick={() => setActiveTab("records")}
            />
            <WorkspaceTabButton
              active={activeTab === "analytics"}
              icon={<BarChart3 className="size-4" />}
              label="Analytics"
              onClick={() => setActiveTab("analytics")}
            />
          </div>
        </div>
      </div>

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
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={getUiTabTriggerClassName(active)}
      onClick={onClick}
      type="button"
    >
      <span className={active ? UI_TAB_ICON_ACTIVE_CLASS_NAME : undefined}>{icon}</span>
      {label}
    </button>
  );
}
