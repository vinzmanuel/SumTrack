"use client";

import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";

export function AnalyticsChartCard({
  title,
  description,
  filters,
  chart,
  isPending,
  errorMessage,
  noData,
  noDataMessage,
}: {
  title: string;
  description: string;
  filters: ReactNode;
  chart: ReactNode;
  isPending: boolean;
  errorMessage?: string | null;
  noData: boolean;
  noDataMessage: string;
}) {
  return (
    <TremorCard className="min-h-[470px] p-6">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
            <TremorDescription className="text-[13px]">{description}</TremorDescription>
          </div>
          <div className="w-full xl:max-w-3xl">{filters}</div>
        </div>

        <div className="relative space-y-4">
          <div className={isPending ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
            {chart}
          </div>
          {isPending ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/40 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm text-muted-foreground shadow-sm">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Updating chart
              </div>
            </div>
          ) : null}
          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          {noData ? <p className="text-sm text-muted-foreground">{noDataMessage}</p> : null}
        </div>
      </div>
    </TremorCard>
  );
}
