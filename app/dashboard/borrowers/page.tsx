import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { BorrowersFilters } from "@/app/dashboard/borrowers/borrowers-filters";
import { BorrowersTable } from "@/app/dashboard/borrowers/borrowers-table";
import { parseBorrowersListFilters, resolveBorrowersPageAccess } from "@/app/dashboard/borrowers/filters";
import { loadBorrowersPageData } from "@/app/dashboard/borrowers/queries";
import type { BorrowersPageProps } from "@/app/dashboard/borrowers/types";

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

  const pageData = await loadBorrowersPageData(accessState);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Borrowers</CardTitle>
          <CardDescription>Browse borrower accounts and view profiles</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/dashboard">
            <Button type="button" variant="outline">
              Back to dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          {accessState.scopeMessage ? <CardDescription>{accessState.scopeMessage}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <BorrowersFilters
            allBranchLabel={accessState.allBranchLabel}
            areas={pageData.areas}
            branches={pageData.branches}
            canChooseBranch={accessState.canChooseBranch}
            selectedAreaId={pageData.selectedAreaId}
            selectedBranchId={accessState.selectedBranchId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Borrower Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <BorrowersTable borrowers={pageData.borrowers} />
        </CardContent>
      </Card>
    </div>
  );
}
