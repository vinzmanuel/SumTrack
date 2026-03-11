import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { resolveCollectorsPageAccess } from "@/app/dashboard/collectors/access";
import { CollectorsClientPage } from "@/app/dashboard/collectors/collectors-client-page";
import { parseCollectorsFilters } from "@/app/dashboard/collectors/filters";
import { loadCollectorsBranchOptions } from "@/app/dashboard/collectors/queries";
import type { CollectorsPageProps } from "@/app/dashboard/collectors/types";

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

  const branchOptions = await loadCollectorsBranchOptions(access);

  return (
    <CollectorsClientPage
      branchFilterLabel={access.branchFilterLabel}
      branchOptions={branchOptions}
      canChooseBranch={access.canChooseBranch}
      fixedBranchName={access.fixedBranchName}
      initialFilters={{
        selectedBranchRaw: access.selectedBranchId ? String(access.selectedBranchId) : "all",
        selectedRange: filters.selectedRange,
        fromRaw: filters.fromRaw,
        toRaw: filters.toRaw,
        searchQuery: filters.searchQuery,
        page: filters.page,
      }}
    />
  );
}
