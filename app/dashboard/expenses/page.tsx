import Link from "next/link";
import { and, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { ExpensesFilters } from "@/app/dashboard/expenses/expenses-filters";
import { db } from "@/db";
import { branch, expenses, users } from "@/db/schema";

type PageProps = {
  searchParams?: Promise<{
    branch?: string;
    month?: string;
    category?: string;
  }>;
};

const EXPENSE_CATEGORIES = [
  "Rent",
  "Electricity",
  "Water",
  "Transportation",
  "Lunch",
  "Salary",
  "Miscellaneous",
] as const;

function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function resolveMonthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return null;
  }

  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  const startDate = new Date(Date.UTC(year, monthIndex, 1));

  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const nextMonthDate = new Date(Date.UTC(year, monthIndex + 1, 1));
  const endDate = new Date(nextMonthDate.getTime() - 86400000);

  return {
    start: startDate.toISOString().slice(0, 10),
    end: endDate.toISOString().slice(0, 10),
  };
}

export default async function ExpensesPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const selectedBranchRaw = String(params.branch ?? "all");
  const selectedMonthRaw = String(params.month ?? "");
  const selectedCategoryRaw = String(params.category ?? "all");

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

  const isAdmin = auth.roleName === "Admin";
  const isBranchManager = auth.roleName === "Branch Manager";
  const isAuditor = auth.roleName === "Auditor";

  if (!isAdmin && !isBranchManager && !isAuditor) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are logged in, but only Admin, Branch Manager, and Auditor users can view expenses.
            </p>
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const branches = await db
    .select({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
    })
    .from(branch)
    .orderBy(branch.branch_name)
    .catch(() => []);

  let fixedBranchId: number | null = null;
  let fixedBranchName: string | null = null;
  if (isBranchManager) {
    if (!auth.activeBranchId) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              No active branch assignment found.
            </p>
          </CardContent>
        </Card>
      );
    }
    fixedBranchId = auth.activeBranchId;
    fixedBranchName = auth.activeBranchName;
  }

  const selectedBranchId = (isAdmin || isAuditor) && /^\d+$/.test(selectedBranchRaw) ? Number(selectedBranchRaw) : null;
  const monthRange = selectedMonthRaw ? resolveMonthRange(selectedMonthRaw) : null;
  const selectedCategory = EXPENSE_CATEGORIES.includes(
    selectedCategoryRaw as (typeof EXPENSE_CATEGORIES)[number],
  )
    ? selectedCategoryRaw
    : "all";

  const filters: SQL[] = [];

  if (isBranchManager && fixedBranchId !== null) {
    filters.push(eq(expenses.branch_id, fixedBranchId));
  } else if ((isAdmin || isAuditor) && selectedBranchId !== null) {
    filters.push(eq(expenses.branch_id, selectedBranchId));
  } else if (isAuditor) {
    if (auth.assignedBranchIds.length === 0) {
      filters.push(eq(expenses.expense_id, -1));
    } else {
      filters.push(inArray(expenses.branch_id, auth.assignedBranchIds));
    }
  }

  if (monthRange) {
    filters.push(gte(expenses.expense_date, monthRange.start));
    filters.push(lte(expenses.expense_date, monthRange.end));
  }

  if (selectedCategory !== "all") {
    filters.push(eq(expenses.expense_category, selectedCategory));
  }

  const expenseRows = await db
    .select({
      expense_id: expenses.expense_id,
      branch_name: branch.branch_name,
      expense_category: expenses.expense_category,
      description: expenses.description,
      amount: expenses.amount,
      expense_date: expenses.expense_date,
      recorded_by_username: users.username,
      recorded_by_company_id: users.company_id,
      recorded_at: expenses.recorded_at,
    })
    .from(expenses)
    .innerJoin(branch, eq(branch.branch_id, expenses.branch_id))
    .leftJoin(users, eq(users.user_id, expenses.recorded_by))
    .where(filters.length === 0 ? undefined : filters.length === 1 ? filters[0] : and(...filters))
    .orderBy(desc(expenses.expense_date), desc(expenses.expense_id))
    .catch(() => []);

  const totalExpenses = expenseRows.length;
  const totalAmount = expenseRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const selectableBranches = isAuditor
    ? branches.filter((item) => auth.assignedBranchIds.includes(item.branch_id))
    : branches;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Expenses</CardTitle>
          <CardDescription>
            {isAdmin
              ? "Admin expense monitoring by branch, month, and category."
              : isAuditor
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
          {isAdmin || isBranchManager ? (
            <Link href="/dashboard/expenses/create">
              <Button type="button" variant="secondary">
                Create expense
              </Button>
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          {isAdmin || isAuditor ? (
            <ExpensesFilters
              branches={selectableBranches.map((item) => ({
                branch_id: item.branch_id,
                branch_name: item.branch_name,
              }))}
              canChooseBranch
              categories={EXPENSE_CATEGORIES}
              clearHref="/dashboard/expenses"
              selectedBranchRaw={selectedBranchRaw}
              selectedCategory={selectedCategory}
              selectedMonthRaw={selectedMonthRaw}
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
                  value={fixedBranchName ?? "N/A"}
                />
              </div>
              <ExpensesFilters
                branches={[]}
                canChooseBranch={false}
                categories={EXPENSE_CATEGORIES}
                clearHref="/dashboard/expenses"
                selectedBranchRaw={selectedBranchRaw}
                selectedCategory={selectedCategory}
                selectedMonthRaw={selectedMonthRaw}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Matching Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{totalExpenses}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Matching Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatMoney(totalAmount)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Records</CardTitle>
        </CardHeader>
        <CardContent>
          {expenseRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No expenses found for the selected filters.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-300 text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-2 py-2 font-medium">Expense ID</th>
                    <th className="px-2 py-2 font-medium">Branch</th>
                    <th className="px-2 py-2 font-medium">Category</th>
                    <th className="px-2 py-2 font-medium">Description</th>
                    <th className="px-2 py-2 font-medium">Amount</th>
                    <th className="px-2 py-2 font-medium">Expense Date</th>
                    <th className="px-2 py-2 font-medium">Recorded By</th>
                    <th className="px-2 py-2 font-medium">Recorded At</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseRows.map((row) => (
                    <tr className="border-b" key={row.expense_id}>
                      <td className="px-2 py-2">{row.expense_id}</td>
                      <td className="px-2 py-2">{row.branch_name}</td>
                      <td className="px-2 py-2">{row.expense_category}</td>
                      <td className="px-2 py-2">{row.description || "-"}</td>
                      <td className="px-2 py-2">{formatMoney(Number(row.amount) || 0)}</td>
                      <td className="px-2 py-2">{row.expense_date}</td>
                      <td className="px-2 py-2">
                        {row.recorded_by_company_id || row.recorded_by_username || "N/A"}
                      </td>
                      <td className="px-2 py-2">{row.recorded_at || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
