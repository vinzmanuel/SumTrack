import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  loadRecentActivityPageData,
  parseRecentActivityFilters,
  resolveRecentActivityAccess,
} from "@/app/dashboard/recent-activity/queries";
import { RecentActivityClientPage } from "@/app/dashboard/recent-activity/recent-activity-client-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type RecentActivityPageProps = {
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

export default async function RecentActivityPage({ searchParams }: RecentActivityPageProps) {
  const auth = await getDashboardAuthContext();
  const access = resolveRecentActivityAccess(auth);

  if (access.view === "unauthenticated") {
    return renderCenteredCard({
      title: "Recent Activity",
      message: access.message,
      href: "/login",
      actionLabel: "Go to login",
    });
  }

  if (access.view === "forbidden") {
    return renderCenteredCard({
      title: "Recent Activity",
      message: access.message,
      href: "/dashboard",
      actionLabel: "Back to dashboard",
    });
  }

  if (access.view === "scope_error") {
    return renderCenteredCard({
      title: "Recent Activity",
      message: access.message,
      href: "/dashboard",
      actionLabel: "Back to dashboard",
    });
  }

  const filters = parseRecentActivityFilters((await searchParams) ?? {});
  const pageData = await loadRecentActivityPageData(access, filters);
  const initialFilters = {
    preset: filters.preset,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    activityType: filters.activityType,
    actorRoleName: filters.actorRoleName,
    actorUserId: filters.actorUserId,
    branchId: filters.branchId,
  };

  return <RecentActivityClientPage initialData={pageData} initialFilters={initialFilters} />;
}
