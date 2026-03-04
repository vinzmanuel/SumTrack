export type CollectionHistoryRow = {
  collectionId: string;
  collectionCode: string;
  collectionDate: string;
  amount: number;
  note: string | null;
  collectorName: string;
};

export type LoanDetailState = {
  status: "idle" | "error" | "success";
  message?: string;
  appendedRows?: CollectionHistoryRow[];
  fieldErrors?: {
    amount?: string;
    note?: string;
    collection_date?: string;
    loan_id?: string;
  };
  result?: {
    collectionId: string;
    collectionCode: string;
    collectionDate: string;
    amount: number;
    collectorName: string;
    note: string | null;
    missedPayment: boolean;
    collectionRow: CollectionHistoryRow;
  };
};

export const initialLoanDetailState: LoanDetailState = {
  status: "idle",
};
