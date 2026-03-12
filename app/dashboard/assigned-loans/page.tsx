import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { buildCollectorSelfAnalyticsAccess } from "@/app/dashboard/collectors/access";
import { parseCollectorAssignedLoansFilters } from "@/app/dashboard/collectors/detail-filters";
import { CollectorSelfAssignedLoansPage } from "@/app/dashboard/collectors/collector-self-assigned-loans-page";
import { loadCollectorAssignedLoansData } from "@/app/dashboard/collectors/queries";

export default async function AssignedLoansPage({
  searchParams,
}: {
  searchParams?: Promise<{
    loanStatus?: string;
    loanQuery?: string;
    loansPage?: string;
  }>;
}) {
  const auth = await requireDashboardAuth(["Collector"]);
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assigned Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }
  const filters = parseCollectorAssignedLoansFilters((await searchParams) ?? {});
  const access = buildCollectorSelfAnalyticsAccess(auth);
  const data = await loadCollectorAssignedLoansData(access, auth.userId, filters);

  return <CollectorSelfAssignedLoansPage initialData={data} initialFilters={filters} />;
}
