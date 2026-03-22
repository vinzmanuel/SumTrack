import { NextResponse } from "next/server";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { deleteLoanRecord } from "@/app/dashboard/loans/loan-lifecycle";

export async function POST(
  _request: Request,
  context: { params: Promise<{ loanId: string }> },
) {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const { loanId } = await context.params;
  const result = await deleteLoanRecord(auth, loanId);

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result, { status: 200 });
}
