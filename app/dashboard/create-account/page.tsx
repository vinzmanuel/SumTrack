import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { areas, roles, users, branch } from "@/db/schema";
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

type AreaRow = {
  area_id: string;
  branch_id: string;
  area_no: string;
  area_code: string;
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

  const currentAppUser = await db
    .select({ role_id: users.role_id })
    .from(users)
    .where(eq(users.user_id, user.id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const currentRole = currentAppUser?.role_id
    ? await db
        .select({
          role_id: roles.role_id,
          role_name: roles.role_name,
        })
        .from(roles)
        .where(eq(roles.role_id, currentAppUser.role_id))
        .limit(1)
        .then((rows) => rows[0] ?? null)
        .catch(() => null)
    : null;

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

  const rolesData = await db
    .select({
      role_id: roles.role_id,
      role_name: roles.role_name,
    })
    .from(roles)
    .where(inArray(roles.role_name, ALLOWED_ROLE_NAMES))
    .orderBy(roles.role_name)
    .catch(() => []);

  const branchesData = await db
    .select({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
    })
    .from(branch)
    .orderBy(branch.branch_name)
    .catch(() => []);

  const areasData = await db
    .select({
      area_id: areas.area_id,
      branch_id: areas.branch_id,
      area_no: areas.area_no,
      area_code: areas.area_code,
    })
    .from(areas)
    .orderBy(areas.area_code)
    .catch(() => []);

  const mappedRoles: RoleRow[] = rolesData.map((item) => ({
    role_id: String(item.role_id),
    role_name: item.role_name,
  }));

  const mappedBranches: BranchRow[] = branchesData.map((item) => ({
    branch_id: String(item.branch_id),
    branch_name: item.branch_name,
  }));

  const mappedAreas: AreaRow[] = areasData.map((item) => ({
    area_id: String(item.area_id),
    branch_id: String(item.branch_id),
    area_no: item.area_no,
    area_code: item.area_code,
  }));

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

      <CreateAccountForm areas={mappedAreas} branches={mappedBranches} roles={mappedRoles} />
    </main>
  );
}
