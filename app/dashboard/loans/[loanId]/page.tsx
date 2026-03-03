import Link from "next/link";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  branch,
  collections,
  employee_area_assignment,
  employee_info,
  loan_records,
  roles,
  users,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { LoanDetailForm } from "@/app/dashboard/loans/[loanId]/loan-detail-form";
import type { CollectionHistoryRow } from "@/app/dashboard/loans/[loanId]/state";

type PageProps = {
  params: Promise<{ loanId: string }>;
};

type AppUserRow = {
  role_id: string | null;
};

type RoleRow = {
  role_id: string;
  role_name: string;
};

type CollectorOption = {
  user_id: string;
  label: string;
};

function toDbId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : value;
}

function calculateDays(startDate: string, dueDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const due = new Date(`${dueDate}T00:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) {
    return null;
  }

  const diff = Math.ceil((due.getTime() - start.getTime()) / 86400000);
  return diff > 0 ? diff : null;
}

function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function LoanDetailPage({ params }: PageProps) {
  const { loanId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loan Details</CardTitle>
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

  const { data: currentAppUser } = await supabase
    .from("users")
    .select("role_id")
    .eq("user_id", user.id)
    .maybeSingle<AppUserRow>();

  const { data: currentRole } = currentAppUser?.role_id
    ? await supabase
        .from("roles")
        .select("role_id, role_name")
        .eq("role_id", currentAppUser.role_id)
        .maybeSingle<RoleRow>()
    : { data: null };

  if (currentRole?.role_name !== "Admin") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loan Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are logged in, but only Admin users can view this page.
            </p>
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const loanIdDb = toDbId(loanId);
  const loan =
    typeof loanIdDb === "number"
      ? await db
          .select({
            loan_id: loan_records.loan_id,
            loan_code: loan_records.loan_code,
            borrower_id: loan_records.borrower_id,
            principal: loan_records.principal,
            interest: loan_records.interest,
            start_date: loan_records.start_date,
            due_date: loan_records.due_date,
            branch_id: loan_records.branch_id,
            status: loan_records.status,
          })
          .from(loan_records)
          .where(eq(loan_records.loan_id, loanIdDb))
          .limit(1)
          .then((rows) => rows[0] ?? null)
          .catch(() => null)
      : null;

  if (!loan) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loan Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Loan not found.</p>
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const borrowerInfo = await db
    .select({
      user_id: borrower_info.user_id,
      area_id: borrower_info.area_id,
      first_name: borrower_info.first_name,
      last_name: borrower_info.last_name,
      contact_number: borrower_info.contact_number,
      address: borrower_info.address,
    })
    .from(borrower_info)
    .where(eq(borrower_info.user_id, loan.borrower_id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const borrowerUser = await db
    .select({
      user_id: users.user_id,
      company_id: users.company_id,
      username: users.username,
    })
    .from(users)
    .where(eq(users.user_id, loan.borrower_id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const branchRow = await db
    .select({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
      branch_address: branch.branch_address,
    })
    .from(branch)
    .where(eq(branch.branch_id, loan.branch_id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const collectionRows = await db
    .select({
      collection_id: collections.collection_id,
      collection_code: collections.collection_code,
      amount: collections.amount,
      note: collections.note,
      collector_id: collections.collector_id,
      collection_date: collections.collection_date,
    })
    .from(collections)
    .where(eq(collections.loan_id, loan.loan_id))
    .orderBy(asc(collections.collection_date), asc(collections.collection_id))
    .catch(() => []);

  const collectorRole = await db
    .select({
      role_id: roles.role_id,
      role_name: roles.role_name,
    })
    .from(roles)
    .where(eq(roles.role_name, "Collector"))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const activeAssignments = await db
    .select({
      employee_user_id: employee_area_assignment.employee_user_id,
    })
    .from(employee_area_assignment)
    .where(
      and(
        eq(employee_area_assignment.area_id, borrowerInfo?.area_id ?? -1),
        isNull(employee_area_assignment.end_date),
      ),
    )
    .catch(() => []);

  const assignedCollectorIds = Array.from(
    new Set(activeAssignments.map((assignment) => assignment.employee_user_id)),
  );

  const collectorUsers =
    collectorRole?.role_id && assignedCollectorIds.length
      ? await db
          .select({
            user_id: users.user_id,
            username: users.username,
          })
          .from(users)
          .where(
            and(
              eq(users.role_id, collectorRole.role_id),
              inArray(users.user_id, assignedCollectorIds),
            ),
          )
          .orderBy(asc(users.username))
          .catch(() => [])
      : [];

  const collectorUserIds = collectorUsers.map((collector) => collector.user_id);

  const collectorEmployees = collectorUserIds.length
    ? await db
        .select({
          user_id: employee_info.user_id,
          first_name: employee_info.first_name,
          last_name: employee_info.last_name,
        })
        .from(employee_info)
        .where(inArray(employee_info.user_id, collectorUserIds))
        .catch(() => [])
    : [];

  const collectorEmployeeMap = new Map(
    collectorEmployees.map((employee) => [employee.user_id, employee]),
  );

  const collectorOptions: CollectorOption[] = collectorUsers.map((collector) => {
    const employee = collectorEmployeeMap.get(collector.user_id);
    const fullName = [employee?.first_name, employee?.last_name].filter(Boolean).join(" ");
    const label = fullName
      ? `${fullName}${collector.username ? ` (${collector.username})` : ""}`
      : collector.username || collector.user_id;

    return {
      user_id: collector.user_id,
      label,
    };
  });

  const collectorLabelMap = new Map(collectorOptions.map((collector) => [collector.user_id, collector.label]));

  const initialCollectionRows: CollectionHistoryRow[] = collectionRows.map((collection) => ({
    collectionId: String(collection.collection_id),
    collectionCode: collection.collection_code,
    collectionDate: collection.collection_date,
    amount: Number(collection.amount) || 0,
    note: collection.note,
    collectorName: collection.collector_id
      ? collectorLabelMap.get(collection.collector_id) || collection.collector_id
      : "N/A",
  }));

  const principal = Number(loan.principal) || 0;
  const interest = Number(loan.interest) || 0;
  const totalPayable = principal + (principal * interest) / 100;
  const durationDays = calculateDays(loan.start_date, loan.due_date);
  const estimatedDailyPayment = durationDays ? totalPayable / durationDays : null;

  const customerName =
    [borrowerInfo?.first_name, borrowerInfo?.last_name].filter(Boolean).join(" ") ||
    borrowerUser?.username ||
    loan.borrower_id;
  const borrowerCompanyId = borrowerUser?.company_id || borrowerUser?.username || loan.borrower_id;
  const borrowerAddress = borrowerInfo?.address || "N/A";
  const borrowerArea =
    borrowerInfo?.area_id !== undefined
      ? await db
          .select({
            area_code: areas.area_code,
          })
          .from(areas)
          .where(eq(areas.area_id, borrowerInfo.area_id))
          .limit(1)
          .then((rows) => rows[0] ?? null)
          .catch(() => null)
      : null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Loan Details</CardTitle>
          <CardDescription>Record collection entries and review loan history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link className="text-sm underline" href="/dashboard">
            Back to dashboard
          </Link>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Loan Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <p>
            <span className="font-medium">Customer Name:</span> {customerName}
          </p>
          <p>
            <span className="font-medium">Address:</span> {borrowerAddress}
          </p>
          <p>
            <span className="font-medium">Borrower Company ID:</span> {borrowerCompanyId}
          </p>
          <p>
            <span className="font-medium">Loan Code:</span> {loan.loan_code}
          </p>
          <p>
            <span className="font-medium">Branch:</span> {branchRow?.branch_name || "N/A"}
          </p>
          <p>
            <span className="font-medium">Area:</span> {borrowerArea?.area_code || "N/A"}
          </p>
          <p>
            <span className="font-medium">Principal:</span> {formatMoney(principal)}
          </p>
          <p>
            <span className="font-medium">Interest:</span> {interest}%
          </p>
          <p>
            <span className="font-medium">Start Date of Loan:</span> {loan.start_date}
          </p>
          <p>
            <span className="font-medium">Due Date:</span> {loan.due_date}
          </p>
          <p>
            <span className="font-medium">Status:</span> {loan.status}
          </p>
          <p>
            <span className="font-medium">Total Payable:</span> {formatMoney(totalPayable)}
          </p>
          <p>
            <span className="font-medium">Estimated Daily Payment:</span>{" "}
            {estimatedDailyPayment !== null ? formatMoney(estimatedDailyPayment) : "N/A"}
          </p>
        </CardContent>
      </Card>

      <LoanDetailForm
        collectors={collectorOptions}
        estimatedDailyPayment={estimatedDailyPayment}
        initialCollections={initialCollectionRows}
        loanId={String(loan.loan_id)}
        totalPayable={totalPayable}
      />
    </main>
  );
}

