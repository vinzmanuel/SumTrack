import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  parseManageUserAccountsFilters,
  resolveManageUserAccountsAccess,
} from "@/app/dashboard/manage-user-accounts/filters";
import { updateManagedUserAccount } from "@/app/dashboard/manage-user-accounts/queries";

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const auth = await getDashboardAuthContext();
  const accessState = resolveManageUserAccountsAccess(auth, parseManageUserAccountsFilters({}));

  if (accessState.view !== "staff") {
    return NextResponse.json({ message: "You are not authorized to update this account." }, { status: 403 });
  }

  const { userId } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | {
        roleId?: number | string;
        email?: string;
        firstName?: string;
        middleName?: string;
        lastName?: string;
        contactNo?: string;
      }
    | null;

  const result = await updateManagedUserAccount({
    scope: accessState,
    userId,
    roleId:
      typeof body?.roleId === "number"
        ? body.roleId
        : /^\d+$/.test(String(body?.roleId ?? ""))
          ? Number(body?.roleId)
          : null,
    email: String(body?.email ?? "").trim(),
    firstName: String(body?.firstName ?? "").trim(),
    middleName: String(body?.middleName ?? "").trim(),
    lastName: String(body?.lastName ?? "").trim(),
    contactNo: String(body?.contactNo ?? "").trim(),
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
