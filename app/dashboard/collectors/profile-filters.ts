import { resolveCollectorsDateRange } from "@/app/dashboard/collectors/filters";
import type {
  CollectorProfilePeriodKey,
  CollectorsDateRange,
  CollectorsFilterState,
} from "@/app/dashboard/collectors/types";

export const COLLECTOR_PROFILE_PERIOD_OPTIONS: Array<{
  value: CollectorProfilePeriodKey;
  label: string;
}> = [
  { value: "this-month", label: "This Month" },
  { value: "last-30-days", label: "Last 30 Days" },
  { value: "this-year", label: "This Year" },
  { value: "lifetime", label: "Lifetime" },
];

function todayInManila() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

export function parseCollectorProfilePeriod(value: string | undefined): CollectorProfilePeriodKey {
  return COLLECTOR_PROFILE_PERIOD_OPTIONS.some((option) => option.value === value)
    ? (value as CollectorProfilePeriodKey)
    : "this-month";
}

export function buildCollectorsFiltersForProfilePeriod(periodKey: CollectorProfilePeriodKey): CollectorsFilterState {
  if (periodKey === "lifetime") {
    return {
      selectedBranchRaw: "all",
      selectedRange: "custom",
      fromRaw: "1900-01-01",
      toRaw: todayInManila(),
      searchQuery: "",
      page: 1,
    };
  }

  return {
    selectedBranchRaw: "all",
    selectedRange: periodKey,
    fromRaw: "",
    toRaw: "",
    searchQuery: "",
    page: 1,
  };
}

export function resolveCollectorProfilePeriodLabel(periodKey: CollectorProfilePeriodKey) {
  return COLLECTOR_PROFILE_PERIOD_OPTIONS.find((option) => option.value === periodKey)?.label ?? "This Month";
}

export function resolveCollectorProfileDateRange(periodKey: CollectorProfilePeriodKey): CollectorsDateRange | null {
  if (periodKey === "lifetime") {
    return null;
  }

  return resolveCollectorsDateRange(buildCollectorsFiltersForProfilePeriod(periodKey));
}
