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
    const insertedCollection = await db.transaction(async (tx) => {
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

      await reconcilePersistedLoanStatus({
        loanId: loanContext.data.loanId,
        executor: tx,
      });

      return persistedCollection;
    });

    if (!insertedCollection) {
      return buildCollectionErrorState(stateFactory, "Failed to record collection: Unknown error.");
    }

    const newRow = buildCollectionHistoryRow({
      collectionId: insertedCollection.collectionId,
      collectionCode: insertedCollection.collectionCode,
      collectionDate: insertedCollection.collectionDate,
      amount: insertedCollection.amount,
      note: insertedCollection.note,
      collectorName: loanContext.data.collectorName,
      encodedByName: creatorAccess.data.displayName,
    });
    const appendedRows = [...stateFactory.appendedRows, newRow];

    return {
      status: "success",
      message: "Collection recorded successfully.",
      appendedRows,
      result: {
        collectionId: String(insertedCollection.collectionId),
        collectionCode: insertedCollection.collectionCode,
        collectionDate: insertedCollection.collectionDate,
        amount: insertedCollection.amount,
        collectorName: loanContext.data.collectorName,
        note: insertedCollection.note,
        missedPayment: input.missedPayment,
        collectionRow: newRow,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error.";
    return buildCollectionErrorState(stateFactory, `Failed to record collection: ${errorMessage}`);
  }
}
