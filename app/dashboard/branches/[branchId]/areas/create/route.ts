import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { createAreaByBranchCode } from "@/app/dashboard/branches/queries";
import { resolveBranchDetailAccess } from "@/app/dashboard/branches/types";

export async function POST(
  request: Request,
  context: { params: Promise<{ branchId: string }> },
) {
  const auth = await getDashboardAuthContext();
  const access = resolveBranchDetailAccess(auth);

  if (access.view !== "detail") {
    return NextResponse.json(
      { message: access.message },
      { status: access.view === "unauthenticated" ? 401 : 403 },
    );
  }

  const branchCode = decodeURIComponent((await context.params).branchId).trim();
  const body = (await request.json().catch(() => null)) as
    | { areaNo?: string; description?: string }
    | null;

  const result = await createAreaByBranchCode({
    access,
    branchCode,
    areaNo: String(body?.areaNo ?? ""),
    description: String(body?.description ?? ""),
  });

  return NextResponse.json({ message: result.message }, { status: result.ok ? 200 : 400 });
}
