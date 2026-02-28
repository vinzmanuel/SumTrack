"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  collections,
  employee_area_assignment,
  employee_info,
  loan_records,
  roles,
  users,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import type { CollectionHistoryRow, LoanDetailState } from "@/app/dashboard/loans/[loanId]/state";

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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function generateNextCollectionCode(loanId: number, loanCode: string) {
  const existingCollectionCodes = await db
    .select({ collection_code: collections.collection_code })
    .from(collections)
    .where(eq(collections.loan_id, loanId));

  const pattern = new RegExp(`^${escapeRegExp(loanCode)}-C(\\d{3})$`);
  let maxSequence = 0;

  for (const row of existingCollectionCodes) {
    const match = row.collection_code.match(pattern);
    if (!match) {
      continue;
    }

    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) {
      maxSequence = Math.max(maxSequence, parsed);
    }
  }

  const nextSequence = String(maxSequence + 1).padStart(3, "0");
  return `${loanCode}-C${nextSequence}`;
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

  const currentAppUser = await db
    .select({
      role_id: users.role_id,
    })
    .from(users)
    .where(eq(users.user_id, currentAuthUser.id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!currentAppUser?.role_id) {
    return {
      status: "error",
      message: "Unable to verify your app account.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const currentRole = await db
    .select({
      role_name: roles.role_name,
    })
    .from(roles)
    .where(eq(roles.role_id, currentAppUser.role_id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (currentRole?.role_name !== "Admin") {
    return {
      status: "error",
      message: "Only Admin users can record collections.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const loanIdDb = toDbId(loanId);
  const loan =
    typeof loanIdDb === "number"
      ? await db
          .select({
            loan_id: loan_records.loan_id,
            loan_code: loan_records.loan_code,
            borrower_id: loan_records.borrower_id,
          })
          .from(loan_records)
          .where(eq(loan_records.loan_id, loanIdDb))
          .limit(1)
          .then((rows) => rows[0] ?? null)
          .catch(() => null)
      : null;

  if (!loan) {
    return {
      status: "error",
      message: "Loan not found.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const borrower = await db
    .select({
      user_id: borrower_info.user_id,
      area_id: borrower_info.area_id,
    })
    .from(borrower_info)
    .where(eq(borrower_info.user_id, loan.borrower_id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!borrower) {
    return {
      status: "error",
      message: "Borrower not found for the selected loan.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const borrowerArea = await db
    .select({
      area_id: areas.area_id,
    })
    .from(areas)
    .where(eq(areas.area_id, borrower.area_id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!borrowerArea) {
    return {
      status: "error",
      message: "Borrower area not found for the selected loan.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const collectorUser = await db
    .select({
      user_id: users.user_id,
      role_id: users.role_id,
      username: users.username,
    })
    .from(users)
    .where(eq(users.user_id, collectorId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!collectorUser?.role_id) {
    return {
      status: "error",
      message: "Collector account not found.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const collectorRole = await db
    .select({
      role_name: roles.role_name,
    })
    .from(roles)
    .where(eq(roles.role_id, collectorUser.role_id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (collectorRole?.role_name !== "Collector") {
    return {
      status: "error",
      message: "Selected account is not a Collector.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const activeCollectorAssignment = await db
    .select({
      assignment_id: employee_area_assignment.assignment_id,
    })
    .from(employee_area_assignment)
    .where(
      and(
        eq(employee_area_assignment.employee_user_id, collectorUser.user_id),
        eq(employee_area_assignment.area_id, borrowerArea.area_id),
        isNull(employee_area_assignment.end_date),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!activeCollectorAssignment) {
    return {
      status: "error",
      message: "Selected collector is not actively assigned to the borrower's area.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const collectorEmployee = await db
    .select({
      first_name: employee_info.first_name,
      last_name: employee_info.last_name,
    })
    .from(employee_info)
    .where(eq(employee_info.user_id, collectorUser.user_id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const collectorName =
    [collectorEmployee?.first_name, collectorEmployee?.last_name].filter(Boolean).join(" ") ||
    collectorUser.username ||
    collectorUser.user_id;

  const nextCollectionCode = await generateNextCollectionCode(loan.loan_id, loan.loan_code).catch(
    () => null,
  );

  if (!nextCollectionCode) {
    return {
      status: "error",
      message: "Failed to generate collection code.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  let insertedCollection:
    | {
        collection_id: number;
        collection_code: string;
        amount: string;
        note: string | null;
        collection_date: string;
      }
    | null = null;

  try {
    insertedCollection = await db
      .insert(collections)
      .values({
        collection_code: nextCollectionCode,
        loan_id: loan.loan_id,
        amount: String(missedPayment ? 0 : amount),
        note: note || null,
        encoded_by: currentAuthUser.id,
        collector_id: collectorUser.user_id,
        collection_date: collectionDate,
      })
      .returning({
        collection_id: collections.collection_id,
        collection_code: collections.collection_code,
        amount: collections.amount,
        note: collections.note,
        collection_date: collections.collection_date,
      })
      .then((rows) => rows[0] ?? null);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error.";
    return {
      status: "error",
      message: `Failed to record collection: ${errorMessage}`,
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  if (!insertedCollection?.collection_id) {
    return {
      status: "error",
      message: "Failed to record collection: Unknown error.",
      appendedRows: prevState.appendedRows ?? [],
    };
  }

  const insertedAmount = Number(insertedCollection.amount);
  const newRow: CollectionHistoryRow = {
    collectionId: String(insertedCollection.collection_id),
    collectionCode: insertedCollection.collection_code,
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
      collectionCode: insertedCollection.collection_code,
      collectionDate: insertedCollection.collection_date,
      amount: Number.isFinite(insertedAmount) ? insertedAmount : 0,
      collectorName,
      note: insertedCollection.note,
      missedPayment,
      collectionRow: newRow,
    },
  };
}
