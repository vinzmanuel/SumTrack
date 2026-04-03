"use client";

import { useMemo, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import {
  buildCollectorsMonthRange,
  buildCollectorsYearRange,
  COLLECTORS_DATE_RANGE_OPTIONS,
  resolveCollectorsMinimumYear,
  resolveCollectorsPeriodTriggerLabel,
} from "@/app/dashboard/collectors/filters";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CollectorProfilePeriodAvailability,
  CollectorsFilterInput,
} from "@/app/dashboard/collectors/types";

const MONTH_OPTIONS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
] as const;

type CollectorsPeriodPanelMode = "presets" | "month" | "year";

export function CollectorsPeriodFilter({
  label,
  range,
  from,
  to,
  onRangeChange,
  showLabel = true,
  periodAvailability,
  minimumYear,
}: {
  label: string;
  range: CollectorsFilterInput["range"];
  from: string;
  to: string;
  onRangeChange: (value: { range: CollectorsFilterInput["range"]; from: string; to: string }) => void;
  showLabel?: boolean;
  periodAvailability?: CollectorProfilePeriodAvailability;
  minimumYear?: number;
}) {
  const [open, setOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<CollectorsPeriodPanelMode>("presets");
  const today = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
      }).format(new Date()),
    [],
  );
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7));
  const fallbackMinimumYear = minimumYear ?? resolveCollectorsMinimumYear();
  const availableYears = useMemo(() => {
    if (periodAvailability) {
      return periodAvailability.years;
    }

    return Array.from(
      { length: Math.max(currentYear - fallbackMinimumYear + 1, 1) },
      (_, index) => currentYear - index,
    );
  }, [currentYear, fallbackMinimumYear, periodAvailability]);
  const [selectedMonthYear, setSelectedMonthYear] = useState(currentYear);
  const triggerLabel = resolveCollectorsPeriodTriggerLabel({ from, range, to });
  const resolvedMonthYear = availableYears.length > 0
    ? (availableYears.includes(selectedMonthYear) ? selectedMonthYear : availableYears[0])
    : currentYear;
  const resolvedYearValue =
    range === "custom" && /^(\d{4})-01-01$/.test(from)
      ? String(Number(from.slice(0, 4)) || currentYear)
      : "";
  const availableMonthsForYear = periodAvailability
    ? (periodAvailability.monthsByYear[String(resolvedMonthYear)] ?? [])
    : null;
  const noAvailableYears = availableYears.length === 0;

  return (
    <div className="flex w-full flex-col gap-1 sm:w-[240px]">
      {showLabel ? <Label>{label}</Label> : null}
      <Popover
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);

          if (!nextOpen) {
            return;
          }

          if (range === "custom" && /^(\d{4})-\d{2}-01$/.test(from) && from.slice(0, 4) === to.slice(0, 4)) {
            setSelectedMonthYear(Number(from.slice(0, 4)) || currentYear);
            setPanelMode("month");
            return;
          }

          if (range === "custom" && from.endsWith("-01-01")) {
            setSelectedMonthYear(Number(from.slice(0, 4)) || currentYear);
            setPanelMode("year");
            return;
          }

          setPanelMode("presets");
        }}
        open={open}
      >
        <PopoverTrigger asChild>
          <Button aria-label={label} className="w-full justify-between bg-card font-normal shadow-none" type="button" variant="outline">
            <span className="inline-flex items-center gap-2 truncate">
              <Calendar className="size-4 text-muted-foreground" />
              <span className="truncate">{triggerLabel}</span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[360px] rounded-2xl p-4 sm:w-[420px]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-foreground">Choose period</p>
              <p className="text-xs leading-5 text-muted-foreground">
                Switch between quick presets, a specific month, or a specific year.
              </p>
            </div>

            <Tabs onValueChange={(value) => setPanelMode(value as CollectorsPeriodPanelMode)} value={panelMode}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="presets">Presets</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="year">Year</TabsTrigger>
              </TabsList>
            </Tabs>

            {panelMode === "presets" ? (
              <div className="grid gap-2">
                {COLLECTORS_DATE_RANGE_OPTIONS.map((option) => (
                  <Button
                    className="justify-start"
                    key={option.value}
                    onClick={() => {
                      onRangeChange({
                        range: option.value as CollectorsFilterInput["range"],
                        from: "",
                        to: "",
                      });
                      setOpen(false);
                    }}
                    type="button"
                    variant={range === option.value ? "default" : "outline"}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            ) : null}

            {panelMode === "month" ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">
                    Select year
                  </p>
                  <Select disabled={noAvailableYears} onValueChange={(value) => setSelectedMonthYear(Number(value))} value={noAvailableYears ? "" : String(resolvedMonthYear)}>
                    <SelectTrigger className="w-full bg-card">
                      <SelectValue placeholder={noAvailableYears ? "No years with data" : "Choose a year"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {MONTH_OPTIONS.map((month) => {
                    const nextRange = buildCollectorsMonthRange(resolvedMonthYear, month.value);
                    const disabled =
                      noAvailableYears ||
                      (resolvedMonthYear === currentYear && month.value > currentMonth) ||
                      (availableMonthsForYear !== null && !availableMonthsForYear.includes(month.value));
                    const selected =
                      range === "custom" &&
                      from === nextRange.from &&
                      to === nextRange.to;

                    return (
                      <Button
                        disabled={disabled}
                        key={month.value}
                        onClick={() => {
                          onRangeChange(nextRange);
                          setOpen(false);
                        }}
                        type="button"
                        variant={selected ? "default" : "outline"}
                      >
                        {month.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {panelMode === "year" ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">
                    Select year
                  </p>
                  <Select
                    disabled={noAvailableYears}
                    onValueChange={(value) => {
                      onRangeChange(buildCollectorsYearRange(Number(value)));
                      setOpen(false);
                    }}
                    value={noAvailableYears ? "" : resolvedYearValue}
                  >
                    <SelectTrigger className="w-full bg-card">
                      <SelectValue placeholder={noAvailableYears ? "No years with data" : "Choose a year"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
