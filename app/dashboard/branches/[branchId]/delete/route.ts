import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { deleteBranchByCode } from "@/app/dashboard/branches/queries";
import { resolveBranchDetailAccess } from "@/app/dashboard/branches/types";

export async function POST(
  _request: Request,
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

  const result = await deleteBranchByCode({
    access,
    branchCode,
  });

  return NextResponse.json(
    { message: result.message },
    { status: result.ok ? 200 : 400 },
  );
}
