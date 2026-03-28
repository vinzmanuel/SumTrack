"use server";

import { db } from "@/db";
import type { LoanDetailState } from "@/app/dashboard/loans/[loanId]/state";
import { resolveCollectionCreatorAccess, resolveLoanCollectionContext } from "@/app/dashboard/loans/[loanId]/collection-action-access";
import { generateNextCollectionCode } from "@/app/dashboard/loans/[loanId]/collection-action-codegen";
import {
  insertMissedPaymentRecord,
  insertRecordedPayment,
} from "@/app/dashboard/loans/[loanId]/collection-action-persistence";
import { reconcilePersistedLoanStatus } from "@/app/dashboard/loans/loan-status-persistence";
import type { CollectionHistoryRow } from "@/app/dashboard/loans/[loanId]/state";
import {
  buildCollectionErrorState,
  buildCollectionStateFactory,
  parseCollectionFormData,
  validateCollectionInput,
} from "@/app/dashboard/loans/[loanId]/collection-action-validation";

function buildCollectionHistoryRow(params: {
  collectionId: number;
  collectionCode: string;
  collectionDate: string;
  amount: number;
  note: string | null;
  collectorName: string;
  encodedByName: string;
}): CollectionHistoryRow {
  return {
    collectionId: String(params.collectionId),
    collectionCode: params.collectionCode,
    collectionDate: params.collectionDate,
    amount: params.amount,
    note: params.note,
    collectorName: params.collectorName,
    encodedByName: params.encodedByName,
  };
}

function logCollectionStatusProof(params: {
  loanCode: string;
  insertedCollectionAmount: number;
  insertedCollectionCode: string;
  reconciliation: Awaited<ReturnType<typeof reconcilePersistedLoanStatus>>;
}) {
  if (process.env.NODE_ENV === "production" || !params.reconciliation) {
    return;
  }

  const proofPayload = {
    flow: "collection-create -> reconcilePersistedLoanStatus",
    loanId: params.reconciliation.loanId,
    loanCode: params.loanCode,
    insertedCollectionCode: params.insertedCollectionCode,
    insertedCollectionAmount: params.insertedCollectionAmount,
    principal: params.reconciliation.debug.principal,
    interest: params.reconciliation.debug.interest,
    totalPayable: params.reconciliation.totalPayable,
    totalCollected: params.reconciliation.totalCollected,
    remainingBalance: params.reconciliation.remainingBalance,
    previousStatus: params.reconciliation.previousStatus,
    nextStatus: params.reconciliation.nextStatus,
    payoffReached: params.reconciliation.debug.payoffReached,
    aggregateSource: params.reconciliation.debug.source,
    dueDate: params.reconciliation.debug.dueDate,
    currentDate: params.reconciliation.debug.currentDate,
    statusChanged: params.reconciliation.changed,
  };

  console.info(
    [
      "[sumtrack][collection-status-proof] START",
      JSON.stringify(proofPayload, null, 2),
      "[sumtrack][collection-status-proof] END",
    ].join("\n"),
  );
}

export async function createCollectionAction(
  prevState: LoanDetailState,
  formData: FormData,
): Promise<LoanDetailState> {
  const stateFactory = buildCollectionStateFactory(prevState);
  const input = parseCollectionFormData(formData);
  const fieldErrors = validateCollectionInput(input);

  if (Object.keys(fieldErrors).length > 0) {
    return buildCollectionErrorState(stateFactory, "Please fix the highlighted fields.", fieldErrors);
  }

  const creatorAccess = await resolveCollectionCreatorAccess(stateFactory);
  if (!creatorAccess.ok) {
    return creatorAccess.state;
  }

  const loanContext = await resolveLoanCollectionContext(
    stateFactory,
    creatorAccess.data,
    input.loanIdRaw,
  );
  if (!loanContext.ok) {
    return loanContext.state;
  }

  if (!input.missedPayment && input.amount > loanContext.data.remainingBalance) {
    return buildCollectionErrorState(
      stateFactory,
      "Collection amount cannot exceed the remaining balance.",
      {
        amount: `Maximum allowed collection is ${loanContext.data.remainingBalance.toFixed(2)}.`,
      },
    );
  }

  const nextCollectionCode = await generateNextCollectionCode(
    loanContext.data.loanId,
    loanContext.data.loanCode,
  ).catch(() => null);

  if (!nextCollectionCode) {
    return buildCollectionErrorState(stateFactory, "Failed to generate collection code.");
  }

  try {
    const transactionResult = await db.transaction(async (tx) => {
      const persistedCollection = input.missedPayment
        ? await insertMissedPaymentRecord({
            collectionCode: nextCollectionCode,
            loanContext: loanContext.data,
            encodedBy: creatorAccess.data.userId,
            input,
            executor: tx,
          })
        : await insertRecordedPayment({
            collectionCode: nextCollectionCode,
            loanContext: loanContext.data,
            encodedBy: creatorAccess.data.userId,
            input,
            executor: tx,
          });

      if (!persistedCollection) {
        return null;
      }

      const reconciliation = await reconcilePersistedLoanStatus({
        loanId: loanContext.data.loanId,
        executor: tx,
      });

      return {
        persistedCollection,
        reconciliation,
      };
    });

    if (!transactionResult?.persistedCollection) {
      return buildCollectionErrorState(stateFactory, "Failed to record collection: Unknown error.");
    }

    logCollectionStatusProof({
      loanCode: loanContext.data.loanCode,
      insertedCollectionAmount: transactionResult.persistedCollection.amount,
      insertedCollectionCode: transactionResult.persistedCollection.collectionCode,
      reconciliation: transactionResult.reconciliation,
    });

    const newRow = buildCollectionHistoryRow({
      collectionId: transactionResult.persistedCollection.collectionId,
      collectionCode: transactionResult.persistedCollection.collectionCode,
      collectionDate: transactionResult.persistedCollection.collectionDate,
      amount: transactionResult.persistedCollection.amount,
      note: transactionResult.persistedCollection.note,
      collectorName: loanContext.data.collectorName,
      encodedByName: creatorAccess.data.displayName,
    });
    const appendedRows = [...stateFactory.appendedRows, newRow];

    return {
      status: "success",
      message: "Collection recorded successfully.",
      appendedRows,
      result: {
        collectionId: String(transactionResult.persistedCollection.collectionId),
        collectionCode: transactionResult.persistedCollection.collectionCode,
        collectionDate: transactionResult.persistedCollection.collectionDate,
        amount: transactionResult.persistedCollection.amount,
        collectorName: loanContext.data.collectorName,
        note: transactionResult.persistedCollection.note,
        missedPayment: input.missedPayment,
        collectionRow: newRow,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error.";
    return buildCollectionErrorState(stateFactory, `Failed to record collection: ${errorMessage}`);
  }
}
