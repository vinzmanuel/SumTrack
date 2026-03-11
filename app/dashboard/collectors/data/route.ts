import { NextResponse } from "next/server";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { resolveCollectorsPageAccess } from "@/app/dashboard/collectors/access";
import { parseCollectorsFilters } from "@/app/dashboard/collectors/filters";
import { loadCollectorsAnalyticsData } from "@/app/dashboard/collectors/queries";

export async function GET(request: Request) {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseCollectorsFilters({
    branch: url.searchParams.get("branch") ?? undefined,
    range: url.searchParams.get("range") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    query: url.searchParams.get("query") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
  });
  const access = resolveCollectorsPageAccess(auth, filters);

  if (access.view !== "analytics") {
    return NextResponse.json({ message: access.message }, { status: 403 });
  }

  const data = await loadCollectorsAnalyticsData(access, filters);
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
