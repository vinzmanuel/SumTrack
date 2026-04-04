"use client";

import { useMemo, useState } from "react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalyticsDateRangeKey } from "@/components/analytics/types";
import type { ExpenseBranchOption } from "@/app/dashboard/expenses/types";

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

type ExpensesPeriodPanelMode = "presets" | "month" | "year";

type ExpensesFiltersProps = {
  canChooseBranch: boolean;
  isPending: boolean;
  selectedBranchRaw: string;
  selectedRange: AnalyticsDateRangeKey;
  fromRaw: string;
  toRaw: string;
  selectedCategory: string;
  branches: ExpenseBranchOption[];
  categories: readonly string[];
  onBranchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onClear: () => void;
  onPeriodChange: (value: { range: AnalyticsDateRangeKey; from: string; to: string }) => void;
};

export function ExpensesFilters({
  canChooseBranch,
  isPending,
  selectedBranchRaw,
  selectedRange,
  fromRaw,
  toRaw,
  selectedCategory,
  branches,
  categories,
  onBranchChange,
  onCategoryChange,
  onClear,
  onPeriodChange,
}: ExpensesFiltersProps) {
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<ExpensesPeriodPanelMode>("presets");
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
    from: fromRaw,
    to: toRaw,
  });
  const resolvedMonthYear = availableYears.includes(selectedMonthYear) ? selectedMonthYear : availableYears[0];
  const resolvedYearValue =
    selectedRange === "custom" && /^(\d{4})-01-01$/.test(fromRaw)
      ? String(Number(fromRaw.slice(0, 4)) || currentYear)
      : "";

  return (
    <div className="flex w-full justify-end">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
        {canChooseBranch ? (
          <label className="w-full space-y-1 sm:w-[240px]">
            <Label htmlFor="branch">Branch</Label>
            <Select
              disabled={isPending}
              onValueChange={onBranchChange}
              value={selectedBranchRaw}
            >
              <SelectTrigger id="branch" className="w-full">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Branches</SelectLabel>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches.map((item) => (
                    <SelectItem key={item.branch_id} value={String(item.branch_id)}>
                      {item.branch_name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </label>
        ) : null}

        <div className="w-full sm:w-[240px]">
          <div className="flex flex-col gap-1">
            <Label htmlFor="expenses-period">Period</Label>
            <Popover
              onOpenChange={(nextOpen) => {
                setIsPeriodOpen(nextOpen);

                if (!nextOpen) {
                  return;
                }

                if (selectedRange === "custom" && /^(\d{4})-\d{2}-01$/.test(fromRaw) && fromRaw.slice(0, 4) === toRaw.slice(0, 4)) {
                  setSelectedMonthYear(Number(fromRaw.slice(0, 4)) || currentYear);
                  setPanelMode("month");
                  return;
                }

                if (selectedRange === "custom" && fromRaw.endsWith("-01-01")) {
                  setSelectedMonthYear(Number(fromRaw.slice(0, 4)) || currentYear);
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
                  id="expenses-period"
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

                  <Tabs onValueChange={(value) => setPanelMode(value as ExpensesPeriodPanelMode)} value={panelMode}>
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
                            onPeriodChange({
                              range: option.value as AnalyticsDateRangeKey,
                              from: "",
                              to: "",
                            });
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
                            fromRaw === nextRange.from &&
                            toRaw === nextRange.to;

                          return (
                            <Button
                              disabled={disabled}
                              key={month.value}
                              onClick={() => {
                                onPeriodChange({
                                  range: nextRange.range,
                                  from: nextRange.from,
                                  to: nextRange.to,
                                });
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
                            onPeriodChange({
                              range: nextRange.range,
                              from: nextRange.from,
                              to: nextRange.to,
                            });
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

        <label className="w-full space-y-1 sm:w-[240px]">
          <Label htmlFor="category">Category</Label>
          <Select
            disabled={isPending}
            onValueChange={onCategoryChange}
            value={selectedCategory}
          >
            <SelectTrigger id="category" className="w-full">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Categories</SelectLabel>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>

        <div className="flex items-end">
          <Button className="h-9 active:scale-[0.98]" onClick={onClear} type="button" variant="outline">
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
