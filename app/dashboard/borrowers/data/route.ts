import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { parseBorrowersListFilters, resolveBorrowersPageAccess } from "@/app/dashboard/borrowers/filters";
import { loadBorrowersPageData } from "@/app/dashboard/borrowers/queries";

export async function GET(request: Request) {
  const auth = await getDashboardAuthContext();
  const url = new URL(request.url);
  const filters = parseBorrowersListFilters({
    branchId: url.searchParams.get("branchId") ?? undefined,
    areaId: url.searchParams.get("areaId") ?? undefined,
    query: url.searchParams.get("query") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
  });
  const accessState = resolveBorrowersPageAccess(auth, filters);

  if (accessState.view !== "staff") {
    return NextResponse.json({ message: "You are not authorized to view borrowers." }, { status: 403 });
  }

  const pageData = await loadBorrowersPageData(accessState);

  return NextResponse.json(pageData, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
