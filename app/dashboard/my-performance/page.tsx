import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { buildCollectorSelfAnalyticsAccess } from "@/app/dashboard/collectors/access";
import { CollectorMyPerformanceClientPage } from "@/app/dashboard/collectors/collector-my-performance-client-page";
import { parseCollectorProfilePeriod } from "@/app/dashboard/collectors/profile-filters";
import { loadCollectorProfileData } from "@/app/dashboard/collectors/queries";

export default async function MyPerformancePage({
  searchParams,
}: {
  searchParams?: Promise<{
    period?: string;
  }>;
}) {
  const auth = await requireDashboardAuth(["Collector"]);
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const period = parseCollectorProfilePeriod((await searchParams)?.period);
  const access = buildCollectorSelfAnalyticsAccess(auth);
  const profile = await loadCollectorProfileData(access, auth.userId, period);

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your collector performance profile could not be loaded.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <CollectorMyPerformanceClientPage initialData={profile} />;
}
