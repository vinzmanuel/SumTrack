"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import {
  buildCollectionsMonthRange,
  buildCollectionsYearRange,
  COLLECTIONS_DATE_RANGE_OPTIONS,
  resolveCollectionsMinimumYear,
  resolveCollectionsPeriodTriggerLabel,
} from "@/app/dashboard/collections/filters";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CollectionsBranchOption,
  CollectionsFilterInput,
  CollectionsFilterState,
} from "@/app/dashboard/collections/types";

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

type CollectionsPeriodPanelMode = "presets" | "month" | "year";

export function CollectionsFilters({
  branchFilterLabel,
  branchOptions,
  canChooseBranch,
  initialFilters,
  isPending,
  onApply,
}: {
  branchFilterLabel: string;
  branchOptions: CollectionsBranchOption[];
  canChooseBranch: boolean;
  initialFilters: CollectionsFilterState;
  isPending: boolean;
  onApply: (filters: CollectionsFilterInput) => Promise<void>;
}) {
  const [selectedBranch, setSelectedBranch] = useState(
    initialFilters.selectedBranchRaw || "all",
  );
  const [selectedRange, setSelectedRange] = useState(initialFilters.selectedRange);
  const [fromValue, setFromValue] = useState(initialFilters.fromRaw);
  const [toValue, setToValue] = useState(initialFilters.toRaw);
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<CollectionsPeriodPanelMode>("presets");
  const hasMountedRef = useRef(false);
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
  const availableYears = useMemo(
    () =>
      Array.from(
        { length: Math.max(currentYear - resolveCollectionsMinimumYear() + 1, 1) },
        (_, index) => currentYear - index,
      ),
    [currentYear],
  );
  const [selectedMonthYear, setSelectedMonthYear] = useState(currentYear);
  const periodLabel = resolveCollectionsPeriodTriggerLabel({
    range: selectedRange,
    from: fromValue,
    to: toValue,
  });
  const resolvedMonthYear = availableYears.includes(selectedMonthYear) ? selectedMonthYear : availableYears[0];
  const resolvedYearValue =
    selectedRange === "custom" && /^(\d{4})-01-01$/.test(fromValue)
      ? String(Number(fromValue.slice(0, 4)) || currentYear)
      : "";

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (selectedRange === "custom" && (!fromValue || !toValue)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void onApply({
        branch: selectedBranch,
        range: selectedRange,
        from: fromValue,
        to: toValue,
      });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [fromValue, onApply, selectedBranch, selectedRange, toValue]);

  return (
    <div className="flex w-full justify-end">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
        <div className="w-full sm:w-[240px]">
          {canChooseBranch ? (
            <label className="flex flex-col gap-1">
              <Label htmlFor="collections-branch">{branchFilterLabel}</Label>
              <Select disabled={isPending} onValueChange={setSelectedBranch} value={selectedBranch}>
                <SelectTrigger id="collections-branch" className="w-full bg-card">
                  <SelectValue placeholder="All visible branches" />
                </SelectTrigger>
                <SelectContent>
                  {branchOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          ) : null}
        </div>

        <div className="w-full sm:w-[240px]">
          <div className="flex flex-col gap-1">
            <Label htmlFor="collections-period">Period</Label>
            <Popover
              onOpenChange={(nextOpen) => {
                setIsPeriodOpen(nextOpen);

                if (!nextOpen) {
                  return;
                }

                if (selectedRange === "custom" && /^(\d{4})-\d{2}-01$/.test(fromValue) && fromValue.slice(0, 4) === toValue.slice(0, 4)) {
                  setSelectedMonthYear(Number(fromValue.slice(0, 4)) || currentYear);
                  setPanelMode("month");
                  return;
                }

                if (selectedRange === "custom" && fromValue.endsWith("-01-01")) {
                  setSelectedMonthYear(Number(fromValue.slice(0, 4)) || currentYear);
                  setPanelMode("year");
                  return;
                }

                setPanelMode("presets");
              }}
              open={isPeriodOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  className="w-full justify-between border-input bg-card font-normal text-foreground hover:bg-card"
                  id="collections-period"
                  type="button"
                  variant="outline"
                >
                  <span className="inline-flex items-center gap-2 truncate">
                    <Calendar className="size-4 text-muted-foreground" />
                    <span className="truncate">{periodLabel}</span>
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

                  <Tabs onValueChange={(value) => setPanelMode(value as CollectionsPeriodPanelMode)} value={panelMode}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="presets">Presets</TabsTrigger>
                      <TabsTrigger value="month">Month</TabsTrigger>
                      <TabsTrigger value="year">Year</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {panelMode === "presets" ? (
                    <div className="grid gap-2">
                      {COLLECTIONS_DATE_RANGE_OPTIONS.map((option) => (
                        <Button
                          className="justify-start"
                          key={option.value}
                          onClick={() => {
                            setSelectedRange(option.value as CollectionsFilterState["selectedRange"]);
                            setFromValue("");
                            setToValue("");
                            setIsPeriodOpen(false);
                          }}
                          type="button"
                          variant={selectedRange === option.value ? "default" : "outline"}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}

                  {panelMode === "month" ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-foreground">Select year</p>
                        <Select onValueChange={(value) => setSelectedMonthYear(Number(value))} value={String(resolvedMonthYear)}>
                          <SelectTrigger className="w-full bg-card">
                            <SelectValue placeholder="Choose a year" />
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
                          const nextRange = buildCollectionsMonthRange(resolvedMonthYear, month.value);
                          const disabled = resolvedMonthYear === currentYear && month.value > currentMonth;
                          const selected =
                            selectedRange === "custom" &&
                            fromValue === nextRange.from &&
                            toValue === nextRange.to;

                          return (
                            <Button
                              disabled={disabled}
                              key={month.value}
                              onClick={() => {
                                setSelectedRange(nextRange.range);
                                setFromValue(nextRange.from);
                                setToValue(nextRange.to);
                                setIsPeriodOpen(false);
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
                        <p className="text-sm font-medium text-foreground">Select year</p>
                        <Select
                          onValueChange={(value) => {
                            const nextRange = buildCollectionsYearRange(Number(value));
                            setSelectedRange(nextRange.range);
                            setFromValue(nextRange.from);
                            setToValue(nextRange.to);
                            setIsPeriodOpen(false);
                          }}
                          value={resolvedYearValue}
                        >
                          <SelectTrigger className="w-full bg-card">
                            <SelectValue placeholder="Choose a year" />
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
        </div>

        <div className="flex justify-end">
          <Button
            disabled={isPending}
            onClick={() => {
              setSelectedBranch(canChooseBranch ? "all" : initialFilters.selectedBranchRaw || "all");
              setSelectedRange("this-month");
              setFromValue("");
              setToValue("");
              setIsPeriodOpen(false);
            }}
            type="button"
            variant="outline"
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}
