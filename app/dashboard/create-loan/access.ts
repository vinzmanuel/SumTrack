import "server-only";

import {
  getDashboardAuthContext,
  getSingleAssignedBranchId,
} from "@/app/dashboard/auth";

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
  const auth = await getDashboardAuthContext();

  if (!auth.ok) {
    return {
      ok: false,
      reason: auth.reason === "unauthenticated" ? "not_logged_in" : "missing_app_user",
      message:
        auth.reason === "unauthenticated"
          ? "You must be logged in."
          : "Unable to verify your app account.",
    };
  }

  if (auth.roleName !== "Admin" && auth.roleName !== "Branch Manager" && auth.roleName !== "Secretary") {
    return {
      ok: false,
      reason: "forbidden",
      message: "Only Admin, Branch Manager, and Secretary users can create loans.",
    };
  }

  if (auth.roleName === "Admin") {
    return {
      ok: true,
      userId: auth.userId,
      roleName: auth.roleName,
      isAdmin: true,
      fixedBranchId: null,
    };
  }

  const fixedBranchId = getSingleAssignedBranchId(auth);
  if (fixedBranchId === null) {
    return {
      ok: false,
      reason: "branch_assignment_required",
      message: "A single active branch assignment is required before creating loans.",
    };
  }

  return {
    ok: true,
    userId: auth.userId,
    roleName: auth.roleName,
    isAdmin: false,
    fixedBranchId,
  };
}
