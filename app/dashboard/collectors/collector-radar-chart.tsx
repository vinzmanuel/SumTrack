"use client";

import { useSyncExternalStore } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { CollectorRadarMetric } from "@/app/dashboard/collectors/types";
import { cn } from "@/lib/utils";

export function CollectorRadarChart({
  metrics,
  className,
}: {
  metrics: CollectorRadarMetric[];
  className?: string;
}) {
  const hasMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!hasMounted) {
    return <div className={cn("h-[280px] w-full animate-pulse rounded-xl bg-muted/70", className)} />;
  }

  return (
    <div className={cn("h-[280px] w-full", className)}>
      <ResponsiveContainer height="100%" width="100%">
        <RadarChart data={metrics} outerRadius="72%">
          <PolarGrid stroke="#d4d4d8" />
          <PolarAngleAxis dataKey="label" tick={{ fill: "#52525b", fontSize: 11 }} />
          <Radar
            dataKey="value"
            fill="#818cf8"
            fillOpacity={0.24}
            stroke="#4f46e5"
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
