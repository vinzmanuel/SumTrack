import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { parseLoansListFilters, resolveLoansPageAccess } from "@/app/dashboard/loans/filters";
import { LoansFilters } from "@/app/dashboard/loans/loans-filters";
import { loadStaffLoansPageData } from "@/app/dashboard/loans/queries";
import { LoansTable } from "@/app/dashboard/loans/loans-table";
import type { LoansPageProps } from "@/app/dashboard/loans/types";

function renderRoleRedirectCard(props: {
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loans</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{props.description}</p>
        <Link href={props.href}>
          <Button size="sm" type="button">
            {props.actionLabel}
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default async function LoansPage({ searchParams }: LoansPageProps) {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const params = parseLoansListFilters((await searchParams) ?? {});
  const accessState = resolveLoansPageAccess(auth, params);

  if (accessState.view === "collector_redirect") {
    return renderRoleRedirectCard({
      description: "Use Assigned Loans to view your loan portfolio.",
      href: "/dashboard/assigned-loans",
      actionLabel: "Go to Assigned Loans",
    });
  }

  if (accessState.view === "borrower_redirect") {
    return renderRoleRedirectCard({
      description: "Use My Loans to view your account.",
      href: "/dashboard/my-loans",
      actionLabel: "Go to My Loans",
    });
  }

  if (accessState.view === "forbidden") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{accessState.message}</p>
        </CardContent>
      </Card>
    );
  }

  const pageData = await loadStaffLoansPageData(accessState);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {accessState.canChooseBranchFilter ? (
            <LoansFilters
              branches={pageData.branchOptions}
              selectedBranchId={accessState.selectedBranchId}
            />
          ) : null}

          {accessState.canCreateLoan ? (
            <Link href="/dashboard/create-loan">
              <Button size="sm" type="button" variant="secondary">
                Create loan
              </Button>
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loan Records</CardTitle>
        </CardHeader>
        <CardContent>
          <LoansTable loans={pageData.loans} />
        </CardContent>
      </Card>
    </div>
  );
}
