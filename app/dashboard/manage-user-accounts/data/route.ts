import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  parseManageUserAccountsFilters,
  resolveManageUserAccountsAccess,
} from "@/app/dashboard/manage-user-accounts/filters";
import { loadManageUserAccountsPageData } from "@/app/dashboard/manage-user-accounts/queries";

export async function GET(request: Request) {
  const auth = await getDashboardAuthContext();
  const url = new URL(request.url);
  const filters = parseManageUserAccountsFilters({
    branchId: url.searchParams.get("branchId") ?? undefined,
    areaId: url.searchParams.get("areaId") ?? undefined,
    role: url.searchParams.get("role") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    query: url.searchParams.get("query") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
  });
  const accessState = resolveManageUserAccountsAccess(auth, filters);

  if (accessState.view !== "staff") {
    return NextResponse.json({ message: "You are not authorized to view user accounts." }, { status: 403 });
  }

  const pageData = await loadManageUserAccountsPageData(accessState);

  return NextResponse.json(pageData, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
