import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { createBranch } from "@/app/dashboard/branches/queries";
import { resolveBranchesPageAccess } from "@/app/dashboard/branches/types";

export async function POST(request: Request) {
  const auth = await getDashboardAuthContext();
  const access = resolveBranchesPageAccess(auth);

  if (access.view !== "network") {
    return NextResponse.json(
      { message: access.message },
      { status: access.view === "unauthenticated" ? 401 : 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        provinceName?: string;
        provinceCode?: string;
        municipalityName?: string;
        municipalityCode?: string;
        branchName?: string;
        branchAddress?: string;
      }
    | null;

  const result = await createBranch({
    access,
    provinceName: String(body?.provinceName ?? ""),
    provinceCode: String(body?.provinceCode ?? ""),
    municipalityName: String(body?.municipalityName ?? ""),
    municipalityCode: String(body?.municipalityCode ?? ""),
    branchName: String(body?.branchName ?? ""),
    branchAddress: String(body?.branchAddress ?? ""),
  });

  return NextResponse.json(
    result.ok
      ? { message: result.message, branchCode: result.branchCode }
      : { message: result.message },
    { status: result.ok ? 200 : 400 },
  );
}
