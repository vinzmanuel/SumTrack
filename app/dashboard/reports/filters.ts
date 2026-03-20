import type {
  ReportsCreateTab,
  ReportsLibraryCategoryTab,
  ReportsLibraryFilterState,
  ReportsLibraryStatusTab,
} from "@/app/dashboard/reports/types";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseReportsLibraryCategoryTab(
  value: string | string[] | undefined,
): ReportsLibraryCategoryTab {
  const nextValue = firstValue(value);

  if (nextValue === "analytics" || nextValue === "documents") {
    return nextValue;
  }

  return "all";
}

export function parseReportsLibraryStatusTab(
  value: string | string[] | undefined,
): ReportsLibraryStatusTab {
  return firstValue(value) === "archived" ? "archived" : "active";
}

export function parseReportsLibraryFilters(searchParams: Record<string, string | string[] | undefined>) {
  return {
    category: parseReportsLibraryCategoryTab(searchParams.category),
    status: parseReportsLibraryStatusTab(searchParams.status),
  } satisfies ReportsLibraryFilterState;
}

export function buildReportsLibraryHref(filters: ReportsLibraryFilterState) {
  const search = new URLSearchParams();

  if (filters.category !== "all") {
    search.set("category", filters.category);
  }

  if (filters.status !== "active") {
    search.set("status", filters.status);
  }

  const query = search.toString();
  return query ? `/dashboard/reports?${query}` : "/dashboard/reports";
}

export function parseReportsCreateTab(
  value: string | string[] | undefined,
): ReportsCreateTab {
  return firstValue(value) === "documents" ? "documents" : "analytics";
}

export function buildReportsCreateHref(tab: ReportsCreateTab) {
  if (tab === "analytics") {
    return "/dashboard/reports/create";
  }

  return "/dashboard/reports/create?tab=documents";
}
