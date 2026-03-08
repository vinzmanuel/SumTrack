import type { CollectionHistoryRow, LoanDetailState } from "@/app/dashboard/loans/[loanId]/state";

export type CollectionFormFields = {
  loan_id: string;
  amount: string;
  note: string;
  collection_date: string;
  missed_payment: string;
};

export type CollectionActionFieldErrors = Partial<Record<keyof CollectionFormFields, string>>;

export type ParsedCollectionInput = {
  loanIdRaw: string;
  amountRaw: string;
  note: string;
  collectionDate: string;
  missedPayment: boolean;
  amount: number;
};

export type CollectionCreatorAccess = {
  userId: string;
  isAdmin: boolean;
  allowedBranchId: number | null;
};

export type LoanCollectionContext = {
  loanId: number;
  loanCode: string;
  branchId: number;
  collectorName: string;
};

export type InsertedCollectionRecord = {
  collectionId: number;
  collectionCode: string;
  amount: number;
  note: string | null;
  collectionDate: string;
};

export type CollectionActionResolution<T> =
  | { ok: true; data: T }
  | { ok: false; state: LoanDetailState };

export type CollectionStateFactory = {
  appendedRows: CollectionHistoryRow[];
};
