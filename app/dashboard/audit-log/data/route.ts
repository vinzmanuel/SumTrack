import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  loadAuditLogPageData,
  parseAuditLogFilters,
  resolveAuditLogAccess,
} from "@/app/dashboard/audit-log/queries";

export async function GET(request: Request) {
  const auth = await getDashboardAuthContext();
  const url = new URL(request.url);
  const filters = parseAuditLogFilters({
    preset: url.searchParams.get("preset") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    branch: url.searchParams.get("branch") ?? undefined,
    action: url.searchParams.get("action") ?? undefined,
    entity: url.searchParams.get("entity") ?? undefined,
    actorRole: url.searchParams.get("actorRole") ?? undefined,
    actor: url.searchParams.get("actor") ?? undefined,
    query: url.searchParams.get("query") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
  });
  const access = resolveAuditLogAccess(auth);

  if (access.view !== "ready") {
    return NextResponse.json({ message: "You are not authorized to view the audit log." }, { status: 403 });
  }

  const pageData = await loadAuditLogPageData(access, filters);

  return NextResponse.json(pageData, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
