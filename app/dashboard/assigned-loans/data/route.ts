import { NextResponse } from "next/server";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { buildCollectorSelfAnalyticsAccess } from "@/app/dashboard/collectors/access";
import { parseCollectorAssignedLoansFilters } from "@/app/dashboard/collectors/detail-filters";
import { loadCollectorAssignedLoansData } from "@/app/dashboard/collectors/queries";

export async function GET(request: Request) {
  const auth = await requireDashboardAuth(["Collector"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseCollectorAssignedLoansFilters({
    loanStatus: url.searchParams.get("loanStatus") ?? undefined,
    loanQuery: url.searchParams.get("loanQuery") ?? undefined,
    loansPage: url.searchParams.get("loansPage") ?? undefined,
  });
  const access = buildCollectorSelfAnalyticsAccess(auth);
  const data = await loadCollectorAssignedLoansData(access, auth.userId, filters);

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
