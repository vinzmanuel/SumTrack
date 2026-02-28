"use server";

import { createClient } from "@/lib/supabase/server";
import type { CollectionHistoryRow, LoanDetailState } from "@/app/dashboard/loans/[loanId]/state";

type AppUserRow = {
  role_id: string | null;
};

type RoleRow = {
  role_name: string;
};

type LoanRow = {
  loan_id: string | number;
};

type CollectorUserRow = {
  user_id: string;
  role_id: string | null;
  username: string | null;
};

type EmployeeInfoRow = {
  first_name: string | null;
  last_name: string | null;
};

type CollectionInsertRow = {
  collection_id: string | number;
  amount: number | string;
  note: string | null;
  collection_date: string;
};

type FormFields = {
  loan_id: string;
  collector_id: string;
  amount: string;
  note: string;
  collection_date: string;
  missed_payment: string;
};

type ActionFieldErrors = Partial<Record<keyof FormFields, string>>;

function getTrimmed(formData: FormData, key: keyof FormFields) {
  return String(formData.get(key) ?? "").trim();
}

function toDbId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : value;
}

function parsePositiveAmount(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return amount;
}

export async function createCollectionAction(
  prevState: LoanDetailState,
  formData: FormData,
): Promise<LoanDetailState> {
  const loanId = getTrimmed(formData, "loan_id");
  const collectorId = getTrimmed(formData, "collector_id");
  const amountRaw = getTrimmed(formData, "amount");
  const note = getTrimmed(formData, "note");
  const collectionDate = getTrimmed(formData, "collection_date");
  const missedPayment = formData.get("missed_payment") === "on";

  const fieldErrors: ActionFieldErrors = {};

  if (!loanId) {
    fieldErrors.loan_id = "Loan is required.";
  }

  if (!collectorId) {
    fieldErrors.collector_id = "Collector is required.";
  }

  if (!collectionDate) {
    fieldErrors.collection_date = "Collection date is required.";
  }

  let amount = 0;
  if (!missedPayment) {
    const parsed = parsePositiveAmount(amountRaw);
    if (parsed === null) {
      fieldErrors.amount = "Amount must be greater than 0.";
    } else {
      amount = parsed;
    }
  } else if (!note) {
    fieldErrors.note = "Note is required for missed payment.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      appendedRows: prevState.appendedRows ?? [],
      fieldErrors,
    };
  }

  const supabase = await createClient();
  const {
    data: { user: currentAuthUser },
  } = await supabase.auth.getUser();

  if (!currentAuthUser) {
    return {
      status: "error",
      message: "You must be logged in.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const { data: currentAppUser, error: currentAppUserError } = await supabase
    .from("users")
    .select("role_id")
    .eq("user_id", currentAuthUser.id)
    .maybeSingle<AppUserRow>();

  if (currentAppUserError || !currentAppUser?.role_id) {
    return {
      status: "error",
      message: "Unable to verify your app account.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const { data: currentRole } = await supabase
    .from("roles")
    .select("role_name")
    .eq("role_id", currentAppUser.role_id)
    .maybeSingle<RoleRow>();

  if (currentRole?.role_name !== "Admin") {
    return {
      status: "error",
      message: "Only Admin users can record collections.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const { data: loan } = await supabase
    .from("loan_records")
    .select("loan_id")
    .eq("loan_id", toDbId(loanId))
    .maybeSingle<LoanRow>();

  if (!loan) {
    return {
      status: "error",
      message: "Loan not found.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const { data: collectorUser } = await supabase
    .from("users")
    .select("user_id, role_id, username")
    .eq("user_id", collectorId)
    .maybeSingle<CollectorUserRow>();

  if (!collectorUser?.role_id) {
    return {
      status: "error",
      message: "Collector account not found.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const { data: collectorRole } = await supabase
    .from("roles")
    .select("role_name")
    .eq("role_id", collectorUser.role_id)
    .maybeSingle<RoleRow>();

  if (collectorRole?.role_name !== "Collector") {
    return {
      status: "error",
      message: "Selected account is not a Collector.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const { data: collectorEmployee } = await supabase
    .from("employee_info")
    .select("first_name, last_name")
    .eq("user_id", collectorUser.user_id)
    .maybeSingle<EmployeeInfoRow>();

  const collectorName =
    [collectorEmployee?.first_name, collectorEmployee?.last_name].filter(Boolean).join(" ") ||
    collectorUser.username ||
    collectorUser.user_id;

  const { data: insertedCollection, error: insertError } = await supabase
    .from("collections")
    .insert({
      loan_id: toDbId(loanId),
      amount: missedPayment ? 0 : amount,
      note: note || null,
      encoded_by: currentAuthUser.id,
      collector_id: collectorUser.user_id,
      collection_date: collectionDate,
    })
    .select("collection_id, amount, note, collection_date")
    .maybeSingle<CollectionInsertRow>();

  if (insertError || !insertedCollection?.collection_id) {
    return {
      status: "error",
      message: `Failed to record collection: ${insertError?.message ?? "Unknown error."}`,
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const insertedAmount = Number(insertedCollection.amount);
  const newRow: CollectionHistoryRow = {
    collectionId: String(insertedCollection.collection_id),
    collectionDate: insertedCollection.collection_date,
    amount: Number.isFinite(insertedAmount) ? insertedAmount : 0,
    note: insertedCollection.note,
    collectorName,
  };
  const appendedRows = [...(prevState.appendedRows ?? []), newRow];

  return {
    status: "success",
    message: "Collection recorded successfully.",
    appendedRows,
    result: {
      collectionId: String(insertedCollection.collection_id),
      collectionDate: insertedCollection.collection_date,
      amount: Number.isFinite(insertedAmount) ? insertedAmount : 0,
      collectorName,
      note: insertedCollection.note,
      missedPayment,
      collectionRow: newRow,
    },
  };
}
