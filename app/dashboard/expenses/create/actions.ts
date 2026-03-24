"use server";
import {
  getDashboardAuthContext,
  getSingleAssignedBranchId,
} from "@/app/dashboard/auth";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import type { CreateExpenseState } from "@/app/dashboard/expenses/create/state";

type FormFields = {
  expense_category: string;
  description: string;
  amount: string;
  expense_date: string;
};

type ActionFieldErrors = Partial<Record<keyof FormFields, string>>;

const ALLOWED_EXPENSE_CATEGORIES = [
  "Rent",
  "Electricity",
  "Water",
  "Transportation",
  "Lunch",
  "Salary",
  "Miscellaneous",
] as const;

function getTrimmed(formData: FormData, key: keyof FormFields) {
  return String(formData.get(key) ?? "").trim();
}

function parsePositiveAmount(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function createExpenseAction(
  _prevState: CreateExpenseState,
  formData: FormData,
): Promise<CreateExpenseState> {
  const expenseCategory = getTrimmed(formData, "expense_category");
  const description = getTrimmed(formData, "description");
  const amountRaw = getTrimmed(formData, "amount");
  const expenseDate = getTrimmed(formData, "expense_date");

  const fieldErrors: ActionFieldErrors = {};

  if (!expenseCategory) {
    fieldErrors.expense_category = "Expense category is required.";
  } else if (!ALLOWED_EXPENSE_CATEGORIES.includes(expenseCategory as (typeof ALLOWED_EXPENSE_CATEGORIES)[number])) {
    fieldErrors.expense_category = "Invalid expense category.";
  }

  if (expenseCategory === "Miscellaneous" && !description) {
    fieldErrors.description =
      "Description is required for Miscellaneous. Please describe the specific expense.";
  }

  const amount = parsePositiveAmount(amountRaw);
  if (amount === null) {
    fieldErrors.amount = "Amount must be greater than 0.";
  }

  if (!expenseDate) {
    fieldErrors.expense_date = "Expense date is required.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const auth = await getDashboardAuthContext();

  if (!auth.ok) {
    return {
      status: "error",
      message: "You must be logged in.",
    };
  }

  if (auth.roleName !== "Branch Manager") {
    return {
      status: "error",
      message: "Only Branch Manager users can record expenses.",
    };
  }

  if (auth.assignedBranchIds.length === 0) {
    return {
      status: "error",
      message: "No active branch assignment found for your account.",
    };
  }

  const branchId = getSingleAssignedBranchId(auth);
  if (branchId === null) {
    return {
      status: "error",
      message: "Unable to resolve a single active branch assignment.",
    };
  }

  if (!auth.activeBranchName) {
    return {
      status: "error",
      message: "Active branch assignment points to an invalid branch.",
    };
  }

  const insertedExpense = await db
    .insert(expenses)
    .values({
      branch_id: branchId,
      amount: String(amount),
      expense_category: expenseCategory,
      description: description || "",
      expense_date: expenseDate,
      recorded_by: auth.userId,
    })
    .returning({
      expense_id: expenses.expense_id,
      amount: expenses.amount,
      expense_category: expenses.expense_category,
      description: expenses.description,
      expense_date: expenses.expense_date,
    })
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!insertedExpense?.expense_id) {
    return {
      status: "error",
      message: "Failed to save expense.",
    };
  }

  return {
    status: "success",
    message: "Expense recorded successfully.",
    result: {
      expenseId: String(insertedExpense.expense_id),
      branchName: auth.activeBranchName,
      expenseCategory: insertedExpense.expense_category,
      description: insertedExpense.description,
      amount: Number(insertedExpense.amount),
      expenseDate: insertedExpense.expense_date,
    },
  };
}
