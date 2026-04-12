import { Suspense } from "react";
import { HandCoins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { resolveCollectionsPageAccess } from "@/app/dashboard/collections/access";
import { CollectionsClientPage } from "@/app/dashboard/collections/collections-client-page";
import { CollectionsResultsSkeleton } from "@/app/dashboard/collections/collections-results-skeleton";
import { parseCollectionsFilters } from "@/app/dashboard/collections/filters";
import { loadCollectionsAnalyticsData, loadCollectionsBranchOptions } from "@/app/dashboard/collections/queries";
import type { CollectionsPageProps } from "@/app/dashboard/collections/types";
import LoadingCollectionsPage from "@/app/dashboard/collections/loading";

async function CollectionsModuleLoader({ access, filters }: { access: any, filters: any }) {
  const [branchOptions, initialData] = await Promise.all([
    loadCollectionsBranchOptions(access),
    loadCollectionsAnalyticsData(access, filters),
  ]);

  return (
    <CollectionsClientPage
      branchFilterLabel={access.branchFilterLabel}
      branchOptions={branchOptions}
      canChooseBranch={access.canChooseBranch}
      initialData={initialData}
      initialFilters={{
        selectedBranchRaw: access.selectedBranchId ? String(access.selectedBranchId) : "all",
        selectedRange: filters.selectedRange,
        fromRaw: filters.fromRaw,
        toRaw: filters.toRaw,
      }}
    />
  );
}

export default async function CollectionsPage({ searchParams }: CollectionsPageProps) {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collections</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const filters = parseCollectionsFilters((await searchParams) ?? {});
  const access = resolveCollectionsPageAccess(auth, filters);

  if (access.view !== "analytics") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Collections</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{access.message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          icon: <HandCoins className="size-9 text-sidebar-foreground/65" />,
          title: "Collections",
          description:
            "Analyze collection composition, reliability, and payment behavior across your selected branch scope.",
        }}
      />
      
      <Suspense fallback={<div className="pt-1"><LoadingCollectionsPage /></div>}>
        <CollectionsModuleLoader access={access} filters={filters} />
      </Suspense>
    </>
  );
}
