import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  parseManageUserAccountsFilters,
  resolveManageUserAccountsAccess,
} from "@/app/dashboard/manage-user-accounts/filters";
import { updateManagedUserStatus } from "@/app/dashboard/manage-user-accounts/queries";

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const auth = await getDashboardAuthContext();
  const accessState = resolveManageUserAccountsAccess(auth, parseManageUserAccountsFilters({}));

  if (accessState.view !== "staff") {
    return NextResponse.json({ message: "You are not authorized to update account status." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  const nextStatus = body?.status === "inactive" ? "inactive" : body?.status === "active" ? "active" : null;

  if (!nextStatus) {
    return NextResponse.json({ message: "Invalid status value." }, { status: 400 });
  }

  const { userId } = await context.params;
  const result = await updateManagedUserStatus({
    scope: accessState,
    userId,
    nextStatus,
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
