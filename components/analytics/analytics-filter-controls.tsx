"use client";

import { useEffect, useRef, type ReactNode, type SelectHTMLAttributes } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { AnalyticsDateRangeKey, AnalyticsSelectOption } from "@/components/analytics/types";

const selectClassName =
  "border-input bg-background text-foreground h-10 w-full rounded-lg border px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

export function AnalyticsSelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: AnalyticsSelectOption[];
  onChange: SelectHTMLAttributes<HTMLSelectElement>["onChange"];
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <select className={selectClassName} onChange={onChange} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AnalyticsDateRangeFilter({
  label,
  value,
  from,
  to,
  options,
  isOpen,
  onOpenChange,
  onRangeChange,
  onFromChange,
  onToChange,
}: {
  label: string;
  value: AnalyticsDateRangeKey;
  from: string;
  to: string;
  options: AnalyticsSelectOption[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRangeChange: (value: AnalyticsDateRangeKey) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handlePointerDown);
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen, onOpenChange]);

  return (
    <div className="relative" ref={panelRef}>
      <label className="grid gap-2 text-sm font-medium">
        {label}
        <select
          className={selectClassName}
          onChange={(event) => onRangeChange(event.target.value as AnalyticsDateRangeKey)}
          onClick={() => {
            if (value === "custom") {
              onOpenChange(true);
            }
          }}
          value={value}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {value === "custom" && isOpen ? (
        <div className="absolute left-0 top-full z-20 mt-2 w-[280px] rounded-xl border bg-background p-3 shadow-lg">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <CalendarDays className="h-4 w-4" />
            Custom range
          </div>
          <div className="grid gap-3">
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              From
              <Input onChange={(event) => onFromChange(event.target.value)} type="date" value={from} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
              To
              <Input onChange={(event) => onToChange(event.target.value)} type="date" value={to} />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button onClick={() => onOpenChange(false)} size="sm" type="button" variant="outline">
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AnalyticsFilterBar({
  controls,
  action,
}: {
  controls: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="grid flex-1 gap-3 md:grid-cols-2 xl:max-w-2xl xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {controls}
      </div>
      {action}
    </div>
  );
}
