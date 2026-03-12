import { NextResponse } from "next/server";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { resolveCollectorsPageAccess } from "@/app/dashboard/collectors/access";
import { parseCollectorProfilePeriod } from "@/app/dashboard/collectors/profile-filters";
import { loadCollectorProfileData } from "@/app/dashboard/collectors/queries";

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
  const period = parseCollectorProfilePeriod(url.searchParams.get("period") ?? undefined);
  const data = await loadCollectorProfileData(access, routeParams.collectorId, period);

  if (!data) {
    return NextResponse.json(
      { message: "The selected collector is not visible in your current scope." },
      { status: 404 },
    );
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
