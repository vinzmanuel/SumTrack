import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { BranchDetailClientPage } from "@/app/dashboard/branches/branch-detail-client-page";
import {
  loadBranchDetailOverviewByCode,
  loadBranchEmployeesTabDataByCode,
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
          <Link className="text-sm underline" href={props.href}>
            {props.actionLabel}
          </Link>
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
  const [branch, employeesData] = await Promise.all([
    loadBranchDetailOverviewByCode(access, branchCode),
    loadBranchEmployeesTabDataByCode(access, branchCode),
  ]);
  if (!branch || !employeesData) {
    notFound();
  }

  const defaultBackHref = "/dashboard/branches";
  const rawReturnTo = resolvedSearchParams.returnTo?.trim();
  const safeReturnTo =
    rawReturnTo && rawReturnTo.startsWith("/dashboard") ? rawReturnTo : defaultBackHref;
  const backLabel =
    resolvedSearchParams.source === "branches" || !resolvedSearchParams.source
      ? "Back to Branches"
      : "Back";

  return (
    <BranchDetailClientPage
      backHref={safeReturnTo}
      backLabel={backLabel}
      data={branch}
      employeesData={employeesData}
      initialTab={initialTab}
    />
  );
}
