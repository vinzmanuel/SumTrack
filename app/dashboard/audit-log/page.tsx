import Link from "next/link";
import { AuditLogClientPage } from "@/app/dashboard/audit-log/audit-log-client-page";
import {
  loadAuditLogPageData,
  parseAuditLogFilters,
  resolveAuditLogAccess,
} from "@/app/dashboard/audit-log/queries";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AuditLogPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function renderCenteredCard(props: { title: string; message: string; href: string; actionLabel: string }) {
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

export default async function AuditLogPage({ searchParams }: AuditLogPageProps) {
  const auth = await getDashboardAuthContext();
  const access = resolveAuditLogAccess(auth);

  if (access.view === "unauthenticated") {
    return renderCenteredCard({
      title: "Audit Log",
      message: access.message,
      href: "/login",
      actionLabel: "Go to login",
    });
  }

  if (access.view === "forbidden" || access.view === "scope_error") {
    return renderCenteredCard({
      title: "Audit Log",
      message: access.message,
      href: "/dashboard",
      actionLabel: "Back to dashboard",
    });
  }

  if (access.view !== "ready") {
    return null;
  }

  const filters = parseAuditLogFilters((await searchParams) ?? {});
  const pageData = await loadAuditLogPageData(access, filters);
  return <AuditLogClientPage canChooseBranch={access.canChooseBranch} initialData={pageData} />;
}
