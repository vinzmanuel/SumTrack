import { NextResponse } from "next/server";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { resolveCollectorsPageAccess } from "@/app/dashboard/collectors/access";
import { parseCollectorAssignedLoansFilters } from "@/app/dashboard/collectors/detail-filters";
import { loadCollectorAssignedLoansData } from "@/app/dashboard/collectors/queries";

export async function GET(
  request: Request,
  context: { params: Promise<{ collectorId: string }> },
) {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const access = resolveCollectorsPageAccess(auth, { requestedBranchId: null });
  if (access.view !== "analytics") {
    return NextResponse.json({ message: access.message }, { status: 403 });
  }

  const routeParams = await context.params;
  const url = new URL(request.url);
  const filters = parseCollectorAssignedLoansFilters({
    loanStatus: url.searchParams.get("loanStatus") ?? undefined,
    loanQuery: url.searchParams.get("loanQuery") ?? undefined,
    loansPage: url.searchParams.get("loansPage") ?? undefined,
  });

  const data = await loadCollectorAssignedLoansData(access, routeParams.collectorId, filters);
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
