import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardBackLink } from "@/app/dashboard/_components/dashboard-back-link";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { BranchDetailClientPage } from "@/app/dashboard/branches/branch-detail-client-page";
import {
  loadBranchAreasTabDataByCode,
  loadBranchDetailOverviewByCode,
  loadBranchEmployeesTabDataByCode,
  resolveBranchActionPermissions,
} from "@/app/dashboard/branches/queries";
import {
  parseBranchDetailTab,
  resolveBranchDetailAccess,
} from "@/app/dashboard/branches/types";

type BranchDetailPageProps = {
  params: Promise<{
    branchId: string;
  }>;
  searchParams?: Promise<{
    tab?: string;
    source?: string;
    returnTo?: string;
  }>;
};

function renderCenteredCard(props: { message: string; href: string; actionLabel: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Branches</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{props.message}</p>
          <DashboardBackLink href={props.href} label={props.actionLabel} />
        </CardContent>
      </Card>
    </main>
  );
}

export default async function BranchDetailPage({ params, searchParams }: BranchDetailPageProps) {
  const auth = await getDashboardAuthContext();
  const access = resolveBranchDetailAccess(auth);

  if (access.view === "unauthenticated") {
    return renderCenteredCard({
      message: access.message,
      href: "/login",
      actionLabel: "Go to login",
    });
  }

  if (access.view === "forbidden" || access.view === "scope_error") {
    return renderCenteredCard({
      message: access.message,
      href: "/dashboard",
      actionLabel: "Back to dashboard",
    });
  }

  const branchCode = decodeURIComponent((await params).branchId).trim();
  if (!branchCode) {
    notFound();
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const initialTab = parseBranchDetailTab(resolvedSearchParams.tab);
  const [branch, employeesData, areasData] = await Promise.all([
    loadBranchDetailOverviewByCode(access, branchCode),
    loadBranchEmployeesTabDataByCode(access, branchCode),
    loadBranchAreasTabDataByCode(access, branchCode),
  ]);
  if (!branch || !employeesData || !areasData) {
    notFound();
  }

  const permissions = resolveBranchActionPermissions(access);

  return (
    <BranchDetailClientPage
      data={branch}
      areasData={areasData}
      employeesData={employeesData}
      initialTab={initialTab}
      permissions={permissions}
    />
  );
}
