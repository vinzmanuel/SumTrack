import type { DashboardAuthContext } from "@/app/dashboard/auth";
import {
  buildCollectionsMonthRange,
  resolveCollectionsDateRange,
} from "@/app/dashboard/collections/filters";
import type { AnalyticsDateRangeKey } from "@/components/analytics/types";
import type { ExpensesFiltersState, ExpensesPageAccessState, ExpensesPageProps } from "@/app/dashboard/expenses/types";

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Electricity",
  "Water",
  "Transportation",
  "Lunch",
  "Salary",
  "Miscellaneous",
] as const;

export const EXPENSES_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const DEFAULT_EXPENSES_PAGE_SIZE = 20;

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeRange(
  value: string | undefined,
  fromRaw: string,
  toRaw: string,
): AnalyticsDateRangeKey {
  if (value === "custom" && isIsoDate(fromRaw) && isIsoDate(toRaw)) {
    return "custom";
  }

  return [
    "this-week",
    "this-month",
    "last-30-days",
    "past-3-months",
    "past-6-months",
    "this-year",
    "lifetime",
  ].includes(String(value))
    ? (value as AnalyticsDateRangeKey)
    : "this-month";
}

export function parseExpensesFilters(
  params: Awaited<ExpensesPageProps["searchParams"]> | Record<string, string | undefined>,
): ExpensesFiltersState {
  const selectedBranchRaw = String(params?.branch ?? "all");
  const selectedCategoryRaw = String(params?.category ?? "all");
  const pageSizeRaw = String(params?.pageSize ?? "");
  const parsedPageSize = /^\d+$/.test(pageSizeRaw) ? Number(pageSizeRaw) : DEFAULT_EXPENSES_PAGE_SIZE;
  const pageSize = EXPENSES_PAGE_SIZE_OPTIONS.includes(parsedPageSize as (typeof EXPENSES_PAGE_SIZE_OPTIONS)[number])
    ? parsedPageSize
    : DEFAULT_EXPENSES_PAGE_SIZE;
  const fromRaw = isIsoDate(String(params?.from ?? "")) ? String(params?.from) : "";
  const toRaw = isIsoDate(String(params?.to ?? "")) ? String(params?.to) : "";
  const legacyMonthRaw = String(params?.month ?? "");
  const selectedRange = normalizeRange(params?.range, fromRaw, toRaw);
  const legacyMonthRange = /^\d{4}-\d{2}$/.test(legacyMonthRaw)
    ? buildCollectionsMonthRange(Number(legacyMonthRaw.slice(0, 4)), Number(legacyMonthRaw.slice(5, 7)))
    : null;
  const resolvedRange = selectedRange === "this-month" && !fromRaw && !toRaw && legacyMonthRange ? "custom" : selectedRange;
  const resolvedFromRaw = resolvedRange === "custom" && !fromRaw && !toRaw && legacyMonthRange ? legacyMonthRange.from : fromRaw;
  const resolvedToRaw = resolvedRange === "custom" && !fromRaw && !toRaw && legacyMonthRange ? legacyMonthRange.to : toRaw;
  const dateRange = resolveCollectionsDateRange({
    selectedBranchRaw,
    selectedRange: resolvedRange,
    fromRaw: resolvedFromRaw,
    toRaw: resolvedToRaw,
  });

  return {
    selectedBranchRaw,
    selectedRange: resolvedRange,
    fromRaw: resolvedFromRaw,
    toRaw: resolvedToRaw,
    selectedCategory: EXPENSE_CATEGORIES.includes(
      selectedCategoryRaw as (typeof EXPENSE_CATEGORIES)[number],
    )
      ? selectedCategoryRaw
      : "all",
    page: Math.max(/^\d+$/.test(String(params?.page ?? "")) ? Number(params?.page) : 1, 1),
    pageSize,
    dateRange,
  };
}

export function resolveExpensesPageAccess(
  auth: DashboardAuthContext,
  filters: ExpensesFiltersState,
): ExpensesPageAccessState {
  const isAdmin = auth.roleName === "Admin";
  const isBranchManager = auth.roleName === "Branch Manager";
  const isAuditor = auth.roleName === "Auditor";

  if (!isAdmin && !isBranchManager && !isAuditor) {
    return {
      view: "forbidden",
      message: "You are logged in, but only Admin, Branch Manager, and Auditor users can view expenses.",
    };
  }

  if (isBranchManager && !auth.activeBranchId) {
    return {
      view: "branch_error",
      message: "No active branch assignment found.",
    };
  }

  const selectedBranchId =
    (isAdmin || isAuditor) && /^\d+$/.test(filters.selectedBranchRaw)
      ? Number(filters.selectedBranchRaw)
      : null;

  return {
    view: "ready",
    isAdmin,
    isBranchManager,
    isAuditor,
    canChooseBranch: isAdmin || isAuditor,
    canCreateExpense: isAdmin || isBranchManager,
    selectedBranchRaw: filters.selectedBranchRaw,
    selectedRange: filters.selectedRange,
    fromRaw: filters.fromRaw,
    toRaw: filters.toRaw,
    selectedCategory: filters.selectedCategory,
    page: filters.page,
    pageSize: filters.pageSize,
    dateRange: filters.dateRange,
    fixedBranchName: isBranchManager ? auth.activeBranchName : null,
    resolvedBranchId: isBranchManager
      ? auth.activeBranchId
      : isAuditor
        ? (selectedBranchId && auth.assignedBranchIds.includes(selectedBranchId) ? selectedBranchId : null)
        : selectedBranchId,
    assignedBranchIds: isAuditor ? auth.assignedBranchIds : [],
  };
}
