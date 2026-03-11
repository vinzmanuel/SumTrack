import { NextResponse } from "next/server";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { parseLoansListFilters, resolveLoansPageAccess } from "@/app/dashboard/loans/filters";
import { loadStaffLoansPageData } from "@/app/dashboard/loans/queries";

export async function GET(request: Request) {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseLoansListFilters({
    branchId: url.searchParams.get("branchId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    query: url.searchParams.get("query") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
  });
  const accessState = resolveLoansPageAccess(auth, filters);

  if (accessState.view !== "staff") {
    return NextResponse.json({ message: "You are not authorized to view loans." }, { status: 403 });
  }

  const pageData = await loadStaffLoansPageData(accessState);

  return NextResponse.json(pageData, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
