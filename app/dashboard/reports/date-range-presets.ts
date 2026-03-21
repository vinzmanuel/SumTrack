import type { ReportsDateRangePreset } from "@/app/dashboard/reports/types";

export const REPORTS_DATE_RANGE_PRESET_OPTIONS: Array<{
  value: ReportsDateRangePreset;
  label: string;
}> = [
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "past_30_days", label: "Past 30 Days" },
  { value: "past_6_months", label: "Past 6 Months" },
  { value: "this_year", label: "This Year" },
  { value: "lifetime", label: "Lifetime" },
  { value: "custom", label: "Custom" },
];

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function todayInManila() {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "Asia/Manila",
    }),
  );
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

export function getReportsDatePresetLabel(preset: ReportsDateRangePreset) {
  return (
    REPORTS_DATE_RANGE_PRESET_OPTIONS.find((option) => option.value === preset)?.label ??
    "Custom"
  );
}

export function isReportsCustomDatePreset(preset: ReportsDateRangePreset) {
  return preset === "custom";
}

export function resolveReportsDatePresetRange(preset: ReportsDateRangePreset) {
  const today = todayInManila();
  const todayValue = formatLocalDate(today);

  if (preset === "custom") {
    return {
      dateFrom: null,
      dateTo: null,
      label: "Custom",
    };
  }

  if (preset === "lifetime") {
    return {
      dateFrom: null,
      dateTo: null,
      label: "Lifetime",
    };
  }

  if (preset === "this_week") {
    const start = new Date(today);
    const day = start.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + mondayOffset);

    return {
      dateFrom: formatLocalDate(start),
      dateTo: todayValue,
      label: "This Week",
    };
  }

  if (preset === "this_month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      dateFrom: formatLocalDate(start),
      dateTo: todayValue,
      label: "This Month",
    };
  }

  if (preset === "past_30_days") {
    return {
      dateFrom: formatLocalDate(addDays(today, -29)),
      dateTo: todayValue,
      label: "Past 30 Days",
    };
  }

  if (preset === "past_6_months") {
    return {
      dateFrom: formatLocalDate(addMonths(today, -6)),
      dateTo: todayValue,
      label: "Past 6 Months",
    };
  }

  const start = new Date(today.getFullYear(), 0, 1);
  return {
    dateFrom: formatLocalDate(start),
    dateTo: todayValue,
    label: "This Year",
  };
}

export function parseReportsDateRangePreset(
  value: string | string[] | undefined,
): ReportsDateRangePreset | null {
  const nextValue = Array.isArray(value) ? value[0] : value;

  if (
    nextValue === "this_week" ||
    nextValue === "this_month" ||
    nextValue === "past_30_days" ||
    nextValue === "past_6_months" ||
    nextValue === "this_year" ||
    nextValue === "lifetime" ||
    nextValue === "custom"
  ) {
    return nextValue;
  }

  return null;
}
