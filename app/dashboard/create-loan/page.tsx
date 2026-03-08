import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
          <Link className="mt-3 inline-block text-sm underline" href="/login">
            Go to login
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

function renderForbiddenState() {
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
          <Link className="text-sm underline" href="/dashboard">
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

function renderBranchAssignmentState() {
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
          <Link className="text-sm underline" href="/dashboard">
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}

export default async function CreateLoanPage({ searchParams }: CreateLoanPageProps) {
  const params = (await searchParams) ?? {};
  const requestedBorrowerId = String(params.borrowerId ?? "").trim();
  const pageState = await loadCreateLoanPageData(requestedBorrowerId);

  if (pageState.status === "not_logged_in") {
    return renderNotLoggedInState();
  }

  if (pageState.status === "forbidden") {
    return renderForbiddenState();
  }

  if (pageState.status === "branch_assignment_required") {
    return renderBranchAssignmentState();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create Loan</CardTitle>
          <CardDescription>Create a loan record for an existing borrower.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link className="text-sm underline" href="/dashboard">
            Back to dashboard
          </Link>
          {pageState.borrowers.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              No borrowers found. Create a borrower account first.
            </p>
          ) : null}
        </CardContent>
      </Card>

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
  );
}
