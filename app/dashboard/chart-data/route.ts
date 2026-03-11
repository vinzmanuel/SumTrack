import { NextResponse } from "next/server";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { loadDashboardChartData } from "@/app/dashboard/dashboard-chart-queries";
import { resolveDashboardOverviewState } from "@/app/dashboard/overview-access";

export async function GET(request: Request) {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const url = new URL(request.url);
  const data = await loadDashboardChartData(resolveDashboardOverviewState(auth), {
    branch: url.searchParams.get("branch") ?? undefined,
    range: url.searchParams.get("range") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  if (!data) {
    return NextResponse.json({ message: "No dashboard chart available." }, { status: 404 });
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
