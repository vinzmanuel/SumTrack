import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { branch, employee_branch_assignment, roles, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { CreateExpenseForm } from "@/app/dashboard/expenses/create/create-expense-form";

export default async function CreateExpensePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create Expense</CardTitle>
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

  const currentAppUser = await db
    .select({
      role_id: users.role_id,
    })
    .from(users)
    .where(eq(users.user_id, user.id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const currentRole = currentAppUser?.role_id
    ? await db
        .select({
          role_name: roles.role_name,
        })
        .from(roles)
        .where(eq(roles.role_id, currentAppUser.role_id))
        .limit(1)
        .then((rows) => rows[0] ?? null)
        .catch(() => null)
    : null;

  if (currentRole?.role_name !== "Branch Manager") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create Expense</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are logged in, but only Branch Manager users can record expenses.
            </p>
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const activeAssignments = await db
    .select({
      branch_id: employee_branch_assignment.branch_id,
    })
    .from(employee_branch_assignment)
    .where(
      and(
        eq(employee_branch_assignment.employee_user_id, user.id),
        isNull(employee_branch_assignment.end_date),
      ),
    )
    .catch(() => []);

  if (activeAssignments.length === 0) {
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
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const uniqueBranchIds = Array.from(new Set(activeAssignments.map((assignment) => assignment.branch_id)));

  if (uniqueBranchIds.length !== 1) {
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
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const branchRow = await db
    .select({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
    })
    .from(branch)
    .where(eq(branch.branch_id, uniqueBranchIds[0]))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!branchRow) {
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
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create Expense</CardTitle>
          <CardDescription>Record branch operating expenses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link className="text-sm underline" href="/dashboard">
            Back to dashboard
          </Link>
        </CardContent>
      </Card>

      <CreateExpenseForm branchName={branchRow.branch_name} />
    </main>
  );
}
