"use server";

import { eq } from "drizzle-orm";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  loan_records,
} from "@/db/schema";

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

export async function resolveAuthContext() {
  const auth = await getDashboardAuthContext();
  if (!auth.ok) {
    return { ok: false, message: "Not logged in." } as const;
  }

  return {
    ok: true,
    userId: auth.userId,
    roleName: auth.roleName,
    assignedBranchIds: auth.assignedBranchIds,
    activeBranchId: auth.activeBranchId,
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

  if (roleName === "Auditor") {
    if (!auth.assignedBranchIds.includes(borrowerBranchId)) {
      return { ok: false, message: "You are not allowed to access this borrower branch." };
    }

    if (opts.requireManage) {
      return { ok: false, message: "Auditor access is view-only for documents." };
    }

    return { ok: true, userId, roleName };
  }
  if (roleName === "Branch Manager" || roleName === "Secretary") {
    if (!auth.activeBranchId || auth.activeBranchId !== borrowerBranchId) {
      return { ok: false, message: "You are not allowed to access this borrower branch." };
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

  if (roleName === "Auditor") {
    if (!auth.assignedBranchIds.includes(loan.branch_id)) {
      return { ok: false, message: "You are not allowed to access this loan branch." };
    }

    if (opts.requireManage) {
      return { ok: false, message: "Auditor access is view-only for documents." };
    }

    return { ok: true, userId, roleName };
  }
  if (roleName === "Branch Manager" || roleName === "Secretary") {
    if (!auth.activeBranchId || auth.activeBranchId !== loan.branch_id) {
      return { ok: false, message: "You are not allowed to access this loan branch." };
    }
    return { ok: true, userId, roleName };
  }

  return { ok: false, message: "You are not authorized to access loan documents." };
}
