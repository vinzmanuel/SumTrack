import { NextResponse } from "next/server";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { parseBorrowerLoansFilters } from "@/app/dashboard/my-loans/filters";
import { loadBorrowerLoansData } from "@/app/dashboard/my-loans/queries";

export async function GET(request: Request) {
  const auth = await requireDashboardAuth(["Borrower"]);
  if (!auth.ok) {
    return NextResponse.json({ message: auth.message }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters = parseBorrowerLoansFilters({
    loanStatus: url.searchParams.get("loanStatus") ?? undefined,
    loanQuery: url.searchParams.get("loanQuery") ?? undefined,
    loansPage: url.searchParams.get("loansPage") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  const data = await loadBorrowerLoansData(auth.userId, filters);

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

