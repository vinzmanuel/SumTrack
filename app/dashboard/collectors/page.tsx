import { Suspense } from "react";
import { UserStar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { resolveCollectorsPageAccess } from "@/app/dashboard/collectors/access";
import { CollectorsClientPage } from "@/app/dashboard/collectors/collectors-client-page";
import { CollectorsResultsSkeleton } from "@/app/dashboard/collectors/collectors-results-skeleton";
import { parseCollectorsFilters } from "@/app/dashboard/collectors/filters";
import { loadCollectorsAnalyticsData, loadCollectorsBranchOptions } from "@/app/dashboard/collectors/queries";
import type { CollectorsAccessState, CollectorsPageProps } from "@/app/dashboard/collectors/types";

type CollectorsAnalyticsAccess = Extract<CollectorsAccessState, { view: "analytics" }>;

async function CollectorsModuleLoader({
  access,
  filters,
}: {
  access: CollectorsAnalyticsAccess;
  filters: ReturnType<typeof parseCollectorsFilters>;
}) {
  const [branchOptions, initialData] = await Promise.all([
    loadCollectorsBranchOptions(access),
    loadCollectorsAnalyticsData(access, filters),
  ]);

  return (
    <CollectorsClientPage
      branchFilterLabel={access.branchFilterLabel}
      branchOptions={branchOptions}
      canChooseBranch={access.canChooseBranch}
      fixedBranchName={access.fixedBranchName}
      viewerRoleName={access.roleName}
      initialData={initialData}
      initialFilters={{
        selectedBranchRaw: access.selectedBranchId ? String(access.selectedBranchId) : "all",
        selectedRange: filters.selectedRange,
        fromRaw: filters.fromRaw,
        toRaw: filters.toRaw,
        searchQuery: filters.searchQuery,
        selectedBasis: filters.selectedBasis,
        page: filters.page,
        pageSize: filters.pageSize,
      }}
    />
  );
}

export default async function CollectorsPage({ searchParams }: CollectorsPageProps) {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collectors</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const filters = parseCollectorsFilters((await searchParams) ?? {});
  const access = resolveCollectorsPageAccess(auth, filters);

  if (access.view !== "analytics") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collectors</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{access.message}</p>
        </CardContent>
      </Card>
    );
  }

  const description = access.canChooseBranch
    ? "Compare collector performance across your visible branches with period-based ranking and focused summaries."
    : `Compare collector performance in ${access.fixedBranchName ?? "your assigned branch"} with period-based ranking and focused summaries.`;

  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          action: null,
          description,
          icon: <UserStar className="size-9 text-sidebar-foreground/65" />,
          title: "Collectors",
        }}
      />
      
      <Suspense fallback={<div className="w-full space-y-4 pt-1"><CollectorsResultsSkeleton /></div>}>
        <CollectorsModuleLoader access={access} filters={filters} />
      </Suspense>
    </>
  );
}
