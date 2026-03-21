import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { resolveReportsPageAccess } from "@/app/dashboard/reports/access";
import { updateSavedReportStatus } from "@/app/dashboard/reports/queries";

type RouteContext = {
  params: Promise<{
    reportId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await getDashboardAuthContext();
  const access = resolveReportsPageAccess(auth);

  if (access.view !== "ready") {
    return NextResponse.json(
      {
        message: access.message,
      },
      {
        status: access.view === "unauthenticated" ? 401 : 403,
      },
    );
  }

  const { reportId: reportIdRaw } = await context.params;
  const reportId = Number.parseInt(reportIdRaw, 10);

  if (!Number.isInteger(reportId) || reportId <= 0) {
    return NextResponse.json(
      {
        message: "Invalid report ID.",
      },
      { status: 400 },
    );
  }

  const payload = (await request.json().catch(() => null)) as { status?: unknown } | null;
  const nextStatus = payload?.status;

  if (nextStatus !== "active" && nextStatus !== "archived") {
    return NextResponse.json(
      {
        message: "Invalid report status.",
      },
      { status: 400 },
    );
  }

  const result = await updateSavedReportStatus(access, reportId, nextStatus);

  if (!result.ok) {
    return NextResponse.json(
      {
        message: result.message,
      },
      {
        status:
          result.code === "not_found"
            ? 404
            : result.code === "forbidden"
              ? 403
              : 400,
      },
    );
  }

  return NextResponse.json({
    reportId: result.reportId,
    status: result.status,
  });
}
