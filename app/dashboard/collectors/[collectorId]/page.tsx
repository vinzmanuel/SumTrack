import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { resolveCollectorsPageAccess } from "@/app/dashboard/collectors/access";
import {
  parseCollectorAssignedLoansFilters,
  parseCollectorDetailTab,
} from "@/app/dashboard/collectors/detail-filters";
import { parseCollectorsFilters } from "@/app/dashboard/collectors/filters";
import { CollectorProfileClientPage } from "@/app/dashboard/collectors/collector-profile-client-page";
import { parseCollectorProfilePeriod } from "@/app/dashboard/collectors/profile-filters";
import {
  loadCollectorAssignedLoansData,
  loadCollectorProfileData,
} from "@/app/dashboard/collectors/queries";

export default async function CollectorProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ collectorId: string }>;
  searchParams?: Promise<{
    tab?: string;
    period?: string;
    source?: string;
    returnTo?: string;
    branch?: string;
    range?: string;
    from?: string;
    to?: string;
    query?: string;
    loanStatus?: string;
    loanQuery?: string;
    loansPage?: string;
  }>;
}) {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collector Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const routeParams = await params;
  const currentSearchParams = (await searchParams) ?? {};
  const filters = parseCollectorsFilters(currentSearchParams);
  const detailTab = parseCollectorDetailTab(currentSearchParams.tab);
  const period = parseCollectorProfilePeriod(currentSearchParams.period);
  const assignedLoansFilters = parseCollectorAssignedLoansFilters(currentSearchParams);
  const access = resolveCollectorsPageAccess(auth, { requestedBranchId: null });

  if (access.view !== "analytics") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collector Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{access.message}</p>
        </CardContent>
      </Card>
    );
  }

  const [profile, assignedLoans] = await Promise.all([
    loadCollectorProfileData(access, routeParams.collectorId, period),
    loadCollectorAssignedLoansData(access, routeParams.collectorId, assignedLoansFilters),
  ]);
  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collector Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The selected collector is not visible in your current scope.
          </p>
        </CardContent>
      </Card>
    );
  }

  const source = currentSearchParams.source === "manage-users" ? "manage-users" : "collectors";
  const backParams = new URLSearchParams();
  if (filters.requestedBranchId) {
    backParams.set("branch", String(filters.requestedBranchId));
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

  const collectorsBackHref = backQuery ? `/dashboard/collectors?${backQuery}` : "/dashboard/collectors";
  const returnTo = String(currentSearchParams.returnTo ?? "");
  const safeManageUsersBackHref = returnTo.startsWith("/dashboard/manage-user-accounts")
    ? returnTo
    : "/dashboard/manage-user-accounts";
  const backHref = source === "manage-users" ? safeManageUsersBackHref : collectorsBackHref;
  const backLabel = source === "manage-users" ? "Back to Manage Users" : "Back to Collectors";

  return (
    <div className="space-y-6">
      <CollectorProfileClientPage
        backLabel={backLabel}
        backHref={backHref}
        collectorId={routeParams.collectorId}
        initialAssignedLoansData={assignedLoans}
        initialAssignedLoansFilters={assignedLoansFilters}
        initialData={profile}
        initialTab={detailTab}
      />
    </div>
  );
}
