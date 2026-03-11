import { NextResponse } from "next/server";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { resolveCollectionsPageAccess } from "@/app/dashboard/collections/access";
import { parseCollectionsFilters } from "@/app/dashboard/collections/filters";
import { loadCollectionsAnalyticsData } from "@/app/dashboard/collections/queries";

export async function GET(request: Request) {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseCollectionsFilters({
    branch: url.searchParams.get("branch") ?? undefined,
    range: url.searchParams.get("range") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  const access = resolveCollectionsPageAccess(auth, filters);

  if (access.view !== "analytics") {
    return NextResponse.json({ message: access.message }, { status: 403 });
  }

  const data = await loadCollectionsAnalyticsData(access, filters);
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
