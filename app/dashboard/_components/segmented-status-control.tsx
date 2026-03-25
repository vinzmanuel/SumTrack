"use client";

import { cn } from "@/lib/utils";

type SegmentedStatusTone = "active" | "archived";

export type SegmentedStatusOption<TValue extends string> = {
  value: TValue;
  label: string;
  tone: SegmentedStatusTone;
};

export function SegmentedStatusControl<TValue extends string>({
  options,
  selectedValue,
  onChange,
  className,
}: {
  options: SegmentedStatusOption<TValue>[];
  selectedValue: TValue;
  onChange: (value: TValue) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap rounded-xl border border-border/70 bg-muted/25 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_1px_2px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === selectedValue;

        return (
          <button
            className={cn(
              "inline-flex rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150",
              active
                ? option.tone === "active"
                  ? "bg-emerald-50 text-emerald-700 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_6px_14px_rgba(16,185,129,0.12)] ring-1 ring-emerald-200/90"
                  : "bg-amber-50 text-amber-700 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_6px_14px_rgba(245,158,11,0.14)] ring-1 ring-amber-200/90"
                : "bg-transparent text-muted-foreground hover:text-foreground",
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
