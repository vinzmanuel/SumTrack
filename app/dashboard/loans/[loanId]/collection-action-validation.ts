import type { LoanDetailState } from "@/app/dashboard/loans/[loanId]/state";
import type {
  CollectionActionFieldErrors,
  CollectionFormFields,
  CollectionStateFactory,
  ParsedCollectionInput,
} from "@/app/dashboard/loans/[loanId]/collection-action-types";

function getTrimmed(formData: FormData, key: keyof CollectionFormFields) {
  return String(formData.get(key) ?? "").trim();
}

function parsePositiveAmount(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return amount;
}

export function buildCollectionStateFactory(prevState: LoanDetailState): CollectionStateFactory {
  return {
    appendedRows: prevState.appendedRows ?? [],
  };
}

export function buildCollectionErrorState(
  factory: CollectionStateFactory,
  message: string,
  fieldErrors?: CollectionActionFieldErrors,
): LoanDetailState {
  return {
    status: "error",
    message,
    appendedRows: factory.appendedRows,
    fieldErrors,
  };
}

export function parseCollectionFormData(formData: FormData): ParsedCollectionInput {
  const amountRaw = getTrimmed(formData, "amount");
  const missedPayment = formData.get("missed_payment") === "on";

  return {
    loanIdRaw: getTrimmed(formData, "loan_id"),
    amountRaw,
    note: getTrimmed(formData, "note"),
    collectionDate: getTrimmed(formData, "collection_date"),
    missedPayment,
    amount: missedPayment ? 0 : (parsePositiveAmount(amountRaw) ?? 0),
  };
}

export function validateCollectionInput(input: ParsedCollectionInput): CollectionActionFieldErrors {
  const fieldErrors: CollectionActionFieldErrors = {};

  if (!input.loanIdRaw) {
    fieldErrors.loan_id = "Loan is required.";
  }

  if (!input.collectionDate) {
    fieldErrors.collection_date = "Collection date is required.";
  }

  if (!input.missedPayment) {
    if (parsePositiveAmount(input.amountRaw) === null) {
      fieldErrors.amount = "Amount must be greater than 0.";
    }
  } else if (!input.note) {
    fieldErrors.note = "Note is required for missed payment.";
  }

  return fieldErrors;
}
