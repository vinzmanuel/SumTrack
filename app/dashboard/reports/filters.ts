import type {
  ReportsCreateTab,
  ReportsLibraryGeneratedTypeFilter,
  ReportsLibraryGeneratedDatePreset,
  ReportsLibraryCategoryTab,
  ReportsLibraryFilterState,
  ReportsLibraryStatusTab,
} from "@/app/dashboard/reports/types";

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function allValues(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

function parseIntegerArray(value: string | string[] | undefined) {
  return allValues(value)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function parseNullableDate(value: string | string[] | undefined) {
  const nextValue = firstValue(value)?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(nextValue) ? nextValue : null;
}

function parseGeneratedType(
  value: string | string[] | undefined,
): ReportsLibraryGeneratedTypeFilter {
  const nextValue = firstValue(value);
  return nextValue === "user" || nextValue === "system" ? nextValue : "all";
}

function parseGeneratedDatePreset(
  value: string | string[] | undefined,
): ReportsLibraryGeneratedDatePreset {
  const nextValue = firstValue(value);

  if (
    nextValue === "today" ||
    nextValue === "this_week" ||
    nextValue === "this_month" ||
    nextValue === "this_year" ||
    nextValue === "custom"
  ) {
    return nextValue;
  }

  return "all";
}

function parseNullableString(value: string | string[] | undefined) {
  const nextValue = firstValue(value)?.trim() ?? "";
  return nextValue.length > 0 ? nextValue : null;
}

export function createDefaultReportsLibraryFilters(): ReportsLibraryFilterState {
  return {
    category: "all",
    status: "active",
    templateKey: null,
    generatedType: "all",
    generatedByRoleName: null,
    generatedByUserId: null,
    branchIds: [],
    generatedDatePreset: "all",
    generatedDateFrom: null,
    generatedDateTo: null,
    coverageDateFrom: null,
    coverageDateTo: null,
  };
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
  const generatedDateFrom = parseNullableDate(searchParams.generatedFrom);
  const generatedDateTo = parseNullableDate(searchParams.generatedTo);
  const generatedDatePreset = parseGeneratedDatePreset(searchParams.generatedPreset);

  return {
    category: parseReportsLibraryCategoryTab(searchParams.category),
    status: parseReportsLibraryStatusTab(searchParams.status),
    templateKey: parseNullableString(searchParams.template),
    generatedType: parseGeneratedType(searchParams.generatedType),
    generatedByRoleName: parseNullableString(searchParams.generatedByRole),
    generatedByUserId: parseNullableString(searchParams.generatedBy),
    branchIds: parseIntegerArray(searchParams.branch),
    generatedDatePreset:
      generatedDatePreset !== "all"
        ? generatedDatePreset
        : generatedDateFrom || generatedDateTo
          ? "custom"
          : "all",
    generatedDateFrom,
    generatedDateTo,
    coverageDateFrom: parseNullableDate(searchParams.coverageFrom),
    coverageDateTo: parseNullableDate(searchParams.coverageTo),
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

  if (filters.templateKey) {
    search.set("template", filters.templateKey);
  }

  if (filters.generatedType !== "all") {
    search.set("generatedType", filters.generatedType);
  }

  if (filters.generatedByRoleName) {
    search.set("generatedByRole", filters.generatedByRoleName);
  }

  if (filters.generatedByUserId) {
    search.set("generatedBy", filters.generatedByUserId);
  }

  for (const branchId of filters.branchIds) {
    search.append("branch", String(branchId));
  }

  if (filters.generatedDatePreset !== "all" && filters.generatedDatePreset !== "custom") {
    search.set("generatedPreset", filters.generatedDatePreset);
  }

  if (filters.generatedDateFrom) {
    search.set("generatedFrom", filters.generatedDateFrom);
  }

  if (filters.generatedDateTo) {
    search.set("generatedTo", filters.generatedDateTo);
  }

  if (filters.coverageDateFrom) {
    search.set("coverageFrom", filters.coverageDateFrom);
  }

  if (filters.coverageDateTo) {
    search.set("coverageTo", filters.coverageDateTo);
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
