import Link from "next/link";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { branch, employee_branch_assignment, incentive_rules, roles, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { IncentiveRulesForm } from "@/app/dashboard/incentives/rules/incentive-rules-form";

const ADMIN_MANAGEABLE_ROLES = ["Branch Manager", "Secretary", "Collector"] as const;
const BRANCH_MANAGER_MANAGEABLE_ROLES = ["Secretary", "Collector"] as const;

export default async function IncentiveRulesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Incentive Rules</CardTitle>
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
        .select({ role_name: roles.role_name })
        .from(roles)
        .where(eq(roles.role_id, currentAppUser.role_id))
        .limit(1)
        .then((rows) => rows[0] ?? null)
        .catch(() => null)
    : null;

  const isAdmin = currentRole?.role_name === "Admin";
  const isBranchManager = currentRole?.role_name === "Branch Manager";

  if (!isAdmin && !isBranchManager) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Incentive Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are logged in, but only Admin and Branch Manager users can manage incentive rules.
            </p>
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const branches = await db
    .select({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
    })
    .from(branch)
    .orderBy(asc(branch.branch_name))
    .catch(() => []);

  let fixedBranch: { branch_id: number; branch_name: string } | null = null;

  if (isBranchManager) {
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
        <main className="mx-auto min-h-screen w-full max-w-5xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>Incentive Rules</CardTitle>
              <CardDescription>Rule management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                No active branch assignment found. You cannot manage incentive rules until an active assignment is set.
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
        <main className="mx-auto min-h-screen w-full max-w-5xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>Incentive Rules</CardTitle>
              <CardDescription>Rule management</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Multiple active branch assignments detected. Please contact Admin to resolve assignments.
              </p>
              <Link className="text-sm underline" href="/dashboard">
                Back to dashboard
              </Link>
            </CardContent>
          </Card>
        </main>
      );
    }

    fixedBranch = await db
      .select({
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
      })
      .from(branch)
      .where(eq(branch.branch_id, uniqueBranchIds[0]))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null);

    if (!fixedBranch) {
      return (
        <main className="mx-auto min-h-screen w-full max-w-5xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>Incentive Rules</CardTitle>
              <CardDescription>Rule management</CardDescription>
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
  }

  const manageableRoleNames = isAdmin ? ADMIN_MANAGEABLE_ROLES : BRANCH_MANAGER_MANAGEABLE_ROLES;

  const manageableRoles = await db
    .select({
      role_id: roles.role_id,
      role_name: roles.role_name,
    })
    .from(roles)
    .where(inArray(roles.role_name, [...manageableRoleNames]))
    .orderBy(asc(roles.role_name))
    .catch(() => []);

  const existingRules = isBranchManager && fixedBranch
    ? await db
        .select({
          rule_id: incentive_rules.rule_id,
          branch_name: branch.branch_name,
          role_name: roles.role_name,
          percent_value: incentive_rules.percent_value,
          flat_amount: incentive_rules.flat_amount,
        })
        .from(incentive_rules)
        .innerJoin(branch, eq(branch.branch_id, incentive_rules.branch_id))
        .innerJoin(roles, eq(roles.role_id, incentive_rules.role_id))
        .where(
          and(
            eq(incentive_rules.branch_id, fixedBranch.branch_id),
            inArray(roles.role_name, [...manageableRoleNames]),
          ),
        )
        .orderBy(asc(branch.branch_name), asc(roles.role_name))
        .catch(() => [])
    : await db
        .select({
          rule_id: incentive_rules.rule_id,
          branch_name: branch.branch_name,
          role_name: roles.role_name,
          percent_value: incentive_rules.percent_value,
          flat_amount: incentive_rules.flat_amount,
        })
        .from(incentive_rules)
        .innerJoin(branch, eq(branch.branch_id, incentive_rules.branch_id))
        .innerJoin(roles, eq(roles.role_id, incentive_rules.role_id))
        .where(inArray(roles.role_name, [...manageableRoleNames]))
        .orderBy(asc(branch.branch_name), asc(roles.role_name))
        .catch(() => []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Incentive Rules</CardTitle>
          <CardDescription>
            {isAdmin
              ? "Manage incentive rules across all branches."
              : "Manage incentive rules for your assigned branch."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link className="text-sm underline" href="/dashboard">
            Back to dashboard
          </Link>
        </CardContent>
      </Card>

      <IncentiveRulesForm
        branches={branches}
        existingRules={existingRules}
        fixedBranch={fixedBranch}
        isAdmin={isAdmin}
        manageableRoles={manageableRoles}
      />
    </main>
  );
}
