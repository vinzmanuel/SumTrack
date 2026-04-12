import { Suspense } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { BorrowerRecordsModuleSkeleton } from "@/app/dashboard/borrowers/borrower-records-module-skeleton";
import { BorrowersClientPage } from "@/app/dashboard/borrowers/borrowers-client-page";
import { parseBorrowersListFilters, resolveBorrowersPageAccess } from "@/app/dashboard/borrowers/filters";
import { loadBorrowersPageData } from "@/app/dashboard/borrowers/queries";
import type { BorrowersPageProps, BorrowersStaffScope } from "@/app/dashboard/borrowers/types";

function renderCenteredCard(props: { message: string; href: string; actionLabel: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Borrowers</CardTitle>
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
          <CardTitle>Borrowers</CardTitle>
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

async function BorrowersModuleLoader({ accessState }: { accessState: BorrowersStaffScope }) {
  const pageData = await loadBorrowersPageData(accessState);
  return <BorrowersClientPage initialData={pageData} initialScope={accessState} />;
}

export default async function BorrowersPage({ searchParams }: BorrowersPageProps) {
  const auth = await getDashboardAuthContext();
  const filters = parseBorrowersListFilters((await searchParams) ?? {});
  const accessState = resolveBorrowersPageAccess(auth, filters);

  if (accessState.view === "unauthenticated") {
    return renderCenteredCard({
      message: "Not logged in",
      href: "/login",
      actionLabel: "Go to login",
    });
  }

  if (accessState.view === "forbidden") {
    return renderCenteredCard({
      message: accessState.message,
      href: "/dashboard",
      actionLabel: "Back to dashboard",
    });
  }

  if (accessState.view === "scope_error") {
    return renderScopeErrorCard(accessState.message);
  }

  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          action: null,
          description: "Browse and manage borrowers within your current branch and area scope.",
          icon: <Users className="size-9 text-sidebar-foreground/65" />,
          title: "Borrowers",
        }}
      />
      <Suspense fallback={<BorrowerRecordsModuleSkeleton canChooseBranch={accessState.canChooseBranch} showAction={accessState.roleName === "Admin" || accessState.roleName === "Branch Manager" || accessState.roleName === "Secretary"} />}>
        <BorrowersModuleLoader accessState={accessState} />
      </Suspense>
    </>
  );
}
