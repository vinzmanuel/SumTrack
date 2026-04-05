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

  const body = (await request.json().catch(() => null)) as {
    status?: string;
    roleId?: number | null;
    branchId?: number | null;
    branchIds?: number[];
    areaId?: number | null;
  } | null;
  const nextStatus = body?.status === "inactive" ? "inactive" : body?.status === "active" ? "active" : null;

  if (!nextStatus) {
    return NextResponse.json({ message: "Invalid status value." }, { status: 400 });
  }

  const { userId } = await context.params;
  const result = await updateManagedUserStatus({
    scope: accessState,
    userId,
    nextStatus,
    roleId: typeof body?.roleId === "number" && Number.isFinite(body.roleId) ? body.roleId : null,
    branchId: typeof body?.branchId === "number" && Number.isFinite(body.branchId) ? body.branchId : null,
    branchIds: Array.isArray(body?.branchIds)
      ? body.branchIds.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      : [],
    areaId: typeof body?.areaId === "number" && Number.isFinite(body.areaId) ? body.areaId : null,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: result.errorType === "reassignment_required" ? 409 : 400 });
  }

  return NextResponse.json({ ok: true });
}
