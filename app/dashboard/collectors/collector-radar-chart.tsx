"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  ChartsTooltipContainer,
  RadarChart,
  useRadarItemTooltip,
} from "@mui/x-charts";
import type { CollectorRadarMetric } from "@/app/dashboard/collectors/types";
import { cn } from "@/lib/utils";

export function CollectorRadarChart({
  metrics,
  className,
}: {
  metrics: CollectorRadarMetric[];
  className?: string;
}) {
  const [activeMetricLabel, setActiveMetricLabel] = useState(metrics[0]?.label ?? "");
  const hasMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (metrics.some((metric) => metric.label === activeMetricLabel)) {
      return;
    }

    setActiveMetricLabel(metrics[0]?.label ?? "");
  }, [activeMetricLabel, metrics]);

  if (!hasMounted) {
    return <div className={cn("h-[360px] w-full animate-pulse rounded-xl bg-muted/70", className)} />;
  }

  const activeMetric =
    metrics.find((metric) => metric.label === activeMetricLabel) ?? metrics[0] ?? null;

  function CollectorRadarTooltip() {
    const tooltipItem = useRadarItemTooltip();
    const metricLabel = tooltipItem?.values[0]?.label;
    const metric = metrics.find((item) => item.label === metricLabel);

    if (!tooltipItem || !metric) {
      return null;
    }

    return (
      <ChartsTooltipContainer anchor="pointer" position="top" trigger="item">
        <div className="max-w-[240px] rounded-xl border border-border/70 bg-background/95 p-3 shadow-xl backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">
            {metric.label}
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {Math.round(metric.value)}
            <span className="ml-1 text-xs font-medium text-muted-foreground">out of 100</span>
          </p>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">{metric.description}</p>
        </div>
      </ChartsTooltipContainer>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-white via-indigo-50/35 to-sky-50/45 p-3">
        <RadarChart
          height={340}
          hideLegend
          highlight="series"
          margin={{ bottom: 52, left: 54, right: 54, top: 52 }}
          radar={{
            labelGap: 26,
            max: 100,
            metrics: metrics.map((metric) => ({
              max: 100,
              min: 0,
              name: metric.label,
            })),
            startAngle: -90,
          }}
          series={[
            {
              color: "#4f46e5",
              data: metrics.map((metric) => Number(metric.value.toFixed(1))),
              fillArea: true,
              hideMark: false,
              label: "Collector profile",
              valueFormatter: (value) => `${Math.round(value)} / 100`,
            },
          ]}
          slotProps={{
            tooltip: {
              anchor: "pointer",
              position: "top",
              trigger: "item",
            },
          }}
          slots={{
            tooltip: CollectorRadarTooltip,
          }}
          sx={{
            "& .MuiChartsSurface-root": {
              overflow: "visible",
            },
            "& .MuiChartsAxis-tickLabel": {
              fill: "#3f3f46",
              fontSize: 12,
              fontWeight: 600,
            },
            "& .MuiRadarGrid-root path": {
              stroke: "#d4d4d8",
            },
            "& .MuiRadarSeriesPlot-area": {
              fillOpacity: 0.2,
              strokeWidth: 2.5,
            },
            "& .MuiMarkElement-root": {
              fill: "#4f46e5",
              stroke: "#ffffff",
              strokeWidth: 2,
            },
          }}
        />
      </div>

      {activeMetric ? (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/75 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
            {activeMetric.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-indigo-950">{activeMetric.description}</p>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {metrics.map((metric) => {
          const isActive = metric.label === activeMetric?.label;

          return (
            <button
              className={cn(
                "rounded-xl border px-3 py-2 text-left transition-colors",
                isActive
                  ? "border-indigo-300 bg-indigo-50 text-indigo-950"
                  : "border-border/70 bg-background text-foreground hover:border-indigo-200 hover:bg-indigo-50/40",
              )}
              key={metric.label}
              onClick={() => setActiveMetricLabel(metric.label)}
              onFocus={() => setActiveMetricLabel(metric.label)}
              onMouseEnter={() => setActiveMetricLabel(metric.label)}
              type="button"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{metric.label}</span>
                <span className="text-xs font-medium text-muted-foreground">
                  {Math.round(metric.value)}/100
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
