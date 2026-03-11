import type { AnalyticsDateRangeKey, AnalyticsSelectOption } from "@/components/analytics/types";
import type { CollectorsDateRange, CollectorsFilterState, CollectorsPageProps } from "@/app/dashboard/collectors/types";

export const COLLECTORS_DATE_RANGE_OPTIONS: AnalyticsSelectOption[] = [
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-30-days", label: "Last 30 Days" },
  { value: "this-year", label: "This Year" },
  { value: "custom", label: "Custom" },
];

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parsePositiveInt(value: string | undefined) {
  return /^\d+$/.test(String(value ?? "")) ? Number(value) : null;
}

function normalizeRange(value: string | undefined): AnalyticsDateRangeKey {
  return COLLECTORS_DATE_RANGE_OPTIONS.some((option) => option.value === value)
    ? (value as AnalyticsDateRangeKey)
    : "this-month";
}

function normalizeQuery(value: string | undefined) {
  return String(value ?? "").trim().slice(0, 100);
}

function todayInManila() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function addDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function firstDayOfMonth(value: string) {
  return `${value.slice(0, 7)}-01`;
}

function firstDayOfYear(value: string) {
  return `${value.slice(0, 4)}-01-01`;
}

function startOfWeek(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function parseCollectorsFilters(
  params: Awaited<CollectorsPageProps["searchParams"]> | Record<string, string | undefined>,
): CollectorsFilterState & { requestedBranchId: number | null } {
  return {
    requestedBranchId: parsePositiveInt(params?.branch),
    selectedBranchRaw: String(params?.branch ?? "all"),
    selectedRange: normalizeRange(params?.range),
    fromRaw: isIsoDate(String(params?.from ?? "")) ? String(params?.from) : "",
    toRaw: isIsoDate(String(params?.to ?? "")) ? String(params?.to) : "",
    searchQuery: normalizeQuery(params?.query),
    page: Math.max(parsePositiveInt(params?.page) ?? 1, 1),
  };
}

export function resolveCollectorsDateRange(filters: CollectorsFilterState): CollectorsDateRange {
  const today = todayInManila();

  if (filters.selectedRange === "custom" && filters.fromRaw && filters.toRaw) {
    const start = filters.fromRaw <= filters.toRaw ? filters.fromRaw : filters.toRaw;
    const end = filters.fromRaw <= filters.toRaw ? filters.toRaw : filters.fromRaw;
    return { start, end, label: "custom range" };
  }

  if (filters.selectedRange === "this-week") {
    return { start: startOfWeek(today), end: today, label: "this week" };
  }

  if (filters.selectedRange === "last-30-days") {
    return { start: addDays(today, -29), end: today, label: "last 30 days" };
  }

  if (filters.selectedRange === "this-year") {
    return { start: firstDayOfYear(today), end: today, label: "this year" };
  }

  return { start: firstDayOfMonth(today), end: today, label: "this month" };
}
