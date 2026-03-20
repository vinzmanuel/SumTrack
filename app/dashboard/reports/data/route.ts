import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { resolveReportsPageAccess } from "@/app/dashboard/reports/access";
import { parseReportsLibraryFilters } from "@/app/dashboard/reports/filters";
import { loadReportsLibraryPageData } from "@/app/dashboard/reports/queries";

export async function GET(request: Request) {
  const auth = await getDashboardAuthContext();
  const access = resolveReportsPageAccess(auth);

  if (access.view !== "ready") {
    return NextResponse.json(
      {
        message: access.message,
      },
      {
        status: access.view === "unauthenticated" ? 401 : 403,
      },
    );
  }

  const url = new URL(request.url);
  const filters = parseReportsLibraryFilters(
    Object.fromEntries(url.searchParams.entries()),
  );
  const pageData = await loadReportsLibraryPageData(access, filters);

  return NextResponse.json(pageData);
}
