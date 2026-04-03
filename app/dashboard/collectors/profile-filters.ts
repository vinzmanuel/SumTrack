import { resolveCollectorsDateRange } from "@/app/dashboard/collectors/filters";
import {
  supportsAverageMonthlyCollectionsSelection,
  supportsIncentivesSelection,
} from "@/app/dashboard/collectors/filters";
import type {
  CollectorLeaderboardBasis,
  CollectorProfilePeriodKey,
  CollectorProfilePresetPeriodKey,
  CollectorsDateRange,
  CollectorsFilterState,
} from "@/app/dashboard/collectors/types";

export const COLLECTOR_PROFILE_PERIOD_OPTIONS: Array<{
  value: CollectorProfilePresetPeriodKey;
  label: string;
}> = [
  { value: "this-month", label: "This Month" },
  { value: "last-30-days", label: "Last 30 Days" },
  { value: "past-3-months", label: "Past 3 Months" },
  { value: "past-6-months", label: "Past 6 Months" },
  { value: "this-year", label: "This Year" },
  { value: "lifetime", label: "Lifetime" },
];

export function isCollectorProfilePresetPeriod(periodKey: CollectorProfilePeriodKey): periodKey is CollectorProfilePresetPeriodKey {
  return COLLECTOR_PROFILE_PERIOD_OPTIONS.some((option) => option.value === periodKey);
}

function todayInManila() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function thisMonthInManila() {
  return todayInManila().slice(0, 7);
}

function currentYearInManila() {
  return Number(todayInManila().slice(0, 4));
}

function lastDayOfMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0));
  return date.toISOString().slice(0, 10);
}

function isMonthToken(value: string | undefined): value is `month:${number}-${number}` {
  return /^month:\d{4}-\d{2}$/.test(String(value ?? ""));
}

function isYearToken(value: string | undefined): value is `year:${number}` {
  return /^year:\d{4}$/.test(String(value ?? ""));
}

export function isCollectorProfileMonthPeriod(periodKey: CollectorProfilePeriodKey) {
  return isMonthToken(periodKey);
}

export function isCollectorProfileYearPeriod(periodKey: CollectorProfilePeriodKey) {
  return isYearToken(periodKey);
}

export function buildCollectorProfileMonthPeriod(year: number, month: number): CollectorProfilePeriodKey {
  return `month:${year}-${String(month).padStart(2, "0")}` as CollectorProfilePeriodKey;
}

export function buildCollectorProfileYearPeriod(year: number): CollectorProfilePeriodKey {
  return `year:${year}` as CollectorProfilePeriodKey;
}

function parseCollectorProfileMonthValue(periodKey: CollectorProfilePeriodKey) {
  if (!isCollectorProfileMonthPeriod(periodKey)) {
    return null;
  }

  const value = periodKey.slice("month:".length);
  const [year, month] = value.split("-").map(Number);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return {
    year,
    month,
    monthValue: value,
  };
}

function parseCollectorProfileYearValue(periodKey: CollectorProfilePeriodKey) {
  if (!isCollectorProfileYearPeriod(periodKey)) {
    return null;
  }

  const year = Number(periodKey.slice("year:".length));
  return Number.isInteger(year) ? year : null;
}

export function parseCollectorProfilePeriod(value: string | undefined): CollectorProfilePeriodKey {
  if (COLLECTOR_PROFILE_PERIOD_OPTIONS.some((option) => option.value === value)) {
    return value as CollectorProfilePeriodKey;
  }

  if (isMonthToken(value)) {
    const parsed = parseCollectorProfileMonthValue(value);
    return parsed ? value : "this-month";
  }

  if (isYearToken(value)) {
    const parsed = parseCollectorProfileYearValue(value);
    return parsed ? value : "this-month";
  }

  return "this-month";
}

export function buildCollectorsFiltersForProfilePeriod(periodKey: CollectorProfilePeriodKey): CollectorsFilterState {
  if (periodKey === "lifetime") {
    return {
      selectedBranchRaw: "all",
      selectedRange: "custom",
      fromRaw: "1900-01-01",
      toRaw: todayInManila(),
      searchQuery: "",
      selectedBasis: "average-monthly-collections",
      page: 1,
      pageSize: 10,
    };
  }

  const monthValue = parseCollectorProfileMonthValue(periodKey);
  if (monthValue) {
    const start = `${monthValue.monthValue}-01`;
    const end = monthValue.monthValue === thisMonthInManila()
      ? todayInManila()
      : lastDayOfMonth(monthValue.monthValue);

    return {
      selectedBranchRaw: "all",
      selectedRange: "custom",
      fromRaw: start,
      toRaw: end,
      searchQuery: "",
      selectedBasis: "average-monthly-collections",
      page: 1,
      pageSize: 10,
    };
  }

  const yearValue = parseCollectorProfileYearValue(periodKey);
  if (yearValue) {
    const currentYear = currentYearInManila();
    const start = `${yearValue}-01-01`;
    const end = yearValue === currentYear ? todayInManila() : `${yearValue}-12-31`;

    return {
      selectedBranchRaw: "all",
      selectedRange: "custom",
      fromRaw: start,
      toRaw: end,
      searchQuery: "",
      selectedBasis: "average-monthly-collections",
      page: 1,
      pageSize: 10,
    };
  }

  if (!isCollectorProfilePresetPeriod(periodKey)) {
    return buildCollectorsFiltersForProfilePeriod("this-month");
  }

  return {
    selectedBranchRaw: "all",
    selectedRange: periodKey,
    fromRaw: "",
    toRaw: "",
    searchQuery: "",
    selectedBasis: "average-monthly-collections",
    page: 1,
    pageSize: 10,
  };
}

export function resolveCollectorProfilePeriodLabel(periodKey: CollectorProfilePeriodKey) {
  const monthValue = parseCollectorProfileMonthValue(periodKey);
  if (monthValue) {
    return new Intl.DateTimeFormat("en-PH", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${monthValue.monthValue}-01T00:00:00.000Z`));
  }

  const yearValue = parseCollectorProfileYearValue(periodKey);
  if (yearValue) {
    return String(yearValue);
  }

  return COLLECTOR_PROFILE_PERIOD_OPTIONS.find((option) => option.value === periodKey)?.label ?? "This Month";
}

export function resolveCollectorProfilePeriodTriggerLabel(periodKey: CollectorProfilePeriodKey) {
  const yearValue = parseCollectorProfileYearValue(periodKey);
  if (yearValue) {
    return `Year: ${yearValue}`;
  }

  return resolveCollectorProfilePeriodLabel(periodKey);
}

export function resolveCollectorProfileSelectedBasis(
  periodKey: CollectorProfilePeriodKey,
  basisRaw: string | undefined,
): CollectorLeaderboardBasis {
  const normalizedBasis =
    basisRaw === "total-collected" || basisRaw === "average-monthly-collections" || basisRaw === "incentives"
      ? basisRaw
      : "average-monthly-collections";
  const periodFilters = buildCollectorsFiltersForProfilePeriod(periodKey);
  const periodParams = {
    range: periodFilters.selectedRange,
    from: periodFilters.fromRaw,
    to: periodFilters.toRaw,
  };

  if (
    normalizedBasis === "average-monthly-collections" &&
    !supportsAverageMonthlyCollectionsSelection(periodParams)
  ) {
    return "total-collected";
  }

  if (normalizedBasis === "incentives" && !supportsIncentivesSelection(periodParams)) {
    return "total-collected";
  }

  return normalizedBasis;
}

export function resolveCollectorProfileDateRange(periodKey: CollectorProfilePeriodKey): CollectorsDateRange | null {
  if (periodKey === "lifetime") {
    return null;
  }

  return resolveCollectorsDateRange(buildCollectorsFiltersForProfilePeriod(periodKey));
}

export function resolveCollectorProfileMinimumYear(dateCreated: string | null | undefined) {
  const currentYear = currentYearInManila();
  const parsedYear = dateCreated ? Number(dateCreated.slice(0, 4)) : Number.NaN;

  if (Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= currentYear) {
    return parsedYear;
  }

  return currentYear - 10;
}
