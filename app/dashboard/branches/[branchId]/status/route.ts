import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { updateBranchStatusByCode } from "@/app/dashboard/branches/queries";
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
  const body = (await request.json().catch(() => null)) as { nextStatus?: string } | null;
  const nextStatus = body?.nextStatus === "inactive" ? "inactive" : body?.nextStatus === "active" ? "active" : null;

  if (!nextStatus) {
    return NextResponse.json({ message: "A valid branch status is required." }, { status: 400 });
  }

  const result = await updateBranchStatusByCode({
    access,
    branchCode,
    nextStatus,
  });

  return NextResponse.json(
    { message: result.message },
    { status: result.ok ? 200 : 400 },
  );
}
