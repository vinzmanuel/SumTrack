import { BanknoteArrowDown } from "lucide-react";
import { and, eq, inArray } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardBackLink } from "@/app/dashboard/_components/dashboard-back-link";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import {
  getDashboardAuthContext,
  getSingleAssignedBranchId,
} from "@/app/dashboard/auth";
import { resolveBackNavigation } from "@/app/dashboard/back-navigation";
import { CreateExpenseForm } from "@/app/dashboard/expenses/create/create-expense-form";
import { db } from "@/db";
import { branch } from "@/db/schema";

function renderCreateExpenseWorkspace(props: {
  form: React.ReactNode;
}) {
  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          icon: <BanknoteArrowDown className="size-9 text-sidebar-foreground/65" />,
          title: "Record Expense",
          description: "Record branch operating expenses.",
        }}
      />
      <div className="mx-auto w-full max-w-5xl space-y-4">
        {props.form}
      </div>
    </>
  );
}

export default async function CreateExpensePage({
  searchParams,
}: {
  searchParams?: Promise<{ source?: string; returnTo?: string | string[] }>;
}) {
  const auth = await getDashboardAuthContext();
  const resolvedSearchParams = (await searchParams) ?? {};
  const backNavigation = resolveBackNavigation({
    source: typeof resolvedSearchParams.source === "string" ? resolvedSearchParams.source : null,
    returnTo: Array.isArray(resolvedSearchParams.returnTo)
      ? resolvedSearchParams.returnTo[0]
      : resolvedSearchParams.returnTo,
    fallbackHref: "/dashboard",
    fallbackLabel: "Back to dashboard",
    allowedPrefixes: ["/dashboard/expenses"],
    sourceMap: {
      expenses: {
        href: "/dashboard/expenses",
        label: "Back to Expenses",
        allowedPrefixes: ["/dashboard/expenses"],
      },
    },
  });

  if (!auth.ok) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Record Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Not logged in</p>
            <DashboardBackLink className="mt-3" href="/login" label="Go to login" />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (auth.roleName !== "Admin" && auth.roleName !== "Branch Manager") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Record Expense</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are logged in, but only Admin and Branch Manager users can record expenses.
            </p>
            <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (auth.roleName === "Admin") {
    const activeBranchRows = auth.assignedBranchIds.length
      ? await db
          .select({
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
          })
          .from(branch)
          .where(and(inArray(branch.branch_id, auth.assignedBranchIds), eq(branch.status, "active")))
          .orderBy(branch.branch_name)
          .catch(() => [])
      : [];

    const branchOptions = activeBranchRows.map((row) => ({
      branch_id: row.branch_id,
      branch_name: row.branch_name,
    }));

    if (branchOptions.length === 0) {
      return (
        <main className="mx-auto min-h-screen w-full max-w-4xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>Record Expense</CardTitle>
              <CardDescription>Active Branch Required</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                No active branch is available in your scope. Expenses can only be recorded for active branches.
              </p>
              <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />
            </CardContent>
          </Card>
        </main>
      );
    }

    return renderCreateExpenseWorkspace({
      form: <CreateExpenseForm branchOptions={branchOptions} canChooseBranch />,
    });
  }

  if (auth.assignedBranchIds.length === 0) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Record Expense</CardTitle>
            <CardDescription>Branch Manager Expense Entry</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              No active branch assignment found. You cannot record expenses until an active branch assignment is set.
            </p>
            <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />
          </CardContent>
        </Card>
      </main>
    );
  }

  const branchId = getSingleAssignedBranchId(auth);
  if (branchId === null) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Record Expense</CardTitle>
            <CardDescription>Branch Manager Expense Entry</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Multiple active branch assignments detected. Please contact Admin to resolve assignments before recording expenses.
            </p>
            <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!auth.activeBranchName) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Record Expense</CardTitle>
            <CardDescription>Branch Manager Expense Entry</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Active branch assignment points to an invalid branch.
            </p>
            <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />
          </CardContent>
        </Card>
      </main>
    );
  }

  const activeBranchRow = await db
    .select({ branch_id: branch.branch_id })
    .from(branch)
    .where(and(eq(branch.branch_id, branchId), eq(branch.status, "active")))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!activeBranchRow) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Record Expense</CardTitle>
            <CardDescription>Branch Manager Expense Entry</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Your assigned branch is inactive. Expenses can only be recorded for active branches.
            </p>
            <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />
          </CardContent>
        </Card>
      </main>
    );
  }

  return renderCreateExpenseWorkspace({
    form: <CreateExpenseForm branchId={branchId} branchName={auth.activeBranchName} />,
  });
}
