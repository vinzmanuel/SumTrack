import type { AnalyticsDateRangeKey, AnalyticsSelectOption } from "@/components/analytics/types";
import type { CollectionsDateRange, CollectionsFilterState, CollectionsPageProps } from "@/app/dashboard/collections/types";

export const COLLECTIONS_DATE_RANGE_OPTIONS: AnalyticsSelectOption[] = [
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
  return COLLECTIONS_DATE_RANGE_OPTIONS.some((option) => option.value === value)
    ? (value as AnalyticsDateRangeKey)
    : "this-month";
}

function toManilaDate() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function addDays(dateString: string, amount: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function firstDayOfMonth(dateString: string) {
  return `${dateString.slice(0, 7)}-01`;
}

function firstDayOfYear(dateString: string) {
  return `${dateString.slice(0, 4)}-01-01`;
}

function startOfWeek(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function dayDifference(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
}

export function parseCollectionsFilters(
  params: Awaited<CollectionsPageProps["searchParams"]> | Record<string, string | undefined>,
): CollectionsFilterState & { requestedBranchId: number | null } {
  return {
    requestedBranchId: parsePositiveInt(params?.branch),
    selectedBranchRaw: String(params?.branch ?? ""),
    selectedRange: normalizeRange(params?.range),
    fromRaw: isIsoDate(String(params?.from ?? "")) ? String(params?.from) : "",
    toRaw: isIsoDate(String(params?.to ?? "")) ? String(params?.to) : "",
  };
}

export function resolveCollectionsDateRange(filters: CollectionsFilterState): CollectionsDateRange {
  const today = toManilaDate();

  if (filters.selectedRange === "custom" && filters.fromRaw && filters.toRaw) {
    const start = filters.fromRaw <= filters.toRaw ? filters.fromRaw : filters.toRaw;
    const end = filters.fromRaw <= filters.toRaw ? filters.toRaw : filters.fromRaw;
    const duration = dayDifference(start, end);

    return {
      start,
      end,
      label: "custom range",
      granularity: duration > 92 ? "month" : "day",
    };
  }

  if (filters.selectedRange === "this-week") {
    return {
      start: startOfWeek(today),
      end: today,
      label: "this week",
      granularity: "day",
    };
  }

  if (filters.selectedRange === "last-30-days") {
    return {
      start: addDays(today, -29),
      end: today,
      label: "last 30 days",
      granularity: "day",
    };
  }

  if (filters.selectedRange === "this-year") {
    return {
      start: firstDayOfYear(today),
      end: today,
      label: "this year",
      granularity: "month",
    };
  }

  return {
    start: firstDayOfMonth(today),
    end: today,
    label: "this month",
    granularity: "day",
  };
}
