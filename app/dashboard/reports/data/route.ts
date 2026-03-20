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
  const searchParams: Record<string, string | string[] | undefined> = {};

  for (const [key, value] of url.searchParams.entries()) {
    const existing = searchParams[key];

    if (typeof existing === "undefined") {
      searchParams[key] = value;
      continue;
    }

    if (Array.isArray(existing)) {
      existing.push(value);
      continue;
    }

    searchParams[key] = [existing, value];
  }

  const filters = parseReportsLibraryFilters(searchParams);
  const pageData = await loadReportsLibraryPageData(access, filters);

  return NextResponse.json(pageData);
}
