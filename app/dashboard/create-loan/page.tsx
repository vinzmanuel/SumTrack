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
  first_name: string | null;
  last_name: string | null;
};

type UserRow = {
  user_id: string;
  username: string | null;
};

type BranchRow = {
  branch_id: string | number;
  branch_name: string;
};

type BorrowerOption = {
  user_id: string;
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

  if (currentRole?.role_name !== "Admin") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create Loan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are logged in, but only Admin users can create loans.
            </p>
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { data: borrowersData } = await supabase
    .from("borrower_info")
    .select("user_id, first_name, last_name")
    .order("first_name");

  const borrowerInfos = (borrowersData ?? []) as BorrowerInfoRow[];
  const borrowerUserIds = borrowerInfos.map((borrower) => borrower.user_id);

  const { data: usersData } = borrowerUserIds.length
    ? await supabase.from("users").select("user_id, username").in("user_id", borrowerUserIds)
    : { data: [] };

  const borrowerUsers = (usersData ?? []) as UserRow[];
  const usernameByUserId = new Map(borrowerUsers.map((item) => [item.user_id, item.username]));

  const borrowers: BorrowerOption[] = borrowerInfos.map((borrower) => {
    const fullName = [borrower.first_name, borrower.last_name].filter(Boolean).join(" ").trim();
    const username = usernameByUserId.get(borrower.user_id) ?? null;
    const label = fullName
      ? `${fullName}${username ? ` (${username})` : ""}`
      : username
        ? `${username} (${borrower.user_id})`
        : borrower.user_id;

    return {
      user_id: borrower.user_id,
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

      <CreateLoanForm branches={branches} borrowers={borrowers} />
    </main>
  );
}
