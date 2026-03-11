"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { useOnWindowResize } from "@/components/tremor/raw/use-on-window-resize";
import {
  formatChartAxisMoney,
  formatChartMoney,
  getChartSeriesColor,
  type TremorChartDatum,
} from "@/components/tremor/raw/chart-utils";

export function TremorAreaChart({
  className,
  data,
  index,
  categories,
  colors,
  showLegend = true,
}: {
  className?: string;
  data: TremorChartDatum[];
  index: string;
  categories: string[];
  colors?: string[];
  showLegend?: boolean;
}) {
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const hasMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const handleResize = useCallback(() => {
    setIsSmallScreen(window.innerWidth < 768);
  }, []);

  useOnWindowResize(handleResize);

  const resolvedColors = useMemo(
    () => categories.map((_, index) => colors?.[index] ?? getChartSeriesColor(index)),
    [categories, colors],
  );
  const gradientIds = useMemo(
    () => categories.map((category) => `tremor-area-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`),
    [categories],
  );

  if (!hasMounted) {
    return <div className={cn("h-[320px] w-full animate-pulse rounded-xl bg-muted/70", className)} />;
  }

  return (
    <div className={cn("flex h-[320px] w-full flex-col md:h-[360px]", className)}>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer height="100%" width="100%">
          <RechartsAreaChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
            <defs>
              {categories.map((category, index) => (
                <linearGradient id={gradientIds[index]} key={category} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor={resolvedColors[index]} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={resolvedColors[index]} stopOpacity={0.04} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey={index}
              minTickGap={24}
              tick={{ fill: "#6b7280", fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              tick={{ fill: "#6b7280", fontSize: 12 }}
              tickFormatter={(value) => formatChartAxisMoney(Number(value ?? 0))}
              tickLine={false}
              width={isSmallScreen ? 62 : 82}
            />
            <Tooltip
              content={<AreaChartTooltip activeCategory={activeCategory} />}
              cursor={{ stroke: "#d4d4d8", strokeDasharray: "4 4" }}
            />
            {categories.map((key, idx) => {
              const isDimmed = activeCategory !== null && activeCategory !== key;

              return (
                <Area
                  dataKey={key}
                  dot={false}
                  fill={`url(#${gradientIds[idx]})`}
                  key={key}
                  opacity={isDimmed ? 0.62 : 1}
                  stroke={resolvedColors[idx]}
                  strokeOpacity={isDimmed ? 0.6 : 1}
                  strokeWidth={activeCategory === key ? 3 : 2}
                  type="monotone"
                />
              );
            })}
          </RechartsAreaChart>
        </ResponsiveContainer>
      </div>
      {showLegend ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 pt-2">
          {categories.map((category, index) => {
            const isActive = activeCategory === category;
            const isDimmed = activeCategory !== null && activeCategory !== category;

            return (
              <button
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors",
                  isActive ? "border-foreground/20 bg-muted text-foreground" : "border-transparent text-muted-foreground",
                  isDimmed ? "opacity-75" : "opacity-100",
                )}
                key={category}
                onClick={() => setActiveCategory((current) => (current === category ? null : category))}
                type="button"
              >
                <span
                  className="inline-block h-2.5 w-5 rounded-full"
                  style={{ backgroundColor: resolvedColors[index] }}
                />
                <span>{category}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function AreaChartTooltip({
  active,
  label,
  payload,
  activeCategory,
}: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    color?: string;
    dataKey?: string | number;
    name?: string | number;
    value?: string | number;
  }>;
  activeCategory?: string | null;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const visiblePayload = activeCategory
    ? payload.filter((entry) => String(entry.dataKey ?? "") === activeCategory)
    : payload;

  return (
    <div className="min-w-44 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
      <p className="mb-2 text-sm font-medium text-foreground">{String(label ?? "")}</p>
      <div className="space-y-1.5">
        {visiblePayload.map((entry) => (
          <div className="flex items-center justify-between gap-4 text-sm" key={String(entry.dataKey)}>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color ?? "#22c55e" }}
              />
              <span>{String(entry.name ?? entry.dataKey ?? "")}</span>
            </div>
            <span className="font-medium text-foreground">{formatChartMoney(Number(entry.value ?? 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
