import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { CreateLoanForm } from "@/app/dashboard/create-loan/create-loan-form";

type RoleRow = {
  role_id: string;
  role_name: string;
};

type AppUserRow = {
  role_id: string | null;
};

type BorrowerInfoRow = {
  user_id: string;
  area_id: string | number;
  first_name: string | null;
  last_name: string | null;
};

type UserRow = {
  user_id: string;
  company_id: string | null;
  username: string | null;
};

type BranchRow = {
  branch_id: string | number;
  branch_name: string;
};

type AreaRow = {
  area_id: string | number;
  branch_id: string | number;
  area_no: string;
  area_code: string;
};

type CollectorUserRow = {
  user_id: string;
  username: string | null;
};

type CollectorInfoRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
};

type CollectorAssignmentRow = {
  employee_user_id: string;
  area_id: string | number;
  end_date: string | null;
};

type CollectorOption = {
  user_id: string;
  area_id: string | number;
  label: string;
};

type BorrowerOption = {
  user_id: string;
  area_id: string | number;
  company_id: string | null;
  label: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
};

export default async function CreateLoanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create Loan</CardTitle>
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

  const isAdmin = currentRole?.role_name === "Admin";

  const { data: borrowersData } = await supabase
    .from("borrower_info")
    .select("user_id, area_id, first_name, last_name")
    .order("first_name");

  const borrowerInfos = (borrowersData ?? []) as BorrowerInfoRow[];
  const borrowerUserIds = borrowerInfos.map((borrower) => borrower.user_id);

  const { data: usersData } = borrowerUserIds.length
    ? await supabase
        .from("users")
        .select("user_id, company_id, username")
        .in("user_id", borrowerUserIds)
    : { data: [] };

  const borrowerUsers = (usersData ?? []) as UserRow[];
  const borrowerUserByUserId = new Map(borrowerUsers.map((item) => [item.user_id, item]));

  const borrowers: BorrowerOption[] = borrowerInfos.map((borrower) => {
    const borrowerUser = borrowerUserByUserId.get(borrower.user_id);
    const companyId = borrowerUser?.company_id ?? null;
    const username = borrowerUser?.username ?? null;
    const fullName = [borrower.first_name, borrower.last_name].filter(Boolean).join(" ").trim();
    const label = fullName
      ? `${fullName}${companyId ? ` (${companyId})` : username ? ` (${username})` : ""}`
      : companyId
        ? `${companyId} (${borrower.user_id})`
        : username
          ? `${username} (${borrower.user_id})`
        : borrower.user_id;

    return {
      user_id: borrower.user_id,
      area_id: borrower.area_id,
      company_id: companyId,
      full_name: fullName || borrower.user_id,
      first_name: borrower.first_name,
      last_name: borrower.last_name,
      username,
      label,
    };
  });

  const { data: branchesData } = await supabase
    .from("branch")
    .select("branch_id, branch_name")
    .order("branch_name");

  const branches = (branchesData ?? []) as BranchRow[];
  const { data: areasData } = await supabase
    .from("areas")
    .select("area_id, branch_id, area_no, area_code")
    .order("area_code");
  const areas = (areasData ?? []) as AreaRow[];

  const { data: collectorRole } = await supabase
    .from("roles")
    .select("role_id, role_name")
    .eq("role_name", "Collector")
    .maybeSingle<RoleRow>();

  const { data: collectorUsersData } = collectorRole?.role_id
    ? await supabase
        .from("users")
        .select("user_id, username")
        .eq("role_id", collectorRole.role_id)
    : { data: [] };
  const collectorUsers = (collectorUsersData ?? []) as CollectorUserRow[];
  const collectorUserIds = collectorUsers.map((collector) => collector.user_id);

  const { data: collectorInfosData } = collectorUserIds.length
    ? await supabase
        .from("employee_info")
        .select("user_id, first_name, last_name")
        .in("user_id", collectorUserIds)
    : { data: [] };
  const collectorInfos = (collectorInfosData ?? []) as CollectorInfoRow[];
  const collectorInfoByUserId = new Map(collectorInfos.map((item) => [item.user_id, item]));

  const { data: assignmentsData } = collectorUserIds.length
    ? await supabase
        .from("employee_area_assignment")
        .select("employee_user_id, area_id, end_date")
        .in("employee_user_id", collectorUserIds)
        .is("end_date", null)
    : { data: [] };
  const activeCollectorAssignments = (assignmentsData ?? []) as CollectorAssignmentRow[];

  const collectors: CollectorOption[] = activeCollectorAssignments.map((assignment) => {
    const collectorUser = collectorUsers.find((collector) => collector.user_id === assignment.employee_user_id) ?? null;
    const collectorInfo = collectorInfoByUserId.get(assignment.employee_user_id);
    const fullName = [collectorInfo?.first_name, collectorInfo?.last_name].filter(Boolean).join(" ");
    const label = fullName
      ? `${fullName}${collectorUser?.username ? ` (${collectorUser.username})` : ""}`
      : collectorUser?.username || assignment.employee_user_id;

    return {
      user_id: assignment.employee_user_id,
      area_id: assignment.area_id,
      label,
    };
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create Loan</CardTitle>
          <CardDescription>Create a loan record for an existing borrower.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link className="text-sm underline" href="/dashboard">
            Back to dashboard
          </Link>
          {borrowers.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              No borrowers found. Create a borrower account first.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <CreateLoanForm
        areas={areas}
        branches={branches}
        borrowers={borrowers}
        collectors={collectors}
        isAdmin={isAdmin}
      />
    </main>
  );
}
