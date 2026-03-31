"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    color?: string;
  };
};

type ChartContextValue = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("Chart components must be used inside a ChartContainer.");
  }

  return context;
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
  }
>(({ className, config, children, ...props }, ref) => {
  const style = React.useMemo(
    () =>
      Object.fromEntries(
        Object.entries(config).flatMap(([key, value]) =>
          value.color ? [[`--color-${key}`, value.color]] : [],
        ),
      ) as React.CSSProperties,
    [config],
  );

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        className={cn(
          "h-[300px] w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/70 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted/40 [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector:focus-visible]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        ref={ref}
        style={style}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "ChartContainer";

const ChartTooltip = RechartsPrimitive.Tooltip;
const ChartLegend = RechartsPrimitive.Legend;

function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{
    color?: string;
    dataKey?: string | number;
    name?: string | number;
    value?: string | number;
  }>;
  label?: string | number;
  className?: string;
  formatter?: (value: number | string | undefined) => string;
}) {
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className={cn("min-w-44 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur", className)}>
      {label ? <p className="mb-2 text-sm font-medium text-foreground">{String(label)}</p> : null}
      <div className="space-y-1.5">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name ?? "");
          const entry = config[key];
          return (
            <div className="flex items-center justify-between gap-4 text-sm" key={key}>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: item.color ?? entry?.color ?? "#16a34a" }}
                />
                <span>{entry?.label ?? item.name ?? key}</span>
              </div>
              <span className="font-medium text-foreground">
                {formatter ? formatter(item.value) : String(item.value ?? 0)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChartLegendContent({
  className,
  payload,
}: React.ComponentProps<"div"> & {
  payload?: ReadonlyArray<{
    color?: string;
    dataKey?: string | number;
    value?: string;
  }>;
}) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-4", className)}>
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.value ?? "");
        const entry = config[key];
        return (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" key={key}>
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color ?? entry?.color ?? "#16a34a" }}
            />
            <span>{entry?.label ?? item.value ?? key}</span>
          </div>
        );
      })}
    </div>
  );
}

export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
};
