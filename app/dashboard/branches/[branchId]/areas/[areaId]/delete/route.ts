import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { resolveBranchDetailAccess } from "@/app/dashboard/branches/types";

export async function POST(
  _request: Request,
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

  void context;
  return NextResponse.json(
    { message: "Area deletion is disabled by current system policy." },
    { status: 403 },
  );
}
