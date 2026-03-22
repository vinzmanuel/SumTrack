import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { resolveReportsPageAccess } from "@/app/dashboard/reports/access";
import { generatePreviousMonthSystemReports } from "@/app/dashboard/reports/queries";

export async function POST() {
  const auth = await getDashboardAuthContext();
  const access = resolveReportsPageAccess(auth);

  if (access.view !== "ready") {
    return NextResponse.json(
      {
        message:
          access.view === "unauthenticated"
            ? access.message
            : "You are not authorized to trigger monthly system-generated reports.",
      },
      { status: access.view === "unauthenticated" ? 401 : 403 },
    );
  }

  if (access.roleName !== "Admin") {
    return NextResponse.json(
      {
        message: "Only Admin users can trigger monthly system-generated reports.",
      },
      { status: 403 },
    );
  }

  const result = await generatePreviousMonthSystemReports(access);

  if (!result.ok) {
    return NextResponse.json(
      {
        message: result.message,
      },
      { status: 400 },
    );
  }

  return NextResponse.json(result, { status: 200 });
}
