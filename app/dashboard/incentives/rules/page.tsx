import { asc, inArray } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardBackLink } from "@/app/dashboard/_components/dashboard-back-link";
import {
  getDashboardAuthContext,
  getSingleAssignedBranchId,
} from "@/app/dashboard/auth";
import { resolveBackNavigation } from "@/app/dashboard/back-navigation";
import { db } from "@/db";
import { branch, roles } from "@/db/schema";
import { IncentiveRulesForm } from "@/app/dashboard/incentives/rules/incentive-rules-form";
import {
  getCurrentPayPeriod,
  getNextPayPeriod,
  loadApplicableRuleVersionsForPeriod,
} from "@/app/dashboard/incentives/lib";

const ADMIN_MANAGEABLE_ROLES = ["Branch Manager", "Secretary", "Collector"] as const;
const BRANCH_MANAGER_MANAGEABLE_ROLES = ["Secretary", "Collector"] as const;

export default async function IncentiveRulesPage({
  searchParams,
}: {
  searchParams?: Promise<{ source?: string; returnTo?: string | string[] }>;
}) {
  const auth = await getDashboardAuthContext();
  const resolvedSearchParams = (await searchParams) ?? {};
  const backNavigation = resolveBackNavigation({
    source: typeof resolvedSearchParams.source === "string" ? resolvedSearchParams.source : null,
    returnTo: Array.isArray(resolvedSearchParams.returnTo)
      ? resolvedSearchParams.returnTo[0]
      : resolvedSearchParams.returnTo,
    fallbackHref: "/dashboard",
    fallbackLabel: "Back to dashboard",
    allowedPrefixes: ["/dashboard/incentives"],
    sourceMap: {
      incentives: {
        href: "/dashboard/incentives",
        label: "Back to Incentives",
        allowedPrefixes: ["/dashboard/incentives"],
      },
    },
  });

  if (!auth.ok) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Incentive Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Not logged in</p>
            <DashboardBackLink className="mt-3" href="/login" label="Go to login" />
          </CardContent>
        </Card>
      </main>
    );
  }

  const isAdmin = auth.roleName === "Admin";
  const isBranchManager = auth.roleName === "Branch Manager";

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
            <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />
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
    if (auth.assignedBranchIds.length === 0) {
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
              <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />
            </CardContent>
          </Card>
        </main>
      );
    }

    const fixedBranchId = getSingleAssignedBranchId(auth);
    if (fixedBranchId === null) {
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
              <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />
            </CardContent>
          </Card>
        </main>
      );
    }

    if (!auth.activeBranchName) {
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
              <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />
            </CardContent>
          </Card>
        </main>
      );
    }

    fixedBranch = {
      branch_id: fixedBranchId,
      branch_name: auth.activeBranchName,
    };
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
      <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />

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
