import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { ManageUserAccountsClientPage } from "@/app/dashboard/manage-user-accounts/manage-user-accounts-client-page";
import {
  parseManageUserAccountsFilters,
  resolveManageUserAccountsAccess,
} from "@/app/dashboard/manage-user-accounts/filters";
import { loadManageUserAccountsPageData } from "@/app/dashboard/manage-user-accounts/queries";
import type { ManageUserAccountsPageProps } from "@/app/dashboard/manage-user-accounts/types";

function renderCenteredCard(props: { message: string; href: string; actionLabel: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Manage User Accounts</CardTitle>
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

export default async function ManageUserAccountsPage({ searchParams }: ManageUserAccountsPageProps) {
  const auth = await getDashboardAuthContext();
  const filters = parseManageUserAccountsFilters((await searchParams) ?? {});
  const accessState = resolveManageUserAccountsAccess(auth, filters);

  if (accessState.view === "unauthenticated") {
    return renderCenteredCard({
      message: accessState.message,
      href: "/login",
      actionLabel: "Go to login",
    });
  }

  if (accessState.view === "forbidden" || accessState.view === "scope_error") {
    return renderCenteredCard({
      message: accessState.message,
      href: "/dashboard",
      actionLabel: "Back to dashboard",
    });
  }

  const pageData = await loadManageUserAccountsPageData(accessState);

  return <ManageUserAccountsClientPage initialData={pageData} initialScope={accessState} />;
}
