import {
  parseReportsDateRangePreset,
  resolveReportsDatePresetRange,
} from "@/app/dashboard/reports/date-range-presets";
import type {
  ReportsCreateTab,
  ReportsLibraryGeneratedTypeFilter,
  ReportsLibraryCategoryTab,
  ReportsLibraryFilterState,
  ReportsLibraryStatusTab,
  ReportsTemplateCategoryKey,
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

function parsePositivePage(value: string | string[] | undefined) {
  const nextValue = Number(firstValue(value));
  return Number.isInteger(nextValue) && nextValue > 0 ? nextValue : 1;
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

function parseNullableString(value: string | string[] | undefined) {
  const nextValue = firstValue(value)?.trim() ?? "";
  return nextValue.length > 0 ? nextValue : null;
}

function parseTemplateCategory(
  value: string | string[] | undefined,
): ReportsTemplateCategoryKey | null {
  const nextValue = firstValue(value);

  if (
    nextValue === "financials" ||
    nextValue === "collections" ||
    nextValue === "loans" ||
    nextValue === "borrowers" ||
    nextValue === "branches" ||
    nextValue === "collectors" ||
    nextValue === "documents"
  ) {
    return nextValue;
  }

  return null;
}

export function createDefaultReportsLibraryFilters(): ReportsLibraryFilterState {
  return {
    category: "all",
    status: "active",
    page: 1,
    templateCategory: null,
    templateKey: null,
    generatedType: "all",
    generatedByRoleName: null,
    generatedByUserId: null,
    branchIds: [],
    generatedDatePreset: "lifetime",
    generatedDateFrom: null,
    generatedDateTo: null,
    coverageDatePreset: "lifetime",
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
  const generatedDatePresetRaw = parseReportsDateRangePreset(searchParams.generatedPreset);
  const generatedDatePreset =
    generatedDatePresetRaw ??
    (generatedDateFrom || generatedDateTo ? "custom" : "lifetime");
  const resolvedGeneratedDates =
    generatedDatePreset !== "custom"
      ? resolveReportsDatePresetRange(generatedDatePreset)
      : { dateFrom: generatedDateFrom, dateTo: generatedDateTo };
  const coverageDateFrom = parseNullableDate(searchParams.coverageFrom);
  const coverageDateTo = parseNullableDate(searchParams.coverageTo);
  const coverageDatePresetRaw = parseReportsDateRangePreset(searchParams.coveragePreset);
  const coverageDatePreset =
    coverageDatePresetRaw ??
    (coverageDateFrom || coverageDateTo ? "custom" : "lifetime");
  const resolvedCoverageDates =
    coverageDatePreset !== "custom"
      ? resolveReportsDatePresetRange(coverageDatePreset)
      : { dateFrom: coverageDateFrom, dateTo: coverageDateTo };

  return {
    category: parseReportsLibraryCategoryTab(searchParams.category),
    status: parseReportsLibraryStatusTab(searchParams.status),
    page: parsePositivePage(searchParams.page),
    templateCategory: parseTemplateCategory(searchParams.templateCategory),
    templateKey: parseNullableString(searchParams.template),
    generatedType: parseGeneratedType(searchParams.generatedType),
    generatedByRoleName: parseNullableString(searchParams.generatedByRole),
    generatedByUserId: parseNullableString(searchParams.generatedBy),
    branchIds: parseIntegerArray(searchParams.branch),
    generatedDatePreset,
    generatedDateFrom: resolvedGeneratedDates.dateFrom,
    generatedDateTo: resolvedGeneratedDates.dateTo,
    coverageDatePreset,
    coverageDateFrom: resolvedCoverageDates.dateFrom,
    coverageDateTo: resolvedCoverageDates.dateTo,
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

  if (filters.page > 1) {
    search.set("page", String(filters.page));
  }

  if (filters.templateCategory) {
    search.set("templateCategory", filters.templateCategory);
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

  if (filters.generatedDatePreset !== "custom") {
    search.set("generatedPreset", filters.generatedDatePreset);
  }

  if (filters.generatedDatePreset === "custom" && filters.generatedDateFrom) {
    search.set("generatedFrom", filters.generatedDateFrom);
  }

  if (filters.generatedDatePreset === "custom" && filters.generatedDateTo) {
    search.set("generatedTo", filters.generatedDateTo);
  }

  if (filters.coverageDatePreset !== "custom") {
    search.set("coveragePreset", filters.coverageDatePreset);
  }

  if (filters.coverageDatePreset === "custom" && filters.coverageDateFrom) {
    search.set("coverageFrom", filters.coverageDateFrom);
  }

  if (filters.coverageDatePreset === "custom" && filters.coverageDateTo) {
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
