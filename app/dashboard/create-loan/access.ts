import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { employee_branch_assignment, roles, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export type CreateLoanRoleName = "Admin" | "Branch Manager" | "Secretary";

export type CreateLoanAccessResult =
  | {
      ok: false;
      reason: "not_logged_in" | "forbidden" | "branch_assignment_required" | "missing_app_user";
      message: string;
    }
  | {
      ok: true;
      userId: string;
      roleName: CreateLoanRoleName;
      isAdmin: boolean;
      fixedBranchId: number | null;
    };

export async function resolveCreateLoanAccess(): Promise<CreateLoanAccessResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      reason: "not_logged_in",
      message: "You must be logged in.",
    };
  }

  const currentAppUser = await db
    .select({ role_id: users.role_id })
    .from(users)
    .where(eq(users.user_id, user.id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!currentAppUser?.role_id) {
    return {
      ok: false,
      reason: "missing_app_user",
      message: "Unable to verify your app account.",
    };
  }

  const currentRole = await db
    .select({ role_name: roles.role_name })
    .from(roles)
    .where(eq(roles.role_id, currentAppUser.role_id))
    .limit(1)
    .then((rows) => rows[0]?.role_name ?? null)
    .catch(() => null);

  if (
    currentRole !== "Admin" &&
    currentRole !== "Branch Manager" &&
    currentRole !== "Secretary"
  ) {
    return {
      ok: false,
      reason: "forbidden",
      message: "Only Admin, Branch Manager, and Secretary users can create loans.",
    };
  }

  if (currentRole === "Admin") {
    return {
      ok: true,
      userId: user.id,
      roleName: currentRole,
      isAdmin: true,
      fixedBranchId: null,
    };
  }

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
    return {
      ok: false,
      reason: "branch_assignment_required",
      message: "A single active branch assignment is required before creating loans.",
    };
  }

  return {
    ok: true,
    userId: user.id,
    roleName: currentRole,
    isAdmin: false,
    fixedBranchId: uniqueBranchIds[0],
  };
}
