"use server";

import { createClient } from "@/lib/supabase/server";
import type { CreateLoanState } from "@/app/dashboard/create-loan/state";

type RoleRow = {
  role_name: string;
};

type AppUserRow = {
  role_id: string | null;
};

type BorrowerInfoRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
};

type UserRow = {
  username: string | null;
};

type BranchRow = {
  branch_id: string;
  branch_name: string;
};

type LoanInsertRow = {
  loan_id: string | number;
};

type FormFields = {
  borrower_id: string;
  branch_id: string;
  principal: string;
  interest: string;
  start_date: string;
  due_date: string;
};

type ActionFieldErrors = Partial<Record<keyof FormFields, string>>;

const NEW_LOAN_STATUS = "Active";

function getTrimmed(formData: FormData, key: keyof FormFields) {
  return String(formData.get(key) ?? "").trim();
}

function toDbId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : value;
}

function parseNonNegativeNumber(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (parsed < 0) {
    return null;
  }

  return parsed;
}

export async function createLoanAction(
  _prevState: CreateLoanState,
  formData: FormData,
): Promise<CreateLoanState> {
  const borrowerId = getTrimmed(formData, "borrower_id");
  const branchId = getTrimmed(formData, "branch_id");
  const principalRaw = getTrimmed(formData, "principal");
  const interestRaw = getTrimmed(formData, "interest");
  const startDate = getTrimmed(formData, "start_date");
  const dueDate = getTrimmed(formData, "due_date");

  const fieldErrors: ActionFieldErrors = {};

  if (!borrowerId) {
    fieldErrors.borrower_id = "Borrower is required.";
  }
  if (!branchId) {
    fieldErrors.branch_id = "Branch is required.";
  }

  const principal = parseNonNegativeNumber(principalRaw);
  if (principal === null) {
    fieldErrors.principal = "Principal must be a number greater than or equal to 0.";
  }

  const interest = parseNonNegativeNumber(interestRaw);
  if (interest === null) {
    fieldErrors.interest = "Interest must be a number greater than or equal to 0.";
  }

  if (!startDate) {
    fieldErrors.start_date = "Start date is required.";
  }

  if (!dueDate) {
    fieldErrors.due_date = "Due date is required.";
  }

  if (startDate && dueDate && dueDate < startDate) {
    fieldErrors.due_date = "Due date cannot be earlier than start date.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
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
      message: "Only Admin users can create loans.",
    };
  }

  const { data: borrowerInfo, error: borrowerError } = await supabase
    .from("borrower_info")
    .select("user_id, first_name, last_name")
    .eq("user_id", toDbId(borrowerId))
    .maybeSingle<BorrowerInfoRow>();

  if (borrowerError || !borrowerInfo) {
    return {
      status: "error",
      message: "Selected borrower was not found.",
    };
  }

  const { data: borrowerUser } = await supabase
    .from("users")
    .select("username")
    .eq("user_id", borrowerInfo.user_id)
    .maybeSingle<UserRow>();

  const borrowerName =
    [borrowerInfo.first_name, borrowerInfo.last_name].filter(Boolean).join(" ") ||
    borrowerUser?.username ||
    borrowerInfo.user_id;

  const { data: branch, error: branchError } = await supabase
    .from("branch")
    .select("branch_id, branch_name")
    .eq("branch_id", toDbId(branchId))
    .maybeSingle<BranchRow>();

  if (branchError || !branch) {
    return {
      status: "error",
      message: "Selected branch was not found.",
    };
  }

  const { data: insertedLoan, error: insertError } = await supabase
    .from("loan_records")
    .insert({
      borrower_id: borrowerInfo.user_id,
      principal: principal!,
      interest: interest!,
      start_date: startDate,
      due_date: dueDate,
      branch_id: branch.branch_id,
      status: NEW_LOAN_STATUS,
    })
    .select("loan_id")
    .maybeSingle<LoanInsertRow>();

  if (insertError || !insertedLoan?.loan_id) {
    return {
      status: "error",
      message: `Failed to create loan: ${insertError?.message ?? "Unknown error."}`,
    };
  }

  return {
    status: "success",
    message: "Loan created successfully.",
    result: {
      loanId: String(insertedLoan.loan_id),
      borrowerName,
      branchName: branch.branch_name,
      principal: principal!,
      interest: interest!,
      startDate,
      dueDate,
      status: NEW_LOAN_STATUS,
    },
  };
}
