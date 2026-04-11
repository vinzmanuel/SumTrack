import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { collections, loan_records } from "@/db/schema";
import { buildSystemAuditActor, logAuditEvent } from "@/lib/audit/logger";
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
  loanCode: string;
  branchId: number;
  dueDate: string;
  principal: number | string;
  interest: number | string;
  storedStatus: string;
  totalCollected: number | string;
};

export type LoanStatusPersistenceResult = {
  loanId: number;
  loanCode: string;
  branchId: number;
  previousStatus: StoredLoanStatus;
  nextStatus: StoredLoanStatus;
  totalPayable: number;
  totalCollected: number;
  remainingBalance: number;
  changed: boolean;
  debug: {
    source: "db-aggregate";
    dueDate: string;
    principal: number;
    interest: number;
    payoffReached: boolean;
    currentDate: string;
  };
};

export type LoanStatusReconciliationSummary = {
  currentDate: string;
  processedLoans: number;
  updatedLoans: number;
  statusCounts: Record<StoredLoanStatus, number>;
  updatedLoanIds: number[];
};

const NON_TERMINAL_STORED_LOAN_STATUSES = ["active", "overdue", "completed"] as const;
const loanCollectionTotals = db
  .select({
    loanId: collections.loan_id,
    totalCollected: sql<number>`coalesce(sum(${collections.amount}), 0)`.as("total_collected"),
  })
  .from(collections)
  .groupBy(collections.loan_id)
  .as("loan_collection_totals");

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function logLoanStatusRawProof(params: {
  rawRow: LoanStatusSnapshotRow;
  currentDate: string;
  principal: number;
  interest: number;
  totalCollected: number;
  totalPayable: number;
  remainingBalance: number;
  nextStatus: StoredLoanStatus;
}) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.info(
    [
      "[sumtrack][collection-status-raw-proof] START",
      JSON.stringify(params.rawRow, null, 2),
      JSON.stringify(
        {
          rawFieldTypes: {
            principal: typeof params.rawRow.principal,
            interest: typeof params.rawRow.interest,
            totalCollected: typeof params.rawRow.totalCollected,
          },
          rawFieldValues: {
            principal: params.rawRow.principal,
            interest: params.rawRow.interest,
            totalCollected: params.rawRow.totalCollected,
          },
          convertedValues: {
            principal: params.principal,
            interest: params.interest,
            totalCollected: params.totalCollected,
          },
          derivedValues: {
            currentDate: params.currentDate,
            totalPayable: params.totalPayable,
            remainingBalance: params.remainingBalance,
            nextStatus: params.nextStatus,
          },
        },
        null,
        2,
      ),
      "[sumtrack][collection-status-raw-proof] END",
    ].join("\n"),
  );
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

  logLoanStatusRawProof({
    rawRow: row,
    currentDate,
    principal,
    interest,
    totalCollected,
    totalPayable,
    remainingBalance,
    nextStatus,
  });

  return {
    loanId: row.loanId,
    loanCode: row.loanCode,
    branchId: row.branchId,
    previousStatus,
    nextStatus,
    totalPayable,
    totalCollected,
    remainingBalance,
    changed: previousStatus !== nextStatus,
    debug: {
      source: "db-aggregate",
      dueDate: row.dueDate,
      principal,
      interest,
      payoffReached: remainingBalance <= 0,
      currentDate,
    },
  };
}

async function loadLoanStatusSnapshot(
  loanId: number,
  executor: LoanStatusDbExecutor,
): Promise<LoanStatusSnapshotRow | null> {
  return executor
    .select({
      loanId: loan_records.loan_id,
      loanCode: loan_records.loan_code,
      branchId: loan_records.branch_id,
      dueDate: loan_records.due_date,
      principal: loan_records.principal,
      interest: loan_records.interest,
      storedStatus: loan_records.status,
      totalCollected: sql<number>`coalesce(${loanCollectionTotals.totalCollected}, 0)`,
    })
    .from(loan_records)
    .leftJoin(loanCollectionTotals, eq(loanCollectionTotals.loanId, loan_records.loan_id))
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

    if (executor === db) {
      await logAuditEvent({
        action: "loan.status_changed_system",
        entityType: "loan",
        entityId: reconciliation.loanCode,
        actor: buildSystemAuditActor(),
        branchId: reconciliation.branchId,
        branchScope: [reconciliation.branchId],
        description: `System reconciled loan ${reconciliation.loanCode} from ${reconciliation.previousStatus} to ${reconciliation.nextStatus}.`,
        metadata: {
          loanCode: reconciliation.loanCode,
          previousStatus: reconciliation.previousStatus,
          nextStatus: reconciliation.nextStatus,
          totalPayable: reconciliation.totalPayable,
          totalCollected: reconciliation.totalCollected,
          remainingBalance: reconciliation.remainingBalance,
          source: "single_reconciliation",
          debug: reconciliation.debug,
        },
      });
    }
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
      loanCode: loan_records.loan_code,
      branchId: loan_records.branch_id,
      dueDate: loan_records.due_date,
      principal: loan_records.principal,
      interest: loan_records.interest,
      storedStatus: loan_records.status,
      totalCollected: sql<number>`coalesce(${loanCollectionTotals.totalCollected}, 0)`,
    })
    .from(loan_records)
    .leftJoin(loanCollectionTotals, eq(loanCollectionTotals.loanId, loan_records.loan_id))
    .where(inArray(sql<string>`lower(${loan_records.status})`, NON_TERMINAL_STORED_LOAN_STATUSES as unknown as string[]))
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

    await Promise.all(
      results
        .filter((row) => row.changed)
        .map(async (row) => {
          await logAuditEvent({
            action: "loan.status_changed_system",
            entityType: "loan",
            entityId: row.loanCode,
            actor: buildSystemAuditActor(),
            branchId: row.branchId,
            branchScope: [row.branchId],
            description: `System reconciled loan ${row.loanCode} from ${row.previousStatus} to ${row.nextStatus}.`,
            metadata: {
              loanCode: row.loanCode,
              previousStatus: row.previousStatus,
              nextStatus: row.nextStatus,
              totalPayable: row.totalPayable,
              totalCollected: row.totalCollected,
              remainingBalance: row.remainingBalance,
              source: "scheduled_reconciliation",
              debug: row.debug,
            },
          });
        }),
    );
  }

  return {
    currentDate,
    processedLoans: results.length,
    updatedLoans: Array.from(changedLoanIdsByStatus.values()).reduce((sum, loanIds) => sum + loanIds.length, 0),
    statusCounts,
    updatedLoanIds: Array.from(changedLoanIdsByStatus.values()).flat(),
  };
}
