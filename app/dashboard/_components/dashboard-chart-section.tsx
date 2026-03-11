import { DashboardAnalyticsCard } from "@/app/dashboard/_components/dashboard-analytics-card";
import { loadDashboardChartData } from "@/app/dashboard/dashboard-chart-queries";
import type { DashboardChartPageProps } from "@/app/dashboard/dashboard-chart-types";
import type { DashboardOverviewState } from "@/app/dashboard/overview-types";

export async function DashboardChartSection({
  overviewState,
  searchParams,
}: {
  overviewState: DashboardOverviewState;
  searchParams: DashboardChartPageProps["searchParams"];
}) {
  const params = await searchParams;
  const chartData = await loadDashboardChartData(overviewState, params);

  if (!chartData) {
    return null;
  }

  return <DashboardAnalyticsCard data={chartData} />;
}
