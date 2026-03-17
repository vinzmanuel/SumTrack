import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { updateAreaByBranchCode } from "@/app/dashboard/branches/queries";
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

  if (!Number.isInteger(areaId) || areaId <= 0) {
    return NextResponse.json({ message: "Invalid area." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as
    | { areaNo?: string; description?: string }
    | null;

  const result = await updateAreaByBranchCode({
    access,
    branchCode,
    areaId,
    description: String(body?.description ?? ""),
  });

  return NextResponse.json({ message: result.message }, { status: result.ok ? 200 : 400 });
}
