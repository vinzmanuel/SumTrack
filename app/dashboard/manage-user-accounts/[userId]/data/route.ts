import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  parseManageUserAccountsFilters,
  resolveManageUserAccountsAccess,
} from "@/app/dashboard/manage-user-accounts/filters";
import { loadManagedUserDetail } from "@/app/dashboard/manage-user-accounts/queries";

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const auth = await getDashboardAuthContext();
  const accessState = resolveManageUserAccountsAccess(auth, parseManageUserAccountsFilters({}));

  if (accessState.view !== "staff") {
    return NextResponse.json({ message: "You are not authorized to view this account." }, { status: 403 });
  }

  const { userId } = await context.params;
  const detail = await loadManagedUserDetail(accessState, userId);

  if (!detail) {
    return NextResponse.json({ message: "User account not found." }, { status: 404 });
  }

  return NextResponse.json(detail, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
