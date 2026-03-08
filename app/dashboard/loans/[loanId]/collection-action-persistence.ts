import { db } from "@/db";
import { collections } from "@/db/schema";
import type {
  InsertedCollectionRecord,
  LoanCollectionContext,
  ParsedCollectionInput,
} from "@/app/dashboard/loans/[loanId]/collection-action-types";

async function insertCollectionRecord(params: {
  collectionCode: string;
  loanContext: LoanCollectionContext;
  encodedBy: string;
  amount: string;
  note: string | null;
  collectionDate: string;
}) {
  return db
    .insert(collections)
    .values({
      collection_code: params.collectionCode,
      loan_id: params.loanContext.loanId,
      amount: params.amount,
      note: params.note,
      encoded_by: params.encodedBy,
      collection_date: params.collectionDate,
    })
    .returning({
      collection_id: collections.collection_id,
      collection_code: collections.collection_code,
      amount: collections.amount,
      note: collections.note,
      collection_date: collections.collection_date,
    })
    .then((rows) => rows[0] ?? null);
}

export async function insertRecordedPayment(params: {
  collectionCode: string;
  loanContext: LoanCollectionContext;
  encodedBy: string;
  input: ParsedCollectionInput;
}): Promise<InsertedCollectionRecord | null> {
  const insertedCollection = await insertCollectionRecord({
    collectionCode: params.collectionCode,
    loanContext: params.loanContext,
    encodedBy: params.encodedBy,
    amount: String(params.input.amount),
    note: params.input.note || null,
    collectionDate: params.input.collectionDate,
  });

  if (!insertedCollection?.collection_id) {
    return null;
  }

  return {
    collectionId: insertedCollection.collection_id,
    collectionCode: insertedCollection.collection_code,
    amount: Number(insertedCollection.amount) || 0,
    note: insertedCollection.note,
    collectionDate: insertedCollection.collection_date,
  };
}

export async function insertMissedPaymentRecord(params: {
  collectionCode: string;
  loanContext: LoanCollectionContext;
  encodedBy: string;
  input: ParsedCollectionInput;
}): Promise<InsertedCollectionRecord | null> {
  const insertedCollection = await insertCollectionRecord({
    collectionCode: params.collectionCode,
    loanContext: params.loanContext,
    encodedBy: params.encodedBy,
    amount: "0",
    note: params.input.note || null,
    collectionDate: params.input.collectionDate,
  });

  if (!insertedCollection?.collection_id) {
    return null;
  }

  return {
    collectionId: insertedCollection.collection_id,
    collectionCode: insertedCollection.collection_code,
    amount: Number(insertedCollection.amount) || 0,
    note: insertedCollection.note,
    collectionDate: insertedCollection.collection_date,
  };
}
