import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { resolveReportsPageAccess } from "@/app/dashboard/reports/access";
import { loadReportViewerData } from "@/app/dashboard/reports/queries";
import { buildAuditActorFromAuth, logAuditEvent } from "@/lib/audit/logger";
import { getAuditRequestContextFromRequest } from "@/lib/audit/request-context";

function parseReportId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ reportId: string }> },
) {
  const auth = await getDashboardAuthContext();
  const access = resolveReportsPageAccess(auth);

  if (access.view !== "ready") {
    return NextResponse.json({ ok: false, message: "Not authorized." }, { status: 403 });
  }

  const params = await context.params;
  const reportId = parseReportId(params.reportId);
  if (!reportId) {
    return NextResponse.json({ ok: false, message: "Invalid report id." }, { status: 400 });
  }

  const viewerData = await loadReportViewerData(access, reportId);
  if (!viewerData.ok) {
    return NextResponse.json({ ok: false, message: viewerData.message }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { format?: "csv" | "pdf" | "print" } | null;
  const format = body?.format === "csv" || body?.format === "pdf" || body?.format === "print" ? body.format : "print";

  await logAuditEvent({
    action: "report.exported",
    entityType: "report",
    entityId: viewerData.data.reportId,
    actor: buildAuditActorFromAuth(access),
    branchId: viewerData.data.branchScopeIds[0] ?? null,
    branchScope: viewerData.data.branchScopeIds,
    description: `Exported ${viewerData.data.title} as ${format.toUpperCase()}.`,
    requestContext: getAuditRequestContextFromRequest(request),
    metadata: {
      format,
      templateKey: viewerData.data.templateKey,
      reportCategory: viewerData.data.reportCategory,
      generatedType: viewerData.data.generatedType,
      branchScope: viewerData.data.branchScopeIds,
    },
  });

  return NextResponse.json({ ok: true });
}
