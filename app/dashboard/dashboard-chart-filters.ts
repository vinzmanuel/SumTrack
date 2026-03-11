import { todayInManila } from "@/app/dashboard/overview-format";
import type {
  DashboardChartDateRange,
  DashboardChartFilters,
  DashboardChartPageProps,
} from "@/app/dashboard/dashboard-chart-types";
import type { AnalyticsDateRangeKey } from "@/components/analytics/types";

function parsePositiveInt(value: string | undefined) {
  return /^\d+$/.test(String(value ?? "")) ? Number(value) : null;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, amount: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function startOfWeek(value: Date) {
  const day = value.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(value, offset);
}

function startOfMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function startOfYear(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function differenceInDays(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export const DASHBOARD_DATE_RANGE_OPTIONS: Array<{ value: AnalyticsDateRangeKey; label: string }> = [
  { value: "this-week", label: "This Week" },
  { value: "this-month", label: "This Month" },
  { value: "last-30-days", label: "Last 30 Days" },
  { value: "this-year", label: "This Year" },
  { value: "custom", label: "Custom" },
];

export function parseDashboardChartFilters(
  params: Awaited<DashboardChartPageProps["searchParams"]>,
): DashboardChartFilters {
  const selectedRange: AnalyticsDateRangeKey =
    params?.range === "this-week" ||
    params?.range === "this-month" ||
    params?.range === "last-30-days" ||
    params?.range === "this-year" ||
    params?.range === "custom"
      ? params.range
      : "this-month";

  return {
    selectedBranchRaw: params?.branch ?? "all",
    selectedRange,
    fromRaw: params?.from ?? "",
    toRaw: params?.to ?? "",
  };
}

export function resolveDashboardChartDateRange(filters: DashboardChartFilters): DashboardChartDateRange {
  const today = parseIsoDate(todayInManila());
  let start = startOfMonth(today);
  let end = today;

  if (filters.selectedRange === "this-week") {
    start = startOfWeek(today);
  } else if (filters.selectedRange === "last-30-days") {
    start = addDays(today, -29);
  } else if (filters.selectedRange === "this-year") {
    start = startOfYear(today);
  } else if (filters.selectedRange === "custom") {
    const from = isIsoDate(filters.fromRaw) ? parseIsoDate(filters.fromRaw) : null;
    const to = isIsoDate(filters.toRaw) ? parseIsoDate(filters.toRaw) : null;

    if (from && to && from.getTime() <= to.getTime()) {
      start = from;
      end = to;
    }
  }

  return {
    start: formatIsoDate(start),
    end: formatIsoDate(end),
    granularity: filters.selectedRange === "this-year" || differenceInDays(start, end) > 62 ? "month" : "day",
    label:
      filters.selectedRange === "this-week"
        ? "This Week"
        : filters.selectedRange === "this-month"
          ? "This Month"
          : filters.selectedRange === "last-30-days"
            ? "Last 30 Days"
            : filters.selectedRange === "this-year"
              ? "This Year"
              : "Custom Range",
  };
}

export function resolveSelectedBranchId(rawValue: string) {
  return parsePositiveInt(rawValue);
}
