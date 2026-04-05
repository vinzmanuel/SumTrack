import { BanknoteArrowDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardBackLink } from "@/app/dashboard/_components/dashboard-back-link";
import {
  getDashboardAuthContext,
  getSingleAssignedBranchId,
  resolveBranchNames,
} from "@/app/dashboard/auth";
import { resolveBackNavigation } from "@/app/dashboard/back-navigation";
import { CreateExpenseForm } from "@/app/dashboard/expenses/create/create-expense-form";

function renderCreateExpenseWorkspace(props: {
  backHref: string;
  backLabel: string;
  form: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 pb-6 pt-0">
      <div className="space-y-4">
        <DashboardBackLink href={props.backHref} label={props.backLabel} />

        <Card className="gap-0 overflow-hidden py-0">
          <div className="bg-gradient-to-r from-slate-50 via-background to-emerald-50/60 p-6 dark:from-zinc-950 dark:via-background dark:to-emerald-950/45">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
                <BanknoteArrowDown className="size-7 text-muted-foreground" />
                Create Expense
              </CardTitle>
              <CardDescription>Record branch operating expenses.</CardDescription>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        {props.form}
      </div>
    </main>
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
            <CardTitle>Create Expense</CardTitle>
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
            <CardTitle>Create Expense</CardTitle>
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
    const branchNames = await resolveBranchNames(auth.assignedBranchIds);
    const branchOptions = auth.assignedBranchIds
      .map((branchId) => ({
        branch_id: branchId,
        branch_name: branchNames.get(branchId) ?? `Branch ${branchId}`,
      }))
      .sort((left, right) => left.branch_name.localeCompare(right.branch_name));

    return renderCreateExpenseWorkspace({
      backHref: backNavigation.href,
      backLabel: backNavigation.label,
      form: <CreateExpenseForm branchOptions={branchOptions} canChooseBranch />,
    });
  }

  if (auth.assignedBranchIds.length === 0) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Expense</CardTitle>
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
            <CardTitle>Create Expense</CardTitle>
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
            <CardTitle>Create Expense</CardTitle>
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

  return renderCreateExpenseWorkspace({
    backHref: backNavigation.href,
    backLabel: backNavigation.label,
    form: <CreateExpenseForm branchId={branchId} branchName={auth.activeBranchName} />,
  });
}
