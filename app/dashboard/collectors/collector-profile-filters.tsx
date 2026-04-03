"use client";

import { CollectorsPeriodFilter } from "@/app/dashboard/collectors/collectors-period-filter";
import {
  buildCollectorsFiltersForProfilePeriod,
  buildCollectorProfileMonthPeriod,
  buildCollectorProfileYearPeriod,
  resolveCollectorProfileMinimumYear,
} from "@/app/dashboard/collectors/profile-filters";
import type {
  CollectorProfilePeriodAvailability,
  CollectorProfilePeriodKey,
} from "@/app/dashboard/collectors/types";

function mapCollectorsRangeToProfilePeriod(value: {
  range: "this-week" | "last-30-days" | "this-month" | "past-3-months" | "past-6-months" | "this-year" | "lifetime" | "custom";
  from: string;
  to: string;
}): CollectorProfilePeriodKey {
  if (value.range !== "custom") {
    return value.range as CollectorProfilePeriodKey;
  }

  if (
    /^\d{4}-\d{2}-01$/.test(value.from) &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.to) &&
    value.from.slice(0, 7) === value.to.slice(0, 7)
  ) {
    return buildCollectorProfileMonthPeriod(
      Number(value.from.slice(0, 4)),
      Number(value.from.slice(5, 7)),
    );
  }

  if (
    /^\d{4}-01-01$/.test(value.from) &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.to) &&
    value.from.slice(0, 4) === value.to.slice(0, 4)
  ) {
    return buildCollectorProfileYearPeriod(Number(value.from.slice(0, 4)));
  }

  return "this-month";
}

export function CollectorProfileFilters({
  period,
  onPeriodChange,
  minYear,
  periodAvailability,
}: {
  period: CollectorProfilePeriodKey;
  onPeriodChange: (period: CollectorProfilePeriodKey) => void;
  minYear?: number;
  periodAvailability?: CollectorProfilePeriodAvailability;
}) {
  const normalizedMinYear = minYear ?? resolveCollectorProfileMinimumYear(null);
  const periodFilters = buildCollectorsFiltersForProfilePeriod(period);
  const normalizedAvailability = periodAvailability
    ? {
        years: periodAvailability.years,
        monthsByYear: Object.fromEntries(
          periodAvailability.years.map((year) => [
            String(year),
            periodAvailability.monthsByYear[String(year)] ?? [],
          ]),
        ),
      }
    : undefined;

  return (
    <CollectorsPeriodFilter
      from={periodFilters.fromRaw}
      label="Period"
      minimumYear={normalizedMinYear}
      onRangeChange={(value) => {
        onPeriodChange(mapCollectorsRangeToProfilePeriod(value));
      }}
      periodAvailability={normalizedAvailability}
      range={periodFilters.selectedRange}
      to={periodFilters.toRaw}
    />
  );
}
