"use client";

import { Button } from "@/components/ui/button";
import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { CollectorsChartCard } from "@/app/dashboard/collectors/collectors-chart-card";
import { CollectorsComparisonCard } from "@/app/dashboard/collectors/collectors-comparison-card";
import { CollectorsExecutionCard } from "@/app/dashboard/collectors/collectors-execution-card";
import { CollectorsSummaryCards } from "@/app/dashboard/collectors/collectors-summary-cards";
import { CollectorsTable } from "@/app/dashboard/collectors/collectors-table";
import { CollectorsTopPerformersStrip } from "@/app/dashboard/collectors/collectors-top-performers-strip";
import { CollectionsAreaChart } from "@/app/dashboard/collections/collections-area-chart";
import {
  formatCollectorsAxisCurrency,
  formatCollectorsAxisPercent,
  formatCollectorsCurrency,
  formatCollectorsPercent,
} from "@/app/dashboard/collectors/format";
import type {
  CollectorPerformanceRow,
  CollectorsAnalyticsData,
} from "@/app/dashboard/collectors/types";

export function CollectorsRankedMode({
  data,
  errorMessage,
  isPending,
  onPageChange,
  onViewCollector,
}: {
  data: CollectorsAnalyticsData;
  errorMessage: string | null;
  isPending: boolean;
  onPageChange: (page: number) => void;
  onViewCollector: (collector: CollectorPerformanceRow) => void;
}) {
  const totalPages = Math.max(Math.ceil(data.totalCount / data.pageSize), 1);
  const safePage = data.page;

  return (
    <>
      <CollectorsSummaryCards summary={data.summary} trends={data.summaryTrends} />

      <div className="grid gap-6 xl:grid-cols-12">
        <TremorCard className="xl:col-span-8">
          <div className="space-y-6 p-6">
            <div className="space-y-1.5">
              <h3 className="text-base font-semibold tracking-tight text-foreground">
                Ranked Collector Performance
              </h3>
              <TremorDescription className="text-[13px]">
                Collectors open ranked by total collected for {data.dateRangeLabel}, so the main list acts as the live leaderboard for the current scope.
              </TremorDescription>
            </div>

            <CollectorsTopPerformersStrip items={data.topPerformers} />

            <CollectorsTable onViewCollector={onViewCollector} rows={data.rows} />

            <div className="flex flex-col gap-3 border-t pt-4 text-sm md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-muted-foreground">
                  Showing {data.totalCount === 0 ? 0 : (safePage - 1) * data.pageSize + 1}
                  -{Math.min(safePage * data.pageSize, data.totalCount)} of {data.totalCount}
                </p>
                {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  disabled={isPending || safePage <= 1}
                  onClick={() => onPageChange(safePage - 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Previous
                </Button>
                <Button
                  disabled={isPending || safePage >= totalPages}
                  onClick={() => onPageChange(safePage + 1)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </TremorCard>

        <div className="space-y-6 xl:col-span-4">
          <CollectorsComparisonCard items={data.comparison} />
          <CollectorsExecutionCard items={data.execution} />
          <TremorCard className="p-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
                {data.insight.eyebrow}
              </p>
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {data.insight.title}
              </h3>
              <TremorDescription className="text-[13px]">{data.insight.description}</TremorDescription>
            </div>
          </TremorCard>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <CollectorsChartCard
          chart={
            <CollectionsAreaChart
              axisFormatter={formatCollectorsAxisCurrency}
              chart={data.outputChart}
              className="h-[300px] md:h-[340px]"
              valueFormatter={formatCollectorsCurrency}
            />
          }
          description="Compare total collected, average collection size, and average monthly output across the current ranking."
          title="Collection Output by Rank"
        />
        <CollectorsChartCard
          chart={
            <CollectionsAreaChart
              axisFormatter={formatCollectorsAxisPercent}
              chart={data.executionChart}
              className="h-[300px] md:h-[340px]"
              valueFormatter={formatCollectorsPercent}
            />
          }
          description="Completion, consistency, and delinquency control profiles across the current ranking."
          title="Execution Quality Signals"
        />
      </div>
    </>
  );
}
