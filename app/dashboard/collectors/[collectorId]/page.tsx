import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { resolveCollectorsPageAccess } from "@/app/dashboard/collectors/access";
import { CollectorProfilePanel } from "@/app/dashboard/collectors/collector-profile-panel";
import { parseCollectorsFilters } from "@/app/dashboard/collectors/filters";
import { loadCollectorProfileData } from "@/app/dashboard/collectors/queries";

export default async function CollectorProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ collectorId: string }>;
  searchParams?: Promise<{
    branch?: string;
    range?: string;
    from?: string;
    to?: string;
    query?: string;
  }>;
}) {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collector Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const routeParams = await params;
  const filters = parseCollectorsFilters((await searchParams) ?? {});
  const access = resolveCollectorsPageAccess(auth, filters);

  if (access.view !== "analytics") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collector Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{access.message}</p>
        </CardContent>
      </Card>
    );
  }

  const profile = await loadCollectorProfileData(access, filters, routeParams.collectorId);
  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collector Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The selected collector is not visible in your current scope.
          </p>
        </CardContent>
      </Card>
    );
  }

  const backParams = new URLSearchParams();
  if (access.canChooseBranch && access.selectedBranchId) {
    backParams.set("branch", String(access.selectedBranchId));
  }
  if (filters.selectedRange !== "this-month") {
    backParams.set("range", filters.selectedRange);
  }
  if (filters.selectedRange === "custom") {
    if (filters.fromRaw) {
      backParams.set("from", filters.fromRaw);
    }
    if (filters.toRaw) {
      backParams.set("to", filters.toRaw);
    }
  }
  if (filters.searchQuery) {
    backParams.set("query", filters.searchQuery);
  }
  const backQuery = backParams.toString();

  return (
    <CollectorProfilePanel
      data={profile}
      profileHref={backQuery ? `/dashboard/collectors?${backQuery}` : "/dashboard/collectors"}
      showProfileButton={false}
    />
  );
}
