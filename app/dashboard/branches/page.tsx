import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { BranchesClientPage } from "@/app/dashboard/branches/branches-client-page";
import { loadBranchNetworkPageData } from "@/app/dashboard/branches/queries";
import { resolveBranchesPageAccess } from "@/app/dashboard/branches/types";

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

export default async function BranchesPage() {
  const auth = await getDashboardAuthContext();
  const access = resolveBranchesPageAccess(auth);

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

  const pageData = await loadBranchNetworkPageData(access);

  return <BranchesClientPage data={pageData} />;
}
