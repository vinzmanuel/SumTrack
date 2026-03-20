import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { resolveReportsPageAccess } from "@/app/dashboard/reports/access";
import { loadReportsPageData } from "@/app/dashboard/reports/queries";
import { ReportsClientPage } from "@/app/dashboard/reports/reports-client-page";

function renderCenteredCard(props: { message: string; href: string; actionLabel: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reports</CardTitle>
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

function renderScopeErrorCard(message: string) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-amber-700 dark:text-amber-400">{message}</p>
          <Link className="text-sm underline" href="/dashboard">
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

export default async function ReportsPage() {
  const auth = await getDashboardAuthContext();
  const access = resolveReportsPageAccess(auth);

  if (access.view === "unauthenticated") {
    return renderCenteredCard({
      message: access.message,
      href: "/login",
      actionLabel: "Go to login",
    });
  }

  if (access.view === "forbidden") {
    return renderCenteredCard({
      message: access.message,
      href: "/dashboard",
      actionLabel: "Back to dashboard",
    });
  }

  if (access.view === "scope_error") {
    return renderScopeErrorCard(access.message);
  }

  const pageData = await loadReportsPageData(access);

  return <ReportsClientPage access={access} pageData={pageData} />;
}
