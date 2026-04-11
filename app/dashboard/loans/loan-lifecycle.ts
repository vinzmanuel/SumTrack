import "server-only";

import { eq, sql } from "drizzle-orm";
import type { DashboardAuthContext } from "@/app/dashboard/auth";
import { db } from "@/db";
import { collections, loan_docs, loan_records } from "@/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAuditActorFromAuth, logAuditEvent } from "@/lib/audit/logger";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import {
  buildLoanComputedState,
  getManilaTodayDateString,
  resolveArchiveTargetStatus,
} from "@/app/dashboard/loans/loan-state";

type LoanLifecycleResult =
  | { ok: true; message: string; nextStoredStatus?: string }
  | { ok: false; message: string };

type LoanLifecycleContext = {
  loanId: number;
  loanCode: string;
  branchId: number;
  dueDate: string;
  principal: number;
  interest: number;
  storedStatus: string;
  collectionCount: number;
  totalCollected: number;
};

function parseLoanId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

async function loadLoanLifecycleContext(loanId: number): Promise<LoanLifecycleContext | null> {
  const loanRow = await db
    .select({
      loanId: loan_records.loan_id,
      loanCode: loan_records.loan_code,
      branchId: loan_records.branch_id,
      dueDate: loan_records.due_date,
      principal: loan_records.principal,
      interest: loan_records.interest,
      storedStatus: loan_records.status,
    })
    .from(loan_records)
    .where(eq(loan_records.loan_id, loanId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!loanRow) {
    return null;
  }

  const collectionStats = await db
    .select({
      totalCollected: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      collectionCount: sql<number>`count(*)`,
    })
    .from(collections)
    .where(eq(collections.loan_id, loanId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  return {
    loanId: loanRow.loanId,
    loanCode: loanRow.loanCode,
    branchId: loanRow.branchId,
    dueDate: loanRow.dueDate,
    principal: Number(loanRow.principal) || 0,
    interest: Number(loanRow.interest) || 0,
    storedStatus: loanRow.storedStatus,
    collectionCount: Number(collectionStats?.collectionCount) || 0,
    totalCollected: Number(collectionStats?.totalCollected) || 0,
  };
}

function canManageLoanLifecycle(auth: DashboardAuthContext, branchId: number) {
  if (auth.roleName === "Admin") {
    return true;
  }

  if (auth.roleName !== "Branch Manager" && auth.roleName !== "Secretary") {
    return false;
  }

  return auth.activeBranchId !== null && auth.activeBranchId === branchId;
}

export async function archiveLoanRecord(
  auth: DashboardAuthContext,
  loanIdRaw: string,
): Promise<LoanLifecycleResult> {
  const loanId = parseLoanId(loanIdRaw);
  if (!loanId) {
    return { ok: false, message: "Loan not found." };
  }

  const loan = await loadLoanLifecycleContext(loanId);
  if (!loan) {
    return { ok: false, message: "Loan not found." };
  }

  if (!canManageLoanLifecycle(auth, loan.branchId)) {
    return { ok: false, message: "You are not allowed to archive this loan." };
  }

  const computedState = buildLoanComputedState({
    principal: loan.principal,
    interest: loan.interest,
    totalCollected: loan.totalCollected,
    dueDate: loan.dueDate,
    storedStatus: loan.storedStatus,
    currentDate: getManilaTodayDateString(),
  });

  const nextStoredStatus = resolveArchiveTargetStatus({
    storedStatus: computedState.storedStatus,
    visibleStatus: computedState.visibleStatus,
  });

  if (!nextStoredStatus) {
    return {
      ok: false,
      message:
        computedState.visibleStatus === "Active"
          ? "Only completed or overdue loans can be archived."
          : "This loan is already in the archived bucket.",
    };
  }

  await db
    .update(loan_records)
    .set({ status: nextStoredStatus })
    .where(eq(loan_records.loan_id, loan.loanId));

  await logAuditEvent({
    action: "loan.status_changed_manual",
    entityType: "loan",
    entityId: loan.loanCode,
    actor: buildAuditActorFromAuth(auth),
    branchId: loan.branchId,
    branchScope: [loan.branchId],
    description:
      nextStoredStatus === "abandoned"
        ? `Marked loan ${loan.loanCode} as abandoned manually.`
        : `Archived loan ${loan.loanCode} manually.`,
    metadata: {
      loanCode: loan.loanCode,
      previousStatus: loan.storedStatus,
      nextStatus: nextStoredStatus,
      dueDate: loan.dueDate,
      totalCollected: loan.totalCollected,
      collectionCount: loan.collectionCount,
    },
  });

  return {
    ok: true,
    nextStoredStatus,
    message:
      nextStoredStatus === "abandoned"
        ? "Loan marked as abandoned and moved to the Archived tab."
        : "Loan archived successfully.",
  };
}

export async function deleteLoanRecord(
  auth: DashboardAuthContext,
  loanIdRaw: string,
): Promise<LoanLifecycleResult> {
  const requestContext = await getAuditRequestContext();
  const loanId = parseLoanId(loanIdRaw);
  if (!loanId) {
    return { ok: false, message: "Loan not found." };
  }

  if (auth.roleName !== "Admin") {
    return { ok: false, message: "Only Admin can delete loans." };
  }

  const loan = await loadLoanLifecycleContext(loanId);
  if (!loan) {
    return { ok: false, message: "Loan not found." };
  }

  if (loan.collectionCount > 0) {
    return { ok: false, message: "Loans with recorded collections cannot be deleted." };
  }

  const loanDocRows = await db
    .select({
      loanDocId: loan_docs.loan_doc_id,
      filePath: loan_docs.file_path,
    })
    .from(loan_docs)
    .where(eq(loan_docs.loan_id, loan.loanId))
    .catch(() => []);

  if (loanDocRows.length > 0) {
    const adminClient = createAdminClient();
    const removeResult = await adminClient.storage.from("loan-docs").remove(
      loanDocRows.map((row) => row.filePath),
    );

    if (removeResult.error) {
      return {
        ok: false,
        message: `Unable to delete loan documents from storage: ${removeResult.error.message}`,
      };
    }

    await db.delete(loan_docs).where(eq(loan_docs.loan_id, loan.loanId));
  }

  await db.delete(loan_records).where(eq(loan_records.loan_id, loan.loanId));

  await logAuditEvent({
    action: "loan.deleted",
    entityType: "loan",
    entityId: loan.loanCode,
    actor: buildAuditActorFromAuth(auth),
    branchId: loan.branchId,
    branchScope: [loan.branchId],
    description: `Deleted loan ${loan.loanCode}.`,
    requestContext,
    metadata: {
      loanCode: loan.loanCode,
      previousStatus: loan.storedStatus,
      collectionCount: loan.collectionCount,
      totalCollected: loan.totalCollected,
      dueDate: loan.dueDate,
    },
  });

  return {
    ok: true,
    message: "Loan deleted successfully.",
  };
}
