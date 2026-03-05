import Link from "next/link";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { areas, branch, employee_branch_assignment, roles, users } from "@/db/schema";
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

  const isAdmin = currentRole?.role_name === "Admin";
  const isBranchManager = currentRole?.role_name === "Branch Manager";
  const isSecretary = currentRole?.role_name === "Secretary";

  if (!isAdmin && !isBranchManager && !isSecretary) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are logged in, but only Admin, Branch Manager, and Secretary can access account creation.
            </p>
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  let fixedBranchId: number | null = null;
  if (!isAdmin) {
    const assignments = await db
      .select({ branch_id: employee_branch_assignment.branch_id })
      .from(employee_branch_assignment)
      .where(
        and(
          eq(employee_branch_assignment.employee_user_id, user.id),
          isNull(employee_branch_assignment.end_date),
        ),
      )
      .catch(() => []);

    const uniqueBranchIds = Array.from(new Set(assignments.map((item) => item.branch_id)));
    if (uniqueBranchIds.length !== 1) {
      return (
        <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                A single active branch assignment is required before creating accounts.
              </p>
              <Link className="text-sm underline" href="/dashboard">
                Back to dashboard
              </Link>
            </CardContent>
          </Card>
        </main>
      );
    }

    fixedBranchId = uniqueBranchIds[0];
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

  const mappedRoles: RoleRow[] = (isAdmin
    ? rolesData
    : isBranchManager
      ? rolesData.filter((item) =>
          ["Secretary", "Collector", "Borrower"].includes(item.role_name),
        )
      : rolesData.filter((item) => item.role_name === "Borrower")
  ).map((item) => ({
    role_id: String(item.role_id),
    role_name: item.role_name,
  }));

  const mappedBranches: BranchRow[] = (fixedBranchId
    ? branchesData.filter((item) => item.branch_id === fixedBranchId)
    : branchesData
  ).map((item) => ({
    branch_id: String(item.branch_id),
    branch_name: item.branch_name,
  }));

  const mappedAreas: AreaRow[] = (fixedBranchId
    ? areasData.filter((item) => item.branch_id === fixedBranchId)
    : areasData
  ).map((item) => ({
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
            {isAdmin
              ? "Admin account provisioning for employee and borrower profiles."
              : isBranchManager
                ? "Create secretary, collector, and borrower accounts within your assigned branch."
                : "Create borrower accounts within your assigned branch."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link className="text-sm underline" href="/dashboard">
            Back to dashboard
          </Link>
        </CardContent>
      </Card>

      <CreateAccountForm
        areas={mappedAreas}
        borrowerOnly={isSecretary}
        branches={mappedBranches}
        fixedBranchId={fixedBranchId ? String(fixedBranchId) : null}
        roles={mappedRoles}
      />
    </main>
  );
}
