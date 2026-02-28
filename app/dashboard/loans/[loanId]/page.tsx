import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

type LoanRow = {
  loan_id: string | number;
  borrower_id: string;
  principal: number | string;
  interest: number | string;
  start_date: string;
  due_date: string;
  branch_id: string | number;
  status: string;
};

type BorrowerInfoRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  contact_number: string | null;
  address: string | null;
};

type BorrowerUserRow = {
  user_id: string;
  username: string | null;
};

type BranchRow = {
  branch_id: string | number;
  branch_name: string;
  branch_address: string | null;
};

type CollectionRow = {
  collection_id: string | number;
  amount: number | string;
  note: string | null;
  collector_id: string | null;
  collection_date: string;
};

type CollectorUserRow = {
  user_id: string;
  username: string | null;
};

type EmployeeInfoRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
};

type AssignmentRow = {
  employee_user_id: string;
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
  return value.toFixed(2);
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

  const { data: loan } = await supabase
    .from("loan_records")
    .select("loan_id, borrower_id, principal, interest, start_date, due_date, branch_id, status")
    .eq("loan_id", toDbId(loanId))
    .maybeSingle<LoanRow>();

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

  const { data: borrowerInfo } = await supabase
    .from("borrower_info")
    .select("user_id, first_name, last_name, contact_number, address")
    .eq("user_id", loan.borrower_id)
    .maybeSingle<BorrowerInfoRow>();

  const { data: borrowerUser } = await supabase
    .from("users")
    .select("user_id, username")
    .eq("user_id", loan.borrower_id)
    .maybeSingle<BorrowerUserRow>();

  const { data: branch } = await supabase
    .from("branch")
    .select("branch_id, branch_name, branch_address")
    .eq("branch_id", loan.branch_id)
    .maybeSingle<BranchRow>();

  const { data: collectionsData } = await supabase
    .from("collections")
    .select("collection_id, amount, note, collector_id, collection_date")
    .eq("loan_id", toDbId(loanId))
    .order("collection_date", { ascending: true })
    .order("collection_id", { ascending: true });

  const collections = (collectionsData ?? []) as CollectionRow[];

  const { data: collectorRole } = await supabase
    .from("roles")
    .select("role_id, role_name")
    .eq("role_name", "Collector")
    .maybeSingle<RoleRow>();

  const { data: activeAssignmentsData } = await supabase
    .from("employee_branch_assignment")
    .select("employee_user_id")
    .eq("branch_id", loan.branch_id)
    .is("end_date", null);

  const activeAssignments = (activeAssignmentsData ?? []) as AssignmentRow[];
  const assignedCollectorIds = Array.from(
    new Set(activeAssignments.map((assignment) => assignment.employee_user_id)),
  );

  const { data: collectorUsersData } =
    collectorRole?.role_id && assignedCollectorIds.length
      ? await supabase
          .from("users")
          .select("user_id, username")
          .eq("role_id", collectorRole.role_id)
          .in("user_id", assignedCollectorIds)
          .order("username")
      : { data: [] };

  const collectorUsers = (collectorUsersData ?? []) as CollectorUserRow[];
  const collectorUserIds = collectorUsers.map((collector) => collector.user_id);

  const { data: collectorEmployeesData } = collectorUserIds.length
    ? await supabase
        .from("employee_info")
        .select("user_id, first_name, last_name")
        .in("user_id", collectorUserIds)
    : { data: [] };

  const collectorEmployees = (collectorEmployeesData ?? []) as EmployeeInfoRow[];
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

  const initialCollectionRows: CollectionHistoryRow[] = collections.map((collection) => ({
    collectionId: String(collection.collection_id),
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
  const accountNumber = borrowerUser?.username || loan.borrower_id;
  const borrowerAddress = borrowerInfo?.address || "N/A";

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
            <span className="font-medium">Account Number:</span> {accountNumber}
          </p>
          <p>
            <span className="font-medium">Branch:</span> {branch?.branch_name || "N/A"}
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
