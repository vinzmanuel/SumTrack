import { ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardBackLink } from "@/app/dashboard/_components/dashboard-back-link";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { firstSearchValue, resolveBackNavigation } from "@/app/dashboard/back-navigation";
import { CreateLoanForm } from "@/app/dashboard/create-loan/create-loan-form";
import { loadCreateLoanPageData } from "@/app/dashboard/create-loan/queries";
import type { CreateLoanPageProps } from "@/app/dashboard/create-loan/types";

function renderNotLoggedInState() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Loan</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Not logged in</p>
          <DashboardBackLink className="mt-3" href="/login" label="Go to login" />
        </CardContent>
      </Card>
    </main>
  );
}

function renderForbiddenState(backHref: string, backLabel: string) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Loan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You are logged in, but only Admin, Branch Manager, and Secretary can create loans.
          </p>
          <DashboardBackLink href={backHref} label={backLabel} />
        </CardContent>
      </Card>
    </main>
  );
}

function renderBranchAssignmentState(backHref: string, backLabel: string) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Loan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            A single active branch assignment is required before creating loans.
          </p>
          <DashboardBackLink href={backHref} label={backLabel} />
        </CardContent>
      </Card>
    </main>
  );
}

function renderInactiveBranchState(backHref: string, backLabel: string) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Loan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Your assigned branch is inactive, so new loan creation is currently blocked there.
          </p>
          <DashboardBackLink href={backHref} label={backLabel} />
        </CardContent>
      </Card>
    </main>
  );
}

export default async function CreateLoanPage({ searchParams }: CreateLoanPageProps) {
  const params = (await searchParams) ?? {};
  const backNavigation = resolveBackNavigation({
    source: firstSearchValue(params.source),
    returnTo: firstSearchValue(params.returnTo),
    fallbackHref: "/dashboard",
    fallbackLabel: "Back to dashboard",
    allowedPrefixes: ["/dashboard/loans", "/dashboard/borrowers"],
    sourceMap: {
      loans: {
        href: "/dashboard/loans",
        label: "Back to Loans",
        allowedPrefixes: ["/dashboard/loans"],
      },
      borrowers: {
        href: "/dashboard/borrowers",
        label: "Back to Borrower",
        allowedPrefixes: ["/dashboard/borrowers"],
      },
    },
  });
  const requestedBorrowerId = String(params.borrowerId ?? "").trim();
  const pageState = await loadCreateLoanPageData(requestedBorrowerId);

  if (pageState.status === "not_logged_in") {
    return renderNotLoggedInState();
  }

  if (pageState.status === "forbidden") {
    return renderForbiddenState(backNavigation.href, backNavigation.label);
  }

  if (pageState.status === "branch_assignment_required") {
    return renderBranchAssignmentState(backNavigation.href, backNavigation.label);
  }

  if (pageState.status === "inactive_branch") {
    return renderInactiveBranchState(backNavigation.href, backNavigation.label);
  }

  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          action: null,
          description: "Create a new loan record with borrower, collector, and term details.",
          icon: <ReceiptText className="size-9 text-sidebar-foreground/65" />,
          title: "Create Loan",
          breadcrumbs: pageState.prefilledBorrower
            ? [
                { label: "Dashboard", href: "/dashboard" },
                firstSearchValue(params.source) === "manage-users"
                  ? { label: "Manage User Accounts", href: "/dashboard/manage-user-accounts" }
                  : { label: "Borrowers", href: "/dashboard/borrowers" },
                {
                  label: pageState.prefilledBorrower.breadcrumbLabel,
                  href: firstSearchValue(params.returnTo) || `/dashboard/borrowers/${pageState.prefilledBorrower.borrowerId}`,
                },
                { label: "Create Loan", current: true },
              ]
            : undefined,
        }}
      />
      <main className="mx-auto w-full max-w-5xl space-y-4">
        {pageState.borrowers.length === 0 ? (
          <div className="rounded-md border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            No borrowers found. Create a borrower account first.
          </div>
        ) : null}
        <CreateLoanForm
          activeLoanBorrowerIds={pageState.activeLoanBorrowerIds}
          areas={pageState.areas}
          branches={pageState.branches}
          borrowers={pageState.borrowers}
          collectors={pageState.collectors}
          isAdmin={pageState.isAdmin}
          prefilledBorrower={pageState.prefilledBorrower}
        />
      </main>
    </>
  );
}
