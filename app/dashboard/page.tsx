import Link from "next/link";
import { count, desc, eq, inArray, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { db } from "@/db";
import {
  borrower_docs,
  borrower_info,
  branch,
  collections,
  loan_docs,
  loan_records,
} from "@/db/schema";

function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function DashboardPage() {
  const auth = await requireDashboardAuth();

  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (auth.roleName === "Collector") {
    const assignedLoanRows = await db
      .select({
        loan_id: loan_records.loan_id,
        loan_code: loan_records.loan_code,
      })
      .from(loan_records)
      .where(eq(loan_records.collector_id, auth.userId))
      .orderBy(desc(loan_records.loan_id))
      .limit(5)
      .catch(() => []);

    const totals = await db
      .select({
        total: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(eq(loan_records.collector_id, auth.userId))
      .then((rows) => rows[0] ?? { total: 0 })
      .catch(() => ({ total: 0 }));

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>My Performance</CardTitle>
            <CardDescription>Collector snapshot</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <p>
              <span className="font-medium">Assigned Loans:</span> {assignedLoanRows.length}
            </p>
            <p>
              <span className="font-medium">Total Collected:</span> {formatMoney(Number(totals.total) || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/dashboard/assigned-loans">
              <Button type="button">Assigned Loans</Button>
            </Link>
            <Link href="/dashboard/my-collections">
              <Button type="button" variant="secondary">
                My Collections
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (auth.roleName === "Borrower") {
    const myLoanCount = await db
      .select({ value: count() })
      .from(loan_records)
      .where(eq(loan_records.borrower_id, auth.userId))
      .then((rows) => Number(rows[0]?.value ?? 0))
      .catch(() => 0);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>My Dashboard</CardTitle>
            <CardDescription>Borrower account overview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Company ID:</span> {auth.companyId}
            </p>
            <p>
              <span className="font-medium">Active Loans:</span> {myLoanCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/dashboard/my-loans">
              <Button type="button">My Loans</Button>
            </Link>
            <Link href="/dashboard/my-documents">
              <Button type="button" variant="secondary">
                My Documents
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (auth.roleName === "Admin") {
    const branchesCount = await db
      .select({ value: count() })
      .from(branch)
      .then((rows) => Number(rows[0]?.value ?? 0))
      .catch(() => 0);
    const borrowersCount = await db
      .select({ value: count() })
      .from(borrower_info)
      .then((rows) => Number(rows[0]?.value ?? 0))
      .catch(() => 0);
    const loansCount = await db
      .select({ value: count() })
      .from(loan_records)
      .then((rows) => Number(rows[0]?.value ?? 0))
      .catch(() => 0);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin Dashboard</CardTitle>
            <CardDescription>System-wide operational summary</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            <p><span className="font-medium">Branches:</span> {branchesCount}</p>
            <p><span className="font-medium">Borrowers:</span> {borrowersCount}</p>
            <p><span className="font-medium">Loans:</span> {loansCount}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (auth.roleName === "Branch Manager" || auth.roleName === "Secretary") {
    if (!auth.activeBranchId) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              No active branch assignment found.
            </p>
          </CardContent>
        </Card>
      );
    }

    const branchBorrowers = await db
      .select({ value: count() })
      .from(borrower_info)
      .innerJoin(branch, eq(branch.branch_id, auth.activeBranchId))
      .innerJoin(loan_records, eq(loan_records.borrower_id, borrower_info.user_id))
      .where(eq(loan_records.branch_id, auth.activeBranchId))
      .then((rows) => Number(rows[0]?.value ?? 0))
      .catch(() => 0);

    const branchLoans = await db
      .select({ value: count() })
      .from(loan_records)
      .where(eq(loan_records.branch_id, auth.activeBranchId))
      .then((rows) => Number(rows[0]?.value ?? 0))
      .catch(() => 0);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{auth.roleName} Dashboard</CardTitle>
            <CardDescription>Branch: {auth.activeBranchName ?? "N/A"}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <p><span className="font-medium">Branch Borrowers:</span> {branchBorrowers}</p>
            <p><span className="font-medium">Branch Loans:</span> {branchLoans}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (auth.roleName === "Auditor") {
    const scopedBranchIds = auth.assignedBranchIds;
    const loansCount = scopedBranchIds.length
      ? await db
          .select({ value: count() })
          .from(loan_records)
          .where(inArray(loan_records.branch_id, scopedBranchIds))
          .then((rows) => Number(rows[0]?.value ?? 0))
          .catch(() => 0)
      : 0;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Auditor Dashboard</CardTitle>
            <CardDescription>Read-only across assigned branches</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-medium">Assigned Branches:</span> {scopedBranchIds.length}</p>
            <p><span className="font-medium">Visible Loans:</span> {loansCount}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const myBorrowerDocs = auth.borrowerId
    ? await db
        .select({ value: count() })
        .from(borrower_docs)
        .where(eq(borrower_docs.borrower_id, auth.borrowerId))
        .then((rows) => Number(rows[0]?.value ?? 0))
        .catch(() => 0)
    : 0;

  const myLoanDocCount = await db
    .select({ value: count() })
    .from(loan_docs)
    .innerJoin(loan_records, eq(loan_records.loan_id, loan_docs.loan_id))
    .where(eq(loan_records.borrower_id, auth.userId))
    .then((rows) => Number(rows[0]?.value ?? 0))
    .catch(() => 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p><span className="font-medium">Borrower Documents:</span> {myBorrowerDocs}</p>
        <p><span className="font-medium">Loan Documents:</span> {myLoanDocCount}</p>
      </CardContent>
    </Card>
  );
}
