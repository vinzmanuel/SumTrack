import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardBackLink } from "@/app/dashboard/_components/dashboard-back-link";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { firstSearchValue, resolveBackNavigation } from "@/app/dashboard/back-navigation";
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
          <DashboardBackLink href={props.href} label={props.actionLabel} />
        </CardContent>
      </Card>
    </main>
  );
}

function resolveReportsBackHref(searchParams: Record<string, string | string[] | undefined>) {
  return resolveBackNavigation({
    source: firstSearchValue(searchParams.source),
    returnTo: firstSearchValue(searchParams.returnTo) ?? firstSearchValue(searchParams.back),
    allowedPrefixes: ["/dashboard/reports", "/dashboard/reports/create", "/dashboard/loans"],
    fallbackHref: "/dashboard/reports",
    fallbackLabel: "Back to Reports Library",
    sourceMap: {
      reports: {
        href: "/dashboard/reports",
        label: "Back to Reports Library",
        allowedPrefixes: ["/dashboard/reports"],
      },
      "reports-create": {
        href: "/dashboard/reports/create",
        label: "Back to Create Report",
        allowedPrefixes: ["/dashboard/reports/create"],
      },
      loans: {
        href: "/dashboard/loans",
        label: "Back to Loan",
        allowedPrefixes: ["/dashboard/loans"],
      },
    },
  });
}

export default async function ReportsViewerPage({ params, searchParams }: PageProps) {
  const { reportId: reportIdRaw } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const backNavigation = resolveReportsBackHref(resolvedSearchParams);
  const reportId = Number.parseInt(reportIdRaw, 10);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return renderCenteredCard({
      title: "Saved Report",
      message: "The selected report could not be found.",
      href: backNavigation.href,
      actionLabel: backNavigation.label,
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
      href: backNavigation.href,
      actionLabel: backNavigation.label,
    });
  }
  const result = await loadReportViewerData(access, reportId);
  if (!result.ok) {
    return renderCenteredCard({
      title: "Saved Report",
      message: result.message,
      href: backNavigation.href,
      actionLabel: backNavigation.label,
    });
  }
  return <ReportsViewPage report={result.data} />;
}
