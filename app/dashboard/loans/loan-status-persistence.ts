import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { collections, loan_records } from "@/db/schema";
import {
  calculateLoanRemainingBalance,
  calculateLoanTotalPayable,
  getManilaTodayDateString,
  normalizeStoredLoanStatus,
  resolveReconciledStoredLoanStatus,
  type StoredLoanStatus,
} from "@/app/dashboard/loans/loan-state";

type LoanStatusDbExecutor = Pick<typeof db, "select" | "update">;

type LoanStatusSnapshotRow = {
  loanId: number;
  dueDate: string;
  principal: number | string;
  interest: number | string;
  storedStatus: string;
  totalCollected: number | string;
};

export type LoanStatusPersistenceResult = {
  loanId: number;
  previousStatus: StoredLoanStatus;
  nextStatus: StoredLoanStatus;
  totalPayable: number;
  totalCollected: number;
  remainingBalance: number;
  changed: boolean;
};

export type LoanStatusReconciliationSummary = {
  currentDate: string;
  processedLoans: number;
  updatedLoans: number;
  statusCounts: Record<StoredLoanStatus, number>;
  updatedLoanIds: number[];
};

const NON_TERMINAL_STORED_LOAN_STATUSES = ["active", "overdue", "completed"] as const;

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildLoanStatusSnapshotResult(row: LoanStatusSnapshotRow, currentDate: string): LoanStatusPersistenceResult {
  const previousStatus = normalizeStoredLoanStatus(row.storedStatus);
  const principal = toNumber(row.principal);
  const interest = toNumber(row.interest);
  const totalCollected = toNumber(row.totalCollected);
  const totalPayable = calculateLoanTotalPayable(principal, interest);
  const remainingBalance = calculateLoanRemainingBalance(totalPayable, totalCollected);
  const nextStatus = resolveReconciledStoredLoanStatus({
    storedStatus: previousStatus,
    dueDate: row.dueDate,
    remainingBalance,
    currentDate,
  });

  return {
    loanId: row.loanId,
    previousStatus,
    nextStatus,
    totalPayable,
    totalCollected,
    remainingBalance,
    changed: previousStatus !== nextStatus,
  };
}

async function loadLoanStatusSnapshot(
  loanId: number,
  executor: LoanStatusDbExecutor,
): Promise<LoanStatusSnapshotRow | null> {
  return executor
    .select({
      loanId: loan_records.loan_id,
      dueDate: loan_records.due_date,
      principal: loan_records.principal,
      interest: loan_records.interest,
      storedStatus: loan_records.status,
      totalCollected: sql<number>`(
        select coalesce(sum(${collections.amount}), 0)
        from ${collections}
        where ${collections.loan_id} = ${loan_records.loan_id}
      )`,
    })
    .from(loan_records)
    .where(eq(loan_records.loan_id, loanId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);
}

export async function reconcilePersistedLoanStatus(params: {
  loanId: number;
  currentDate?: string;
  executor?: LoanStatusDbExecutor;
}): Promise<LoanStatusPersistenceResult | null> {
  const currentDate = params.currentDate ?? getManilaTodayDateString();
  const executor = params.executor ?? db;
  const loanRow = await loadLoanStatusSnapshot(params.loanId, executor);

  if (!loanRow) {
    return null;
  }

  const reconciliation = buildLoanStatusSnapshotResult(loanRow, currentDate);

  if (reconciliation.changed) {
    await executor
      .update(loan_records)
      .set({ status: reconciliation.nextStatus })
      .where(eq(loan_records.loan_id, reconciliation.loanId));
  }

  return reconciliation;
}

export async function reconcileAllPersistedLoanStatuses(params?: {
  currentDate?: string;
}): Promise<LoanStatusReconciliationSummary> {
  const currentDate = params?.currentDate ?? getManilaTodayDateString();
  const loanRows = await db
    .select({
      loanId: loan_records.loan_id,
      dueDate: loan_records.due_date,
      principal: loan_records.principal,
      interest: loan_records.interest,
      storedStatus: loan_records.status,
      totalCollected: sql<number>`coalesce(sum(${collections.amount}), 0)`,
    })
    .from(loan_records)
    .leftJoin(collections, eq(collections.loan_id, loan_records.loan_id))
    .where(inArray(sql<string>`lower(${loan_records.status})`, NON_TERMINAL_STORED_LOAN_STATUSES as unknown as string[]))
    .groupBy(
      loan_records.loan_id,
      loan_records.due_date,
      loan_records.principal,
      loan_records.interest,
      loan_records.status,
    )
    .orderBy(asc(loan_records.loan_id))
    .catch(() => [] as LoanStatusSnapshotRow[]);

  const results = loanRows.map((row) => buildLoanStatusSnapshotResult(row, currentDate));
  const changedLoanIdsByStatus = new Map<StoredLoanStatus, number[]>();
  const statusCounts: Record<StoredLoanStatus, number> = {
    active: 0,
    overdue: 0,
    completed: 0,
    archived: 0,
    abandoned: 0,
  };

  for (const row of results) {
    statusCounts[row.nextStatus] += 1;

    if (!row.changed) {
      continue;
    }

    const existing = changedLoanIdsByStatus.get(row.nextStatus) ?? [];
    existing.push(row.loanId);
    changedLoanIdsByStatus.set(row.nextStatus, existing);
  }

  if (changedLoanIdsByStatus.size > 0) {
    await db.transaction(async (tx) => {
      for (const [nextStatus, loanIds] of changedLoanIdsByStatus.entries()) {
        if (loanIds.length === 0) {
          continue;
        }

        await tx
          .update(loan_records)
          .set({ status: nextStatus })
          .where(
            and(
              inArray(loan_records.loan_id, loanIds),
              inArray(sql<string>`lower(${loan_records.status})`, NON_TERMINAL_STORED_LOAN_STATUSES as unknown as string[]),
            ),
          );
      }
    });
  }

  return {
    currentDate,
    processedLoans: results.length,
    updatedLoans: Array.from(changedLoanIdsByStatus.values()).reduce((sum, loanIds) => sum + loanIds.length, 0),
    statusCounts,
    updatedLoanIds: Array.from(changedLoanIdsByStatus.values()).flat(),
  };
}
