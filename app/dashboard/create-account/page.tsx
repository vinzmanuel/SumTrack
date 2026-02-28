import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { CreateAccountForm } from "@/app/dashboard/create-account/create-account-form";

type RoleRow = {
  role_id: string;
  role_name: string;
};

type BranchRow = {
  branch_id: string;
  branch_name: string;
};

type AppUserRow = {
  role_id: string | null;
};

const ALLOWED_ROLE_NAMES = [
  "Admin",
  "Auditor",
  "Branch Manager",
  "Secretary",
  "Collector",
  "Borrower",
];

export default async function CreateAccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
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
            <CardTitle>Create Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are logged in, but only Admin users can create accounts.
            </p>
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { data: rolesData } = await supabase
    .from("roles")
    .select("role_id, role_name")
    .in("role_name", ALLOWED_ROLE_NAMES)
    .order("role_name");

  const { data: branchesData } = await supabase
    .from("branch")
    .select("branch_id, branch_name")
    .order("branch_name");

  const roles = (rolesData ?? []) as RoleRow[];
  const branches = (branchesData ?? []) as BranchRow[];

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>
            Admin-only account provisioning for employee and borrower profiles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link className="text-sm underline" href="/dashboard">
            Back to dashboard
          </Link>
        </CardContent>
      </Card>

      <CreateAccountForm branches={branches} roles={roles} />
    </main>
  );
}
