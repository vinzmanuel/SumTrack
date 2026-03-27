import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function renderCenteredCard(props: { message: string; href: string; actionLabel: string; title: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{props.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{props.message}</p>
          <Link className="text-sm underline" href={props.href}>
            {props.actionLabel}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveReportsBackHref(searchParams: Record<string, string | string[] | undefined>) {
  const rawValue = firstSearchValue(searchParams.back)?.trim();

  if (!rawValue || !rawValue.startsWith("/dashboard/reports")) {
    return "/dashboard/reports";
  }

  return rawValue;
}

export default async function ReportsViewerPage({ params, searchParams }: PageProps) {
  const { reportId: reportIdRaw } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const backHref = resolveReportsBackHref(resolvedSearchParams);
  const reportId = Number.parseInt(reportIdRaw, 10);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return renderCenteredCard({
      title: "Saved Report",
      message: "The selected report could not be found.",
      href: backHref,
      actionLabel: "Back to Reports Library",
    });
  }
  const auth = await getDashboardAuthContext();
  const access = resolveReportsPageAccess(auth);
  if (access.view === "unauthenticated") {
    return renderCenteredCard({
      title: "Saved Report",
      message: access.message,
      href: "/login",
      actionLabel: "Go to login",
    });
  }
  if (access.view === "forbidden" || access.view === "scope_error") {
    return renderCenteredCard({
      title: "Saved Report",
      message: access.message,
      href: backHref,
      actionLabel: "Back to Reports Library",
    });
  }
  const result = await loadReportViewerData(access, reportId);
  if (!result.ok) {
    return renderCenteredCard({
      title: "Saved Report",
      message: result.message,
      href: backHref,
      actionLabel: "Back to Reports Library",
    });
  }
  return <ReportsViewPage backHref={backHref} report={result.data} />;
}
