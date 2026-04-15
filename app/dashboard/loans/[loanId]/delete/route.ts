import { NextResponse } from "next/server";
import { requireDashboardAuth } from "@/app/dashboard/auth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ loanId: string }> },
) {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  void context;
  return NextResponse.json(
    { ok: false, message: "Loan deletion is disabled by current system policy." },
    { status: 403 },
  );
}
