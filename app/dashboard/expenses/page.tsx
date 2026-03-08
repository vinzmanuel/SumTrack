import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { ExpensesFilters } from "@/app/dashboard/expenses/expenses-filters";
import { parseExpensesFilters, EXPENSE_CATEGORIES, resolveExpensesPageAccess } from "@/app/dashboard/expenses/filters";
import { loadExpensesPageData } from "@/app/dashboard/expenses/queries";
import { ExpensesSummary } from "@/app/dashboard/expenses/expenses-summary";
import { ExpensesTable } from "@/app/dashboard/expenses/expenses-table";
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

  const pageData = await loadExpensesPageData(access);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
          <CardDescription>
            {access.isAdmin
              ? "Admin expense monitoring by branch, month, and category."
              : access.isAuditor
                ? "Auditor read-only expense monitoring across assigned branches."
                : "Branch expense monitoring by month and category."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/dashboard">
            <Button type="button" variant="outline">
              Back to dashboard
            </Button>
          </Link>
          {access.canCreateExpense ? (
            <Link href="/dashboard/expenses/create">
              <Button type="button" variant="secondary">
                Create expense
              </Button>
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          {access.canChooseBranch ? (
            <ExpensesFilters
              branches={pageData.branches}
              canChooseBranch
              categories={EXPENSE_CATEGORIES}
              clearHref="/dashboard/expenses"
              selectedBranchRaw={access.selectedBranchRaw}
              selectedCategory={access.selectedCategory}
              selectedMonthRaw={access.selectedMonthRaw}
            />
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="fixed_branch">
                  Branch
                </label>
                <input
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                  id="fixed_branch"
                  readOnly
                  value={access.fixedBranchName ?? "N/A"}
                />
              </div>
              <ExpensesFilters
                branches={[]}
                canChooseBranch={false}
                categories={EXPENSE_CATEGORIES}
                clearHref="/dashboard/expenses"
                selectedBranchRaw={access.selectedBranchRaw}
                selectedCategory={access.selectedCategory}
                selectedMonthRaw={access.selectedMonthRaw}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <ExpensesSummary totalAmount={pageData.totalAmount} totalExpenses={pageData.totalExpenses} />

      <Card>
        <CardHeader>
          <CardTitle>Expense Records</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpensesTable expenses={pageData.expenses} />
        </CardContent>
      </Card>
    </div>
  );
}
