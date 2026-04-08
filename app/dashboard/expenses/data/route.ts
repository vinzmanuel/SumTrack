import { NextResponse } from "next/server";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { parseExpensesFilters, resolveExpensesPageAccess } from "@/app/dashboard/expenses/filters";
import { loadExpensesResultsData } from "@/app/dashboard/expenses/queries";

export async function GET(request: Request) {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const url = new URL(request.url);
  const includeAnalytics = url.searchParams.get("analytics") === "1";
  const filters = parseExpensesFilters({
    branch: url.searchParams.get("branch") ?? undefined,
    range: url.searchParams.get("range") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    month: url.searchParams.get("month") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  const access = resolveExpensesPageAccess(auth, filters);

  if (access.view !== "ready") {
    return NextResponse.json({ message: access.message }, { status: 403 });
  }

  const data = await loadExpensesResultsData(access, { includeAnalytics });
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
