import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { DashboardMetricGrid } from "@/app/dashboard/_components/dashboard-tremor";
import { resolveDashboardOverviewState } from "@/app/dashboard/overview-access";
import { buildDashboardOverviewCards } from "@/app/dashboard/overview-cards";
import { loadDashboardOverviewData } from "@/app/dashboard/overview-queries";

export default async function DashboardPage() {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const overviewState = resolveDashboardOverviewState(auth);
  const overviewData = await loadDashboardOverviewData(overviewState);
  const cards = buildDashboardOverviewCards(overviewData);

  return (
    <div className="space-y-6">
      <DashboardMetricGrid items={cards} />
    </div>
  );
}
