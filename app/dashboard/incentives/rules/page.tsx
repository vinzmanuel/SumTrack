import Link from "next/link";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { branch, employee_branch_assignment, roles, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { IncentiveRulesForm } from "@/app/dashboard/incentives/rules/incentive-rules-form";
import {
  getCurrentPayPeriod,
  getNextPayPeriod,
  loadApplicableRuleVersionsForPeriod,
} from "@/app/dashboard/incentives/lib";

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

  const scopeBranches = isBranchManager && fixedBranch ? [fixedBranch] : branches;
  const branchIdScope = scopeBranches.map((item) => item.branch_id);
  const roleIdScope = manageableRoles.map((item) => item.role_id);

  const currentPayPeriod = getCurrentPayPeriod();
  const nextPayPeriod = currentPayPeriod ? getNextPayPeriod(currentPayPeriod) : null;

  const existingRules = [] as Array<{
    rule_id: number;
    branch_name: string;
    role_name: string;
    percent_value: string;
    flat_amount: string;
    effective_start: string;
    effective_end: string | null;
    status_label: "Active Now" | "Scheduled Next";
  }>;

  if (currentPayPeriod && nextPayPeriod && branchIdScope.length > 0 && roleIdScope.length > 0) {
    const currentMap = await loadApplicableRuleVersionsForPeriod(
      branchIdScope,
      roleIdScope,
      currentPayPeriod.periodStart,
      currentPayPeriod.periodEnd,
    );
    const nextMap = await loadApplicableRuleVersionsForPeriod(
      branchIdScope,
      roleIdScope,
      nextPayPeriod.periodStart,
      nextPayPeriod.periodEnd,
    );

    scopeBranches.forEach((branchOption) => {
      manageableRoles.forEach((roleOption) => {
        const key = `${branchOption.branch_id}:${roleOption.role_id}`;
        const activeRule = currentMap.get(key) ?? null;
        const scheduledRule = nextMap.get(key) ?? null;

        if (activeRule) {
          existingRules.push({
            rule_id: activeRule.ruleId,
            branch_name: branchOption.branch_name,
            role_name: roleOption.role_name,
            percent_value: String(activeRule.percentValue),
            flat_amount: String(activeRule.flatAmount),
            effective_start: activeRule.effectiveStart,
            effective_end: activeRule.effectiveEnd,
            status_label: "Active Now",
          });
        }

        if (scheduledRule && (!activeRule || scheduledRule.ruleId !== activeRule.ruleId)) {
          existingRules.push({
            rule_id: scheduledRule.ruleId,
            branch_name: branchOption.branch_name,
            role_name: roleOption.role_name,
            percent_value: String(scheduledRule.percentValue),
            flat_amount: String(scheduledRule.flatAmount),
            effective_start: scheduledRule.effectiveStart,
            effective_end: scheduledRule.effectiveEnd,
            status_label: "Scheduled Next",
          });
        }
      });
    });
  }

  existingRules.sort((a, b) => {
    const branchCompare = a.branch_name.localeCompare(b.branch_name);
    if (branchCompare !== 0) {
      return branchCompare;
    }

    const roleCompare = a.role_name.localeCompare(b.role_name);
    if (roleCompare !== 0) {
      return roleCompare;
    }

    if (a.status_label === b.status_label) {
      return 0;
    }
    return a.status_label === "Active Now" ? -1 : 1;
  });

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
          <p className="text-sm text-muted-foreground">
            Rule changes made during the current month take effect on the next month.
          </p>
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
