import type { AnalyticsDateRangeKey, AnalyticsSelectOption } from "@/components/analytics/types";
import type { CollectionsDateRange, CollectionsFilterState, CollectionsPageProps } from "@/app/dashboard/collections/types";

export const COLLECTIONS_DATE_RANGE_OPTIONS: AnalyticsSelectOption[] = [
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-30-days", label: "Last 30 Days" },
  { value: "past-3-months", label: "Past 3 Months" },
  { value: "past-6-months", label: "Past 6 Months" },
  { value: "this-year", label: "This Year" },
  { value: "lifetime", label: "Lifetime" },
];

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parsePositiveInt(value: string | undefined) {
  return /^\d+$/.test(String(value ?? "")) ? Number(value) : null;
}

function normalizeRange(
  value: string | undefined,
  fromRaw: string,
  toRaw: string,
): AnalyticsDateRangeKey {
  if (value === "custom" && isIsoDate(fromRaw) && isIsoDate(toRaw)) {
    return "custom";
  }

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

function addMonths(dateString: string, amount: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 10);
}

function firstDayOfMonth(dateString: string) {
  return `${dateString.slice(0, 7)}-01`;
}

function firstDayOfYear(dateString: string) {
  return `${dateString.slice(0, 4)}-01-01`;
}

function lastDayOfMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
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

function formatMonthLabel(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}-01T00:00:00.000Z`));
}

function isExactMonthRange(from: string, to: string) {
  if (!isIsoDate(from) || !isIsoDate(to)) {
    return null;
  }

  if (from.slice(0, 7) !== to.slice(0, 7) || !from.endsWith("-01")) {
    return null;
  }

  const today = toManilaDate();
  const monthValue = from.slice(0, 7);
  const expectedEnd = monthValue === today.slice(0, 7) ? today : lastDayOfMonth(monthValue);

  if (to !== expectedEnd) {
    return null;
  }

  return monthValue;
}

function isExactYearRange(from: string, to: string) {
  if (!isIsoDate(from) || !isIsoDate(to)) {
    return null;
  }

  const year = from.slice(0, 4);
  if (from !== `${year}-01-01`) {
    return null;
  }

  const today = toManilaDate();
  const expectedEnd = year === today.slice(0, 4) ? today : `${year}-12-31`;

  if (to !== expectedEnd) {
    return null;
  }

  return Number(year);
}

export function buildCollectionsMonthRange(year: number, month: number) {
  const monthValue = `${year}-${String(month).padStart(2, "0")}`;
  const start = `${monthValue}-01`;
  const today = toManilaDate();
  const end = monthValue === today.slice(0, 7) ? today : lastDayOfMonth(monthValue);

  return {
    range: "custom" as const,
    from: start,
    to: end,
  };
}

export function buildCollectionsYearRange(year: number) {
  const today = toManilaDate();
  const end = String(year) === today.slice(0, 4) ? today : `${year}-12-31`;

  return {
    range: "custom" as const,
    from: `${year}-01-01`,
    to: end,
  };
}

export function resolveCollectionsMinimumYear() {
  return Number(toManilaDate().slice(0, 4)) - 10;
}

export function resolveCollectionsPeriodTriggerLabel(params: {
  range: CollectionsFilterState["selectedRange"];
  from?: string;
  to?: string;
}) {
  if (params.range === "custom" && params.from && params.to) {
    const monthValue = isExactMonthRange(params.from, params.to);
    if (monthValue) {
      return formatMonthLabel(monthValue);
    }

    const yearValue = isExactYearRange(params.from, params.to);
    if (yearValue) {
      return `Year: ${yearValue}`;
    }

    return "Custom Range";
  }

  return COLLECTIONS_DATE_RANGE_OPTIONS.find((option) => option.value === params.range)?.label ?? "This Month";
}

export function parseCollectionsFilters(
  params: Awaited<CollectionsPageProps["searchParams"]> | Record<string, string | undefined>,
): CollectionsFilterState & { requestedBranchId: number | null } {
  const fromRaw = isIsoDate(String(params?.from ?? "")) ? String(params?.from) : "";
  const toRaw = isIsoDate(String(params?.to ?? "")) ? String(params?.to) : "";

  return {
    requestedBranchId: parsePositiveInt(params?.branch),
    selectedBranchRaw: String(params?.branch ?? ""),
    selectedRange: normalizeRange(params?.range, fromRaw, toRaw),
    fromRaw,
    toRaw,
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
      label: resolveCollectionsPeriodTriggerLabel({
        range: "custom",
        from: start,
        to: end,
      }).toLowerCase(),
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

  if (filters.selectedRange === "past-3-months") {
    return {
      start: addMonths(today, -3),
      end: today,
      label: "past 3 months",
      granularity: "month",
    };
  }

  if (filters.selectedRange === "past-6-months") {
    return {
      start: addMonths(today, -6),
      end: today,
      label: "past 6 months",
      granularity: "month",
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

  if (filters.selectedRange === "lifetime") {
    return {
      start: "2000-01-01",
      end: today,
      label: "lifetime",
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
