import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { resolveCollectionsPageAccess } from "@/app/dashboard/collections/access";
import { CollectionsClientPage } from "@/app/dashboard/collections/collections-client-page";
import { parseCollectionsFilters } from "@/app/dashboard/collections/filters";
import { loadCollectionsBranchOptions } from "@/app/dashboard/collections/queries";
import type { CollectionsPageProps } from "@/app/dashboard/collections/types";

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

  const branchOptions = await loadCollectionsBranchOptions(access);

  return (
    <CollectionsClientPage
      branchFilterLabel={access.branchFilterLabel}
      branchOptions={branchOptions}
      canChooseBranch={access.canChooseBranch}
      fixedBranchName={access.fixedBranchName}
      initialFilters={{
        selectedBranchRaw: access.selectedBranchId ? String(access.selectedBranchId) : "all",
        selectedRange: filters.selectedRange,
        fromRaw: filters.fromRaw,
        toRaw: filters.toRaw,
      }}
    />
  );
}
