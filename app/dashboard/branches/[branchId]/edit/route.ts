import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { updateBranchDetailsByCode } from "@/app/dashboard/branches/queries";
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
    | { branchName?: string; branchAddress?: string }
    | null;

  const result = await updateBranchDetailsByCode({
    access,
    branchCode,
    branchName: String(body?.branchName ?? ""),
    branchAddress: String(body?.branchAddress ?? ""),
  });

  return NextResponse.json(
    { message: result.message },
    { status: result.ok ? 200 : 400 },
  );
}
