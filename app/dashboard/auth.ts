import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  branch,
  employee_area_assignment,
  employee_branch_assignment,
  roles,
  users,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export type RoleName =
  | "Admin"
  | "Branch Manager"
  | "Secretary"
  | "Auditor"
  | "Collector"
  | "Borrower"
  | string;

type AuthFailure =
  | { ok: false; reason: "unauthenticated"; message: string }
  | { ok: false; reason: "missing_app_user"; message: string }
  | { ok: false; reason: "missing_role"; message: string };

export type DashboardAuthContext = {
  ok: true;
  userId: string;
  roleName: RoleName;
  companyId: string;
  assignedBranchIds: number[];
  activeBranchId: number | null;
  activeBranchName: string | null;
  borrowerId: string | null;
};

export type DashboardAuthResult = AuthFailure | DashboardAuthContext;

async function resolveRoleName(roleId: number) {
  return db
    .select({ role_name: roles.role_name })
    .from(roles)
    .where(eq(roles.role_id, roleId))
    .limit(1)
    .then((rows) => rows[0]?.role_name ?? null)
    .catch(() => null);
}

export async function getDashboardAuthContext(): Promise<DashboardAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, reason: "unauthenticated", message: "You must be logged in." };
  }

  const appUser = await db
    .select({
      user_id: users.user_id,
      role_id: users.role_id,
      company_id: users.company_id,
    })
    .from(users)
    .where(eq(users.user_id, user.id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!appUser) {
    return { ok: false, reason: "missing_app_user", message: "No application user profile found." };
  }

  const roleName = await resolveRoleName(appUser.role_id);
  if (!roleName) {
    return { ok: false, reason: "missing_role", message: "Unable to resolve your application role." };
  }

  let assignedBranchIds: number[] = [];
  let activeBranchId: number | null = null;
  let activeBranchName: string | null = null;
  let borrowerId: string | null = null;

  if (roleName === "Admin") {
    assignedBranchIds = await db
      .select({ branch_id: branch.branch_id })
      .from(branch)
      .then((rows) => rows.map((row) => row.branch_id))
      .catch(() => []);
  } else if (roleName === "Branch Manager" || roleName === "Secretary" || roleName === "Auditor") {
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

    assignedBranchIds = Array.from(new Set(assignments.map((row) => row.branch_id)));
    if (roleName === "Branch Manager" || roleName === "Secretary") {
      activeBranchId = assignedBranchIds.length === 1 ? assignedBranchIds[0] : null;
    }
  } else if (roleName === "Collector") {
    const collectorAssignment = await db
      .select({ branch_id: areas.branch_id })
      .from(employee_area_assignment)
      .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
      .where(
        and(
          eq(employee_area_assignment.employee_user_id, user.id),
          isNull(employee_area_assignment.end_date),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null);

    if (collectorAssignment?.branch_id) {
      assignedBranchIds = [collectorAssignment.branch_id];
      activeBranchId = collectorAssignment.branch_id;
    }
  } else if (roleName === "Borrower") {
    const borrower = await db
      .select({ user_id: borrower_info.user_id, branch_id: areas.branch_id })
      .from(borrower_info)
      .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
      .where(eq(borrower_info.user_id, user.id))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null);

    if (borrower?.user_id) {
      borrowerId = borrower.user_id;
      if (borrower.branch_id) {
        assignedBranchIds = [borrower.branch_id];
      }
    }
  }

  if (activeBranchId === null && assignedBranchIds.length === 1) {
    activeBranchId = assignedBranchIds[0];
  }

  if (activeBranchId !== null) {
    const branchRow = await db
      .select({ branch_name: branch.branch_name })
      .from(branch)
      .where(eq(branch.branch_id, activeBranchId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null);
    activeBranchName = branchRow?.branch_name ?? null;
  }

  return {
    ok: true,
    userId: user.id,
    roleName,
    companyId: appUser.company_id,
    assignedBranchIds,
    activeBranchId,
    activeBranchName,
    borrowerId,
  };
}

export async function requireDashboardAuth(allowedRoles?: RoleName[]) {
  const auth = await getDashboardAuthContext();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") {
      redirect("/login");
    }
    return auth;
  }

  if (allowedRoles && !allowedRoles.includes(auth.roleName)) {
    return {
      ok: false as const,
      reason: "forbidden" as const,
      message: "You are not authorized to access this page.",
      auth,
    };
  }

  return auth;
}

export async function resolveBranchNames(branchIds: number[]) {
  if (branchIds.length === 0) {
    return new Map<number, string>();
  }

  const rows = await db
    .select({ branch_id: branch.branch_id, branch_name: branch.branch_name })
    .from(branch)
    .where(inArray(branch.branch_id, branchIds))
    .catch(() => []);
  return new Map(rows.map((row) => [row.branch_id, row.branch_name]));
}

