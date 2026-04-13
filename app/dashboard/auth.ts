import "server-only";

import { cache } from "react";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  branch,
  employee_info,
  employee_area_assignment,
  employee_branch_assignment,
  roles,
  users,
} from "@/db/schema";
import { clearAdminTwoFactorCookies, hasVerifiedAdminTwoFactor } from "@/lib/auth/admin-two-factor";
import { getDeactivatedAccountMessage } from "@/lib/auth/deactivated-account-message";
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
  | { ok: false; reason: "inactive_account"; message: string }
  | { ok: false; reason: "missing_app_user"; message: string }
  | { ok: false; reason: "missing_role"; message: string }
  | { ok: false; reason: "admin_2fa_required"; message: string };

export type DashboardAuthContext = {
  ok: true;
  userId: string;
  roleName: RoleName;
  companyId: string;
  contactNo: string | null;
  email: string | null;
  firstName: string;
  displayName: string;
  assignedBranchIds: number[];
  activeBranchId: number | null;
  activeBranchName: string | null;
  borrowerId: string | null;
};

export type DashboardAuthResult = AuthFailure | DashboardAuthContext;
export type AppAuthResult = Exclude<DashboardAuthResult, { ok: false; reason: "admin_2fa_required"; message: string }>;
export type AppSessionAccessState =
  | { status: "unauthenticated" | "inactive_account" | "missing_app_user" | "missing_role"; auth: AppAuthResult }
  | { status: "non_admin_authenticated"; auth: DashboardAuthContext }
  | { status: "admin_otp_pending"; auth: DashboardAuthContext }
  | { status: "admin_otp_verified"; auth: DashboardAuthContext };

function buildDisplayName(parts: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  fallback: string;
}) {
  const firstName = parts.firstName?.trim() ?? "";
  const middleName = parts.middleName?.trim() ?? "";
  const lastName = parts.lastName?.trim() ?? "";
  const middleInitial = middleName ? `${middleName.charAt(0)}.` : "";

  return [firstName, middleInitial, lastName].filter(Boolean).join(" ").trim() || parts.fallback;
}

export const getAuthenticatedAppContext = cache(async (): Promise<AppAuthResult> => {
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
      company_id: users.company_id,
      contact_no: users.contact_no,
      email: users.email,
      status: users.status,
      role_name: roles.role_name,
      employee_first_name: employee_info.first_name,
      employee_middle_name: employee_info.middle_name,
      employee_last_name: employee_info.last_name,
      borrower_first_name: borrower_info.first_name,
      borrower_middle_name: borrower_info.middle_name,
      borrower_last_name: borrower_info.last_name,
    })
    .from(users)
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .leftJoin(borrower_info, eq(borrower_info.user_id, users.user_id))
    .where(eq(users.user_id, user.id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(async (error) => {
      console.warn("[sumtrack][auth] profile join query failed; trying base user lookup.");
      if (process.env.NODE_ENV !== "production") {
        console.warn(error);
      }

      return db
        .select({
          user_id: users.user_id,
          company_id: users.company_id,
          contact_no: users.contact_no,
          email: users.email,
          status: users.status,
          role_name: roles.role_name,
          employee_first_name: sql<string | null>`null`,
          employee_middle_name: sql<string | null>`null`,
          employee_last_name: sql<string | null>`null`,
          borrower_first_name: sql<string | null>`null`,
          borrower_middle_name: sql<string | null>`null`,
          borrower_last_name: sql<string | null>`null`,
        })
        .from(users)
        .innerJoin(roles, eq(roles.role_id, users.role_id))
        .where(eq(users.user_id, user.id))
        .limit(1)
        .then((rows) => rows[0] ?? null)
        .catch(() => null);
    });

  if (!appUser) {
    return { ok: false, reason: "missing_app_user", message: "No application user profile found." };
  }

  if (appUser.status === "inactive") {
    await supabase.auth.signOut();
    await clearAdminTwoFactorCookies();
    return {
      ok: false,
      reason: "inactive_account",
      message: getDeactivatedAccountMessage(appUser.role_name),
    };
  }

  const displayName = buildDisplayName({
    firstName: appUser.employee_first_name ?? appUser.borrower_first_name,
    middleName: appUser.employee_middle_name ?? appUser.borrower_middle_name,
    lastName: appUser.employee_last_name ?? appUser.borrower_last_name,
    fallback: appUser.company_id,
  });
  const firstName =
    appUser.employee_first_name?.trim() ??
    appUser.borrower_first_name?.trim() ??
    appUser.company_id;

  const roleName = appUser.role_name;
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
    contactNo: appUser.contact_no,
    email: appUser.email,
    firstName,
    displayName,
    assignedBranchIds,
    activeBranchId,
    activeBranchName,
    borrowerId,
  };
});

export const getDashboardAuthContext = cache(async (): Promise<DashboardAuthResult> => {
  const state = await getAppSessionAccessState();

  if (state.status === "admin_otp_pending") {
    return {
      ok: false,
      reason: "admin_2fa_required",
      message: "Admin verification is required before accessing the dashboard.",
    };
  }

  return state.auth;
});

export const getAppSessionAccessState = cache(async (): Promise<AppSessionAccessState> => {
  const auth = await getAuthenticatedAppContext();

  if (!auth.ok) {
    return {
      status: auth.reason,
      auth,
    };
  }

  if (auth.roleName !== "Admin") {
    return {
      status: "non_admin_authenticated",
      auth,
    };
  }

  const isVerified = await hasVerifiedAdminTwoFactor(auth.userId);
  return {
    status: isVerified ? "admin_otp_verified" : "admin_otp_pending",
    auth,
  };
});

export async function requireDashboardAuth(allowedRoles?: RoleName[]) {
  const auth = await getDashboardAuthContext();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") {
      redirect("/login");
    }
    if (auth.reason === "inactive_account") {
      redirect(
        `/login?error=${encodeURIComponent(auth.message)}&errorType=inactive_account`,
      );
    }
    if (auth.reason === "admin_2fa_required") {
      redirect("/login/verify");
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

export function getUniqueAssignedBranchIds(
  auth: Pick<DashboardAuthContext, "assignedBranchIds">,
) {
  return Array.from(
    new Set(
      auth.assignedBranchIds.filter((branchId): branchId is number => Number.isInteger(branchId)),
    ),
  );
}

export function getSingleAssignedBranchId(
  auth: Pick<DashboardAuthContext, "assignedBranchIds">,
) {
  const branchIds = getUniqueAssignedBranchIds(auth);
  return branchIds.length === 1 ? branchIds[0] : null;
}
