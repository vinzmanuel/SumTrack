import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  loadRecentActivityPageData,
  parseRecentActivityFilters,
  resolveRecentActivityAccess,
} from "@/app/dashboard/recent-activity/queries";

export async function GET(request: Request) {
  const auth = await getDashboardAuthContext();
  const access = resolveRecentActivityAccess(auth);

  if (access.view !== "ok") {
    return NextResponse.json({ message: access.message }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseRecentActivityFilters({
    preset: url.searchParams.get("preset") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    activity: url.searchParams.get("activity") ?? undefined,
    actorRole: url.searchParams.get("actorRole") ?? undefined,
    actor: url.searchParams.get("actor") ?? undefined,
    branch: url.searchParams.get("branch") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
  });

  const pageData = await loadRecentActivityPageData(access, filters);

  return NextResponse.json(pageData, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
