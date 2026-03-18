import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { updateAreaStatusByBranchCode } from "@/app/dashboard/branches/queries";
import { resolveBranchDetailAccess } from "@/app/dashboard/branches/types";

export async function POST(
  request: Request,
  context: { params: Promise<{ branchId: string; areaId: string }> },
) {
  const auth = await getDashboardAuthContext();
  const access = resolveBranchDetailAccess(auth);

  if (access.view !== "detail") {
    return NextResponse.json(
      { message: access.message },
      { status: access.view === "unauthenticated" ? 401 : 403 },
    );
  }

  const params = await context.params;
  const branchCode = decodeURIComponent(params.branchId).trim();
  const areaId = Number(params.areaId);
  const body = (await request.json().catch(() => null)) as { nextStatus?: string } | null;
  const nextStatus =
    body?.nextStatus === "inactive" ? "inactive" : body?.nextStatus === "active" ? "active" : null;

  if (!Number.isInteger(areaId) || areaId <= 0 || !nextStatus) {
    return NextResponse.json({ message: "A valid area status update is required." }, { status: 400 });
  }

  const result = await updateAreaStatusByBranchCode({
    access,
    branchCode,
    areaId,
    nextStatus,
  });

  return NextResponse.json({ message: result.message }, { status: result.ok ? 200 : 400 });
}
