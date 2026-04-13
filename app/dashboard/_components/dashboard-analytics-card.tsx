"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardOverviewTrendChart } from "@/app/dashboard/_components/dashboard-overview-trend-chart";
import type { DashboardChartData } from "@/app/dashboard/dashboard-chart-types";

export function DashboardAnalyticsCard({ data }: { data: DashboardChartData }) {
  return (
    <Card className="rounded-md py-0 shadow-sm">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base font-semibold tracking-tight">{data.title}</CardTitle>
        <CardDescription className="text-sm leading-5">Collections and expenses trend.</CardDescription>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        <DashboardOverviewTrendChart chart={data.chart} />
      </CardContent>
    </Card>
  );
}
