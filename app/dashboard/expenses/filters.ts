import type { DashboardAuthContext } from "@/app/dashboard/auth";
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

function resolveMonthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }

  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const startDate = new Date(Date.UTC(year, monthIndex, 1));

  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const nextMonthDate = new Date(Date.UTC(year, monthIndex + 1, 1));
  const endDate = new Date(nextMonthDate.getTime() - 86400000);

  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  };
}

export function parseExpensesFilters(
  params: Awaited<ExpensesPageProps["searchParams"]> | Record<string, string | undefined>,
): ExpensesFiltersState {
  const selectedBranchRaw = String(params?.branch ?? "all");
  const selectedMonthRaw = String(params?.month ?? "");
  const selectedCategoryRaw = String(params?.category ?? "all");

  return {
    selectedBranchRaw,
    selectedMonthRaw,
    selectedCategory: EXPENSE_CATEGORIES.includes(
      selectedCategoryRaw as (typeof EXPENSE_CATEGORIES)[number],
    )
      ? selectedCategoryRaw
      : "all",
    page: Math.max(/^\d+$/.test(String(params?.page ?? "")) ? Number(params?.page) : 1, 1),
    monthRange: selectedMonthRaw ? resolveMonthRange(selectedMonthRaw) : null,
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
    selectedMonthRaw: filters.selectedMonthRaw,
    selectedCategory: filters.selectedCategory,
    page: filters.page,
    monthRange: filters.monthRange,
    fixedBranchName: isBranchManager ? auth.activeBranchName : null,
    resolvedBranchId: isBranchManager
      ? auth.activeBranchId
      : isAuditor
        ? (selectedBranchId && auth.assignedBranchIds.includes(selectedBranchId) ? selectedBranchId : null)
        : selectedBranchId,
    assignedBranchIds: isAuditor ? auth.assignedBranchIds : [],
  };
}
