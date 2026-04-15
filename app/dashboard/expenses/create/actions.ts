"use server";
import {
  getDashboardAuthContext,
  getSingleAssignedBranchId,
} from "@/app/dashboard/auth";
import { db } from "@/db";
import { branch, expenses } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { CreateExpenseState } from "@/app/dashboard/expenses/create/state";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { buildAuditActorFromAuth, logAuditEvent } from "@/lib/audit/logger";

type FormFields = {
  branch_id: string;
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

function parseDateParts(value: string) {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { year, month, day };
}

function toUtcDateFromDateInput(value: string) {
  const parsed = parseDateParts(value);
  if (!parsed) {
    return null;
  }

  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}

function getTodayDateStringInManila() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

export async function createExpenseAction(
  _prevState: CreateExpenseState,
  formData: FormData,
): Promise<CreateExpenseState> {
  const requestContext = await getAuditRequestContext();
  const branchIdRaw = getTrimmed(formData, "branch_id");
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
  } else {
    const parsedExpenseDate = toUtcDateFromDateInput(expenseDate);
    const parsedToday = toUtcDateFromDateInput(getTodayDateStringInManila());

    if (!parsedExpenseDate) {
      fieldErrors.expense_date = "Expense date is invalid.";
    } else if (parsedToday && parsedExpenseDate.getTime() > parsedToday.getTime()) {
      fieldErrors.expense_date = "Expense date cannot be in the future.";
    }
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

  let branchId: number | null = null;
  let branchName: string | null = null;

  if (auth.roleName === "Admin") {
    if (!/^\d+$/.test(branchIdRaw)) {
      fieldErrors.branch_id = "Branch is required.";
    } else {
      branchId = Number(branchIdRaw);

      if (!auth.assignedBranchIds.includes(branchId)) {
        return {
          status: "error",
          message: "You are not authorized to record expenses for that branch.",
        };
      }

      const branchRow = await db
        .select({ branch_name: branch.branch_name, status: branch.status })
        .from(branch)
        .where(eq(branch.branch_id, branchId))
        .limit(1)
        .then((rows) => rows[0] ?? null)
        .catch(() => null);

      if (!branchRow?.branch_name) {
        fieldErrors.branch_id = "Selected branch is invalid.";
      } else if (branchRow.status !== "active") {
        fieldErrors.branch_id = "Selected branch is inactive. Expenses can only be recorded for active branches.";
      } else {
        branchName = branchRow.branch_name;
      }
    }
  } else if (auth.roleName === "Branch Manager") {
    if (auth.assignedBranchIds.length === 0) {
      return {
        status: "error",
        message: "No active branch assignment found for your account.",
      };
    }

    branchId = getSingleAssignedBranchId(auth);
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

    const branchRow = await db
      .select({ branch_name: branch.branch_name, status: branch.status })
      .from(branch)
      .where(eq(branch.branch_id, branchId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null);

    if (!branchRow?.branch_name) {
      return {
        status: "error",
        message: "Active branch assignment points to an invalid branch.",
      };
    }

    if (branchRow.status !== "active") {
      return {
        status: "error",
        message: "Your assigned branch is inactive. Expenses can only be recorded for active branches.",
      };
    }

    branchName = branchRow.branch_name;
  } else {
    return {
      status: "error",
      message: "Only Admin and Branch Manager users can record expenses.",
    };
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  if (branchId === null || !branchName) {
    return {
      status: "error",
      message: "Unable to resolve the target branch for this expense.",
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

  await logAuditEvent({
    action: "expense.created",
    entityType: "expense",
    entityId: insertedExpense.expense_id,
    actor: buildAuditActorFromAuth(auth),
    branchId,
    branchScope: [branchId],
    description: `Recorded ${expenseCategory} expense for ${branchName}.`,
    requestContext,
    metadata: {
      expenseId: insertedExpense.expense_id,
      branchName,
      category: insertedExpense.expense_category,
      amount: Number(insertedExpense.amount),
      expenseDate: insertedExpense.expense_date,
      description: insertedExpense.description,
    },
  });

  return {
    status: "success",
    message: "Expense recorded successfully.",
    result: {
      expenseId: String(insertedExpense.expense_id),
      branchName: branchName ?? "N/A",
      expenseCategory: insertedExpense.expense_category,
      description: insertedExpense.description,
      amount: Number(insertedExpense.amount),
      expenseDate: insertedExpense.expense_date,
    },
  };
}
