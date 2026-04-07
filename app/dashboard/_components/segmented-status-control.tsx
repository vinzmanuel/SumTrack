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
        "inline-flex flex-wrap items-center gap-2",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === selectedValue;

        return (
          <button
            className={cn(
              "inline-flex rounded-md px-4 py-2 text-sm font-medium transition-all duration-150",
              active
                ? option.tone === "active"
                  ? "bg-green-500/20 text-green-800 dark:bg-green-500/20 dark:text-green-500"
                  : "bg-amber-200/40 text-amber-700 dark:bg-amber-300/20 dark:text-amber-400"
                : "bg-transparent text-foreground/72 hover:bg-zinc-200/70 hover:text-foreground dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100",
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
