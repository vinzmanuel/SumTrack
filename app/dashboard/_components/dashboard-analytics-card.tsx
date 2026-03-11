"use client";

import { useMemo, useState } from "react";
import { AnalyticsChartCard } from "@/components/analytics/analytics-chart-card";
import { toAreaChartProps } from "@/components/analytics/chart-mapper";
import { TremorAreaChart } from "@/components/tremor/raw/area-chart";
import { DashboardChartFilters } from "@/app/dashboard/_components/dashboard-chart-filters";
import type { DashboardChartData, DashboardChartFilterInput } from "@/app/dashboard/dashboard-chart-types";

export function DashboardAnalyticsCard({ data }: { data: DashboardChartData }) {
  const [chartData, setChartData] = useState(data);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const areaChartProps = useMemo(() => toAreaChartProps(chartData.chart), [chartData.chart]);

  async function handleApply(filters: DashboardChartFilterInput) {
    const query = new URLSearchParams();
    query.set("range", filters.range);

    if (chartData.canChooseBranch) {
      query.set("branch", filters.branch);
    }

    if (filters.range === "custom") {
      if (filters.from) {
        query.set("from", filters.from);
      }
      if (filters.to) {
        query.set("to", filters.to);
      }
    }

    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/dashboard/chart-data?${query.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Unable to update chart data.");
      }

      const nextData = (await response.json()) as DashboardChartData;
      setChartData(nextData);
    } catch {
      setErrorMessage("Unable to refresh the dashboard chart right now.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <AnalyticsChartCard
      chart={
        <TremorAreaChart
          categories={areaChartProps.categories}
          className="h-[340px] md:h-[380px]"
          colors={areaChartProps.colors}
          data={areaChartProps.data}
          index="bucket"
        />
      }
      description={`${chartData.description} for ${chartData.dateRangeLabel.toLowerCase()}.`}
      errorMessage={errorMessage}
      filters={
        <DashboardChartFilters
          data={chartData}
          isPending={isPending}
          key={`${chartData.filters.selectedBranchRaw}-${chartData.filters.selectedRange}-${chartData.filters.fromRaw}-${chartData.filters.toRaw}`}
          onApply={handleApply}
        />
      }
      isPending={isPending}
      noData={chartData.chart.noData}
      noDataMessage="No matching dashboard data was found for the selected filters."
      title={chartData.title}
    />
  );
}
