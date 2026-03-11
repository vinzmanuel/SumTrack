import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { ExpensesClientPage } from "@/app/dashboard/expenses/expenses-client-page";
import { parseExpensesFilters, resolveExpensesPageAccess } from "@/app/dashboard/expenses/filters";
import { loadExpensesBranchOptions, loadExpensesResultsData } from "@/app/dashboard/expenses/queries";
import type { ExpensesPageProps } from "@/app/dashboard/expenses/types";
export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = parseExpensesFilters((await searchParams) ?? {});

  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const access = resolveExpensesPageAccess(auth, params);

  if (access.view === "forbidden") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{access.message}</p>
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (access.view === "branch_error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-700 dark:text-amber-400">{access.message}</p>
        </CardContent>
      </Card>
    );
  }

  const description = access.isAdmin
    ? "Admin expense monitoring by branch, month, and category."
    : access.isAuditor
      ? "Auditor read-only expense monitoring across assigned branches."
      : "Branch expense monitoring by month and category.";
  const [branchOptions, initialResults] = await Promise.all([
    loadExpensesBranchOptions(access),
    loadExpensesResultsData(access),
  ]);

  return (
    <ExpensesClientPage
      branchOptions={branchOptions}
      canChooseBranch={access.canChooseBranch}
      canCreateExpense={access.canCreateExpense}
      description={description}
      fixedBranchName={access.fixedBranchName}
      initialFilters={{
        branch: access.canChooseBranch && access.resolvedBranchId ? String(access.resolvedBranchId) : "all",
        month: access.selectedMonthRaw,
        category: access.selectedCategory,
        page: access.page,
      }}
      initialResults={initialResults}
    />
  );
}
