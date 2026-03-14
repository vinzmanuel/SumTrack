import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  parseManageUserAccountsFilters,
  resolveManageUserAccountsAccess,
} from "@/app/dashboard/manage-user-accounts/filters";
import { deleteManagedUserAccount } from "@/app/dashboard/manage-user-accounts/queries";

export async function POST(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const auth = await getDashboardAuthContext();
  const accessState = resolveManageUserAccountsAccess(auth, parseManageUserAccountsFilters({}));

  if (accessState.view !== "staff") {
    return NextResponse.json({ message: "You are not authorized to delete user accounts." }, { status: 403 });
  }

  const { userId } = await context.params;
  const result = await deleteManagedUserAccount(accessState, userId);

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
