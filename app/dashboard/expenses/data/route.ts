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
  const filters = parseExpensesFilters({
    branch: url.searchParams.get("branch") ?? undefined,
    month: url.searchParams.get("month") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
  });
  const access = resolveExpensesPageAccess(auth, filters);

  if (access.view !== "ready") {
    return NextResponse.json({ message: access.message }, { status: 403 });
  }

  const data = await loadExpensesResultsData(access);
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
