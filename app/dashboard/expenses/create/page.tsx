import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getDashboardAuthContext,
  getSingleAssignedBranchId,
} from "@/app/dashboard/auth";
import { CreateExpenseForm } from "@/app/dashboard/expenses/create/create-expense-form";

export default async function CreateExpensePage() {
  const auth = await getDashboardAuthContext();

  if (!auth.ok) {
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

  if (auth.roleName !== "Branch Manager") {
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
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
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
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
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

      <CreateExpenseForm branchName={auth.activeBranchName} />
    </main>
  );
}
