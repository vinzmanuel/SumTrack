import { and, eq, inArray, isNull } from "drizzle-orm";
import { UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardBackLink } from "@/app/dashboard/_components/dashboard-back-link";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import {
  getDashboardAuthContext,
  getSingleAssignedBranchId,
} from "@/app/dashboard/auth";
import { resolveBackNavigation } from "@/app/dashboard/back-navigation";
import { db } from "@/db";
import {
  areas,
  branch,
  employee_area_assignment,
  employee_branch_assignment,
  roles,
  users,
} from "@/db/schema";
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

type OccupiedAssignmentScope = {
  occupiedBranchManagerBranchIds: string[];
  occupiedAuditorBranchIds: string[];
  collectorWarningAreaIds: string[];
};

const ALLOWED_ROLE_NAMES = [
  "Admin",
  "Auditor",
  "Branch Manager",
  "Secretary",
  "Collector",
  "Borrower",
];

export default async function CreateAccountPage({
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
    allowedPrefixes: ["/dashboard/manage-user-accounts", "/dashboard/branches"],
    sourceMap: {
      "manage-users": {
        href: "/dashboard/manage-user-accounts",
        label: "Back to User Accounts",
        allowedPrefixes: ["/dashboard/manage-user-accounts"],
      },
      branches: {
        href: "/dashboard/branches",
        label: "Back to Branches",
        allowedPrefixes: ["/dashboard/branches"],
      },
    },
  });

  if (!auth.ok) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create User</CardTitle>
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
  const isSecretary = auth.roleName === "Secretary";

  if (!isAdmin && !isBranchManager && !isSecretary) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create User</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are logged in, but only Admin, Branch Manager, and Secretary can access account creation.
            </p>
            <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />
          </CardContent>
        </Card>
      </main>
    );
  }

  let fixedBranchId: number | null = null;
  if (!isAdmin) {
    fixedBranchId = getSingleAssignedBranchId(auth);
    if (fixedBranchId === null) {
      return (
        <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                A single active branch assignment is required before creating accounts.
              </p>
              <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />
            </CardContent>
          </Card>
        </main>
      );
    }
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
    .where(eq(branch.status, "active"))
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
    .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
    .where(and(eq(branch.status, "active"), eq(areas.status, "active")))
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

  const scopedBranchIds = mappedBranches.map((item) => Number(item.branch_id)).filter(Number.isFinite);
  const scopedAreaIds = mappedAreas.map((item) => Number(item.area_id)).filter(Number.isFinite);

  const occupiedAssignments: OccupiedAssignmentScope = {
    occupiedBranchManagerBranchIds: [],
    occupiedAuditorBranchIds: [],
    collectorWarningAreaIds: [],
  };

  if (scopedBranchIds.length > 0 || scopedAreaIds.length > 0) {
    const [branchManagerAssignments, auditorAssignments, collectorAreaAssignments] = await Promise.all([
      scopedBranchIds.length > 0
        ? db
            .select({ branchId: employee_branch_assignment.branch_id })
            .from(employee_branch_assignment)
            .innerJoin(users, eq(users.user_id, employee_branch_assignment.employee_user_id))
            .innerJoin(roles, eq(roles.role_id, users.role_id))
            .where(
              and(
                inArray(employee_branch_assignment.branch_id, scopedBranchIds),
                isNull(employee_branch_assignment.end_date),
                eq(users.status, "active"),
                eq(roles.role_name, "Branch Manager"),
              ),
            )
            .catch(() => [])
        : Promise.resolve([]),
      scopedBranchIds.length > 0
        ? db
            .select({ branchId: employee_branch_assignment.branch_id })
            .from(employee_branch_assignment)
            .innerJoin(users, eq(users.user_id, employee_branch_assignment.employee_user_id))
            .innerJoin(roles, eq(roles.role_id, users.role_id))
            .where(
              and(
                inArray(employee_branch_assignment.branch_id, scopedBranchIds),
                isNull(employee_branch_assignment.end_date),
                eq(users.status, "active"),
                eq(roles.role_name, "Auditor"),
              ),
            )
            .catch(() => [])
        : Promise.resolve([]),
      scopedAreaIds.length > 0
        ? db
            .select({ areaId: employee_area_assignment.area_id })
            .from(employee_area_assignment)
            .innerJoin(users, eq(users.user_id, employee_area_assignment.employee_user_id))
            .innerJoin(roles, eq(roles.role_id, users.role_id))
            .where(
              and(
                inArray(employee_area_assignment.area_id, scopedAreaIds),
                isNull(employee_area_assignment.end_date),
                eq(users.status, "active"),
                eq(roles.role_name, "Collector"),
              ),
            )
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    occupiedAssignments.occupiedBranchManagerBranchIds = Array.from(
      new Set(branchManagerAssignments.map((item) => String(item.branchId))),
    );
    occupiedAssignments.occupiedAuditorBranchIds = Array.from(
      new Set(auditorAssignments.map((item) => String(item.branchId))),
    );
    occupiedAssignments.collectorWarningAreaIds = Array.from(
      new Set(collectorAreaAssignments.map((item) => String(item.areaId))),
    );
  }

  if (!isAdmin && fixedBranchId && mappedBranches.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create User</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Your assigned branch is inactive, so new account creation is currently blocked there.
            </p>
            <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />
          </CardContent>
        </Card>
      </main>
    );
  }

  const description = isAdmin
    ? "Provision employee and borrower accounts with role-aware branch and area assignments."
    : isBranchManager
      ? "Create secretary, collector, and borrower accounts within your assigned branch."
      : "Create borrower accounts within your assigned branch.";

  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          action: null,
          description,
          icon: <UserPlus className="size-9 text-sidebar-foreground/65" />,
          title: "Create User",
        }}
      />

      <div className="mx-auto w-full max-w-5xl space-y-4">
        <CreateAccountForm
          areas={mappedAreas}
          borrowerOnly={isSecretary}
          branches={mappedBranches}
          fixedBranchId={fixedBranchId ? String(fixedBranchId) : null}
          occupiedAuditorBranchIds={occupiedAssignments.occupiedAuditorBranchIds}
          occupiedBranchManagerBranchIds={occupiedAssignments.occupiedBranchManagerBranchIds}
          collectorWarningAreaIds={occupiedAssignments.collectorWarningAreaIds}
          roles={mappedRoles}
        />
      </div>
    </>
  );
}
