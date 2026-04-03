import type { AnalyticsDateRangeKey, AnalyticsSelectOption } from "@/components/analytics/types";
import type {
  CollectorLeaderboardBasis,
  CollectorsDateRange,
  CollectorsFilterState,
  CollectorsPageProps,
} from "@/app/dashboard/collectors/types";

export const COLLECTORS_DATE_RANGE_OPTIONS: AnalyticsSelectOption[] = [
  { value: "last-30-days", label: "Past 30 days" },
  { value: "this-month", label: "This month" },
  { value: "past-3-months", label: "Past 3 months" },
  { value: "past-6-months", label: "Past 6 months" },
  { value: "this-year", label: "This year" },
  { value: "lifetime", label: "Lifetime" },
];

export function supportsAverageMonthlyCollections(range: AnalyticsDateRangeKey) {
  return (
    range === "past-3-months" ||
    range === "past-6-months" ||
    range === "this-year" ||
    range === "lifetime"
  );
}

function formatMonthLabel(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}-01T00:00:00.000Z`));
}

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

  return COLLECTORS_DATE_RANGE_OPTIONS.some((option) => option.value === value)
    ? (value as AnalyticsDateRangeKey)
    : "this-month";
}

function normalizeBasis(value: string | undefined): CollectorLeaderboardBasis {
  if (value === "total-collected" || value === "average-monthly-collections" || value === "incentives") {
    return value;
  }

  return "average-monthly-collections";
}

function normalizePageSize(value: string | undefined) {
  const parsed = parsePositiveInt(value);
  if (parsed === 20 || parsed === 50) {
    return parsed;
  }

  return 10;
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

function lastDayOfMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
}

function addMonths(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function isExactMonthRange(from: string, to: string) {
  if (!isIsoDate(from) || !isIsoDate(to)) {
    return null;
  }

  if (from.slice(0, 7) !== to.slice(0, 7) || !from.endsWith("-01")) {
    return null;
  }

  const today = todayInManila();
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

  const today = todayInManila();
  const expectedEnd = year === today.slice(0, 4) ? today : `${year}-12-31`;

  if (to !== expectedEnd) {
    return null;
  }

  return Number(year);
}

export function isCollectorsSpecificMonthSelection(params: {
  range: AnalyticsDateRangeKey;
  from?: string;
  to?: string;
}) {
  return params.range === "custom" && Boolean(params.from && params.to && isExactMonthRange(params.from, params.to));
}

export function isCollectorsSpecificYearSelection(params: {
  range: AnalyticsDateRangeKey;
  from?: string;
  to?: string;
}) {
  return params.range === "custom" && Boolean(params.from && params.to && isExactYearRange(params.from, params.to));
}

export function isCollectorsSpecificPeriodSelection(params: {
  range: AnalyticsDateRangeKey;
  from?: string;
  to?: string;
}) {
  return isCollectorsSpecificMonthSelection(params) || isCollectorsSpecificYearSelection(params);
}

export function buildCollectorsMonthRange(year: number, month: number) {
  const monthValue = `${year}-${String(month).padStart(2, "0")}`;
  const start = `${monthValue}-01`;
  const today = todayInManila();
  const end = monthValue === today.slice(0, 7) ? today : lastDayOfMonth(monthValue);

  return {
    range: "custom" as const,
    from: start,
    to: end,
  };
}

export function buildCollectorsYearRange(year: number) {
  const today = todayInManila();
  const end = String(year) === today.slice(0, 4) ? today : `${year}-12-31`;

  return {
    range: "custom" as const,
    from: `${year}-01-01`,
    to: end,
  };
}

export function resolveCollectorsPeriodTriggerLabel(params: {
  range: AnalyticsDateRangeKey;
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

  return COLLECTORS_DATE_RANGE_OPTIONS.find((option) => option.value === params.range)?.label ?? "This month";
}

export function supportsAverageMonthlyCollectionsSelection(params: {
  range: AnalyticsDateRangeKey;
  from?: string;
  to?: string;
}) {
  if (params.range !== "custom") {
    return supportsAverageMonthlyCollections(params.range);
  }

  return Boolean(params.from && params.to && isExactYearRange(params.from, params.to));
}

export function supportsIncentivesSelection(params: {
  range: AnalyticsDateRangeKey;
  from?: string;
  to?: string;
}) {
  if (
    params.range === "this-month" ||
    params.range === "past-3-months" ||
    params.range === "past-6-months" ||
    params.range === "this-year" ||
    params.range === "lifetime"
  ) {
    return true;
  }

  if (params.range !== "custom") {
    return false;
  }

  return Boolean(
    params.from &&
    params.to &&
    (isExactMonthRange(params.from, params.to) || isExactYearRange(params.from, params.to)),
  );
}

export function resolveCollectorsMinimumYear() {
  return Number(todayInManila().slice(0, 4)) - 10;
}

export function parseCollectorsFilters(
  params: Awaited<CollectorsPageProps["searchParams"]> | Record<string, string | undefined>,
): CollectorsFilterState & { requestedBranchId: number | null } {
  const fromRaw = isIsoDate(String(params?.from ?? "")) ? String(params?.from) : "";
  const toRaw = isIsoDate(String(params?.to ?? "")) ? String(params?.to) : "";
  const selectedRange = normalizeRange(params?.range, fromRaw, toRaw);
  const selectedBasis = normalizeBasis(params?.basis);

  return {
    requestedBranchId: parsePositiveInt(params?.branch),
    selectedBranchRaw: String(params?.branch ?? "all"),
    selectedRange,
    fromRaw,
    toRaw,
    searchQuery: normalizeQuery(params?.query),
    selectedBasis:
      selectedBasis === "average-monthly-collections" &&
      !supportsAverageMonthlyCollectionsSelection({
        range: selectedRange,
        from: fromRaw,
        to: toRaw,
      })
        ? "total-collected"
        : selectedBasis === "incentives" &&
            !supportsIncentivesSelection({
              range: selectedRange,
              from: fromRaw,
              to: toRaw,
            })
          ? "total-collected"
          : selectedBasis,
    page: Math.max(parsePositiveInt(params?.page) ?? 1, 1),
    pageSize: normalizePageSize(params?.pageSize),
  };
}

export function resolveCollectorsDateRange(filters: CollectorsFilterState): CollectorsDateRange {
  const today = todayInManila();

  if (filters.selectedRange === "custom" && filters.fromRaw && filters.toRaw) {
    const start = filters.fromRaw <= filters.toRaw ? filters.fromRaw : filters.toRaw;
    const end = filters.fromRaw <= filters.toRaw ? filters.toRaw : filters.fromRaw;
    return {
      start,
      end,
      label: resolveCollectorsPeriodTriggerLabel({
        range: "custom",
        from: start,
        to: end,
      }).toLowerCase(),
    };
  }

  if (filters.selectedRange === "this-week") {
    return { start: startOfWeek(today), end: today, label: "this week" };
  }

  if (filters.selectedRange === "last-30-days") {
    return { start: addDays(today, -29), end: today, label: "last 30 days" };
  }

  if (filters.selectedRange === "past-3-months") {
    return { start: addMonths(today, -3), end: today, label: "past 3 months" };
  }

  if (filters.selectedRange === "past-6-months") {
    return { start: addMonths(today, -6), end: today, label: "past 6 months" };
  }

  if (filters.selectedRange === "this-year") {
    return { start: firstDayOfYear(today), end: today, label: "this year" };
  }

  if (filters.selectedRange === "lifetime") {
    return { start: "2000-01-01", end: today, label: "lifetime" };
  }

  return { start: firstDayOfMonth(today), end: today, label: "this month" };
}
