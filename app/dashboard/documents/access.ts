"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  employee_branch_assignment,
  loan_records,
  roles,
  users,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export type AppRoleName =
  | "Admin"
  | "Branch Manager"
  | "Secretary"
  | "Auditor"
  | "Collector"
  | "Borrower"
  | string;

export type AccessResult =
  | {
      ok: true;
      userId: string;
      roleName: AppRoleName;
    }
  | {
      ok: false;
      message: string;
    };

async function resolveRoleName(userId: string) {
  const appUser = await db
    .select({ role_id: users.role_id })
    .from(users)
    .where(eq(users.user_id, userId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!appUser?.role_id) {
    return null;
  }

  const role = await db
    .select({ role_name: roles.role_name })
    .from(roles)
    .where(eq(roles.role_id, appUser.role_id))
    .limit(1)
    .then((rows) => rows[0]?.role_name ?? null)
    .catch(() => null);

  return role as AppRoleName | null;
}

export async function resolveSingleActiveBranch(userId: string) {
  const assignments = await db
    .select({ branch_id: employee_branch_assignment.branch_id })
    .from(employee_branch_assignment)
    .where(
      and(
        eq(employee_branch_assignment.employee_user_id, userId),
        isNull(employee_branch_assignment.end_date),
      ),
    )
    .catch(() => []);

  const uniqueBranchIds = Array.from(new Set(assignments.map((item) => item.branch_id)));
  return uniqueBranchIds.length === 1 ? uniqueBranchIds[0] : null;
}

export async function resolveAuthContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Not logged in." } as const;
  }

  const roleName = await resolveRoleName(user.id);
  if (!roleName) {
    return { ok: false, message: "Unable to verify your app role." } as const;
  }

  return {
    ok: true,
    userId: user.id,
    roleName,
  } as const;
}

async function resolveBorrowerBranchId(borrowerId: string) {
  const borrower = await db
    .select({ branch_id: areas.branch_id })
    .from(borrower_info)
    .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
    .where(eq(borrower_info.user_id, borrowerId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  return borrower?.branch_id ?? null;
}

async function resolveLoanContext(loanId: number) {
  const loan = await db
    .select({
      branch_id: loan_records.branch_id,
      borrower_id: loan_records.borrower_id,
    })
    .from(loan_records)
    .where(eq(loan_records.loan_id, loanId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  return loan;
}

export async function checkBorrowerDocAccess(
  borrowerId: string,
  opts: { requireManage: boolean },
): Promise<AccessResult> {
  const auth = await resolveAuthContext();
  if (!auth.ok) {
    return auth;
  }

  const { userId, roleName } = auth;
  if (roleName === "Collector") {
    return { ok: false, message: "Collectors cannot access borrower documents." };
  }

  const borrowerBranchId = await resolveBorrowerBranchId(borrowerId);
  if (!borrowerBranchId) {
    return { ok: false, message: "Borrower was not found." };
  }

  if (roleName === "Admin") {
    return { ok: true, userId, roleName };
  }

  if (roleName === "Borrower") {
    if (opts.requireManage) {
      return { ok: false, message: "Borrowers cannot manage documents." };
    }
    if (userId !== borrowerId) {
      return { ok: false, message: "You can only access your own borrower documents." };
    }
    return { ok: true, userId, roleName };
  }

  if (roleName === "Branch Manager" || roleName === "Secretary" || roleName === "Auditor") {
    const allowedBranchId = await resolveSingleActiveBranch(userId);
    if (!allowedBranchId || allowedBranchId !== borrowerBranchId) {
      return { ok: false, message: "You are not allowed to access this borrower branch." };
    }

    if (opts.requireManage && roleName === "Auditor") {
      return { ok: false, message: "Auditor access is view-only for documents." };
    }

    return { ok: true, userId, roleName };
  }

  return { ok: false, message: "You are not authorized to access borrower documents." };
}

export async function checkLoanDocAccess(
  loanId: number,
  opts: { requireManage: boolean },
): Promise<AccessResult> {
  const auth = await resolveAuthContext();
  if (!auth.ok) {
    return auth;
  }

  const { userId, roleName } = auth;
  if (roleName === "Collector") {
    return { ok: false, message: "Collectors cannot access loan documents." };
  }

  const loan = await resolveLoanContext(loanId);
  if (!loan) {
    return { ok: false, message: "Loan was not found." };
  }

  if (roleName === "Admin") {
    return { ok: true, userId, roleName };
  }

  if (roleName === "Borrower") {
    if (opts.requireManage) {
      return { ok: false, message: "Borrowers cannot manage documents." };
    }
    if (loan.borrower_id !== userId) {
      return { ok: false, message: "You can only access your own loan documents." };
    }
    return { ok: true, userId, roleName };
  }

  if (roleName === "Branch Manager" || roleName === "Secretary" || roleName === "Auditor") {
    const allowedBranchId = await resolveSingleActiveBranch(userId);
    if (!allowedBranchId || allowedBranchId !== loan.branch_id) {
      return { ok: false, message: "You are not allowed to access this loan branch." };
    }

    if (opts.requireManage && roleName === "Auditor") {
      return { ok: false, message: "Auditor access is view-only for documents." };
    }

    return { ok: true, userId, roleName };
  }

  return { ok: false, message: "You are not authorized to access loan documents." };
}
