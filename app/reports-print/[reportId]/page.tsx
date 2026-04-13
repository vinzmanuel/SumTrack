import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { resolveReportsPageAccess } from "@/app/dashboard/reports/access";
import { loadReportViewerData } from "@/app/dashboard/reports/queries";
import { ReportsViewPage } from "@/app/dashboard/reports/reports-view-page";

type PageProps = {
  params: Promise<{
    reportId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function parseReportId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

export default async function ReportsPrintPage({ params }: PageProps) {
  const { reportId: rawReportId } = await params;
  const reportId = parseReportId(rawReportId);
  if (!reportId) {
    return <main className="p-6 text-sm">Invalid report id.</main>;
  }

  const auth = await getDashboardAuthContext();
  const access = resolveReportsPageAccess(auth);
  if (access.view !== "ready") {
    return <main className="p-6 text-sm">Not authorized.</main>;
  }

  const result = await loadReportViewerData(access, reportId);
  if (!result.ok) {
    return <main className="p-6 text-sm">{result.message}</main>;
  }

  return <ReportsViewPage autoPrintDelayMs={2000} printMode report={result.data} />;
}
