import { NextResponse } from "next/server";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { buildCollectorSelfAnalyticsAccess } from "@/app/dashboard/collectors/access";
import { parseCollectorProfilePeriod } from "@/app/dashboard/collectors/profile-filters";
import { loadCollectorProfileData } from "@/app/dashboard/collectors/queries";

export async function GET(request: Request) {
  const auth = await requireDashboardAuth(["Collector"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const url = new URL(request.url);
  const period = parseCollectorProfilePeriod(url.searchParams.get("period") ?? undefined);
  const access = buildCollectorSelfAnalyticsAccess(auth);
  const data = await loadCollectorProfileData(access, auth.userId, period);

  if (!data) {
    return NextResponse.json({ message: "Unable to load your performance." }, { status: 404 });
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
