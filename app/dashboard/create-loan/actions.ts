"use server";

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  branch,
  employee_area_assignment,
  employee_branch_assignment,
  employee_info,
  loan_records,
  roles,
  users,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import type { CreateLoanState } from "@/app/dashboard/create-loan/state";

type FormFields = {
  borrower_id: string;
  branch_id: string;
  area_id: string;
  collector_id: string;
  principal: string;
  interest: string;
  start_date: string;
  due_date: string;
  term_option: string;
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

function diffInDays(startDate: string, dueDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const due = new Date(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) {
    return null;
  }

  const diff = Math.round((due.getTime() - start.getTime()) / 86400000);
  return diff > 0 ? diff : null;
}

function addDays(startDate: string, days: number) {
  const start = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || !Number.isFinite(days) || days <= 0) {
    return null;
  }
  start.setUTCDate(start.getUTCDate() + days);
  return start.toISOString().slice(0, 10);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function generateNextLoanCode(borrowerId: string, borrowerCompanyId: string) {
  const existingLoanCodes = await db
    .select({ loan_code: loan_records.loan_code })
    .from(loan_records)
    .where(eq(loan_records.borrower_id, borrowerId));

  const pattern = new RegExp(`^${escapeRegExp(borrowerCompanyId)}-L(\\d{3})$`);
  let maxSequence = 0;

  for (const row of existingLoanCodes) {
    const match = row.loan_code.match(pattern);
    if (!match) {
      continue;
    }

    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) {
      maxSequence = Math.max(maxSequence, parsed);
    }
  }

  const nextSequence = String(maxSequence + 1).padStart(3, "0");
  return `${borrowerCompanyId}-L${nextSequence}`;
}

export async function createLoanAction(
  _prevState: CreateLoanState,
  formData: FormData,
): Promise<CreateLoanState> {
  const borrowerId = getTrimmed(formData, "borrower_id");
  const branchId = getTrimmed(formData, "branch_id");
  const areaId = getTrimmed(formData, "area_id");
  const collectorId = getTrimmed(formData, "collector_id");
  const principalRaw = getTrimmed(formData, "principal");
  const interestRaw = getTrimmed(formData, "interest");
  const startDate = getTrimmed(formData, "start_date");
  const dueDate = getTrimmed(formData, "due_date");
  const termOption = getTrimmed(formData, "term_option");

  const fieldErrors: ActionFieldErrors = {};

  if (!borrowerId) {
    fieldErrors.borrower_id = "Borrower is required.";
  }
  if (!branchId) {
    fieldErrors.branch_id = "Branch is required.";
  }
  if (!areaId) {
    fieldErrors.area_id = "Area is required.";
  }
  if (!collectorId) {
    fieldErrors.collector_id = "Collector is required.";
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

  const currentAppUser = await db
    .select({ role_id: users.role_id })
    .from(users)
    .where(eq(users.user_id, currentAuthUser.id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!currentAppUser?.role_id) {
    return {
      status: "error",
      message: "Unable to verify your app account.",
    };
  }

  const currentRole = await db
    .select({ role_name: roles.role_name })
    .from(roles)
    .where(eq(roles.role_id, currentAppUser.role_id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const roleName = currentRole?.role_name ?? null;
  const isAdmin = roleName === "Admin";
  const isBranchManager = roleName === "Branch Manager";
  const isSecretary = roleName === "Secretary";

  if (!isAdmin && !isBranchManager && !isSecretary) {
    return {
      status: "error",
      message: "Only Admin, Branch Manager, and Secretary users can create loans.",
    };
  }

  let allowedBranchId: number | null = null;
  if (!isAdmin) {
    const assignments = await db
      .select({ branch_id: employee_branch_assignment.branch_id })
      .from(employee_branch_assignment)
      .where(
        and(
          eq(employee_branch_assignment.employee_user_id, currentAuthUser.id),
          isNull(employee_branch_assignment.end_date),
        ),
      )
      .catch(() => []);

    const uniqueBranchIds = Array.from(new Set(assignments.map((item) => item.branch_id)));
    if (uniqueBranchIds.length !== 1) {
      return {
        status: "error",
        message: "A single active branch assignment is required before creating loans.",
      };
    }

    allowedBranchId = uniqueBranchIds[0];
  }

  const borrowerInfo = await db
    .select({
      user_id: borrower_info.user_id,
      area_id: borrower_info.area_id,
      first_name: borrower_info.first_name,
      last_name: borrower_info.last_name,
    })
    .from(borrower_info)
    .where(eq(borrower_info.user_id, String(toDbId(borrowerId))))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!borrowerInfo) {
    return {
      status: "error",
      message: "Selected borrower was not found.",
    };
  }

  const borrowerUser = await db
    .select({
      company_id: users.company_id,
      username: users.username,
    })
    .from(users)
    .where(eq(users.user_id, borrowerInfo.user_id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const borrowerName =
    [borrowerInfo.first_name, borrowerInfo.last_name].filter(Boolean).join(" ") ||
    borrowerUser?.username ||
    borrowerInfo.user_id;

  const branchIdDb = toDbId(branchId);
  const areaIdDb = toDbId(areaId);
  const borrowerArea = await db
    .select({
      area_id: areas.area_id,
      branch_id: areas.branch_id,
    })
    .from(areas)
    .where(eq(areas.area_id, borrowerInfo.area_id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!borrowerArea) {
    return {
      status: "error",
      message: "Selected borrower area was not found.",
    };
  }

  const branchRow = await db
    .select({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
    })
    .from(branch)
    .where(eq(branch.branch_id, borrowerArea.branch_id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!branchRow) {
    return {
      status: "error",
      message: "Borrower branch was not found.",
    };
  }

  if (typeof branchIdDb !== "number") {
    return {
      status: "error",
      message: "Selected branch was not found.",
      fieldErrors: {
        branch_id: "Please select a branch.",
      },
    };
  }

  if (typeof areaIdDb !== "number") {
    return {
      status: "error",
      message: "Selected area was not found.",
      fieldErrors: {
        area_id: "Please select an area.",
      },
    };
  }

  if (borrowerArea.area_id !== areaIdDb) {
    return {
      status: "error",
      message: "Selected area does not match the borrower's assigned area.",
      fieldErrors: {
        area_id: "Borrower belongs to a different area.",
      },
    };
  }

  if (branchRow.branch_id !== branchIdDb) {
    return {
      status: "error",
      message: "Selected branch does not match the borrower's assigned branch.",
      fieldErrors: {
        branch_id: `Borrower belongs to ${branchRow.branch_name}.`,
      },
    };
  }

  if (!isAdmin && allowedBranchId !== null && branchRow.branch_id !== allowedBranchId) {
    return {
      status: "error",
      message: "You can only create loans within your assigned branch.",
      fieldErrors: {
        branch_id: "Selected borrower is outside your assigned branch.",
      },
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
      message: "Selected collector was not found.",
      fieldErrors: {
        collector_id: "Collector account not found.",
      },
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
      fieldErrors: {
        collector_id: "Select a valid collector account.",
      },
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
      fieldErrors: {
        collector_id: "Collector must be actively assigned to the selected borrower's area.",
      },
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

  if (!borrowerUser?.company_id) {
    return {
      status: "error",
      message: "Borrower company ID is missing.",
    };
  }

  const nextLoanCode = await generateNextLoanCode(borrowerInfo.user_id, borrowerUser.company_id).catch(
    () => null,
  );

  if (!nextLoanCode) {
    return {
      status: "error",
      message: "Failed to generate a loan code.",
    };
  }

  const termDays = diffInDays(startDate, dueDate);
  if (termDays === null) {
    return {
      status: "error",
      message: "Invalid loan term. Due date must be after start date.",
      fieldErrors: {
        due_date: "Due date must be after start date.",
      },
    };
  }

  if (!isAdmin && termDays !== 58 && termDays !== 60) {
    return {
      status: "error",
      message: "Non-admin users can only create 58-day or 60-day loans.",
      fieldErrors: {
        due_date: "Loan term must be 58 or 60 days.",
      },
    };
  }

  if (termOption === "58" || termOption === "60") {
    const expectedDueDate = addDays(startDate, Number(termOption));
    if (!expectedDueDate || dueDate !== expectedDueDate) {
      return {
        status: "error",
        message: "Due date does not match the selected fixed term.",
        fieldErrors: {
          due_date: "Due date must match start date plus selected term days.",
        },
      };
    }
  } else if (termOption === "custom") {
    if (!isAdmin) {
      return {
        status: "error",
        message: "Only Admin can use custom loan terms.",
      };
    }
  } else {
    return {
      status: "error",
      message: "Invalid loan term option.",
      fieldErrors: {
        term_option: "Please select a valid loan term.",
      },
    };
  }

  const insertedLoan = await db
    .insert(loan_records)
    .values({
      loan_code: nextLoanCode,
      borrower_id: borrowerInfo.user_id,
      principal: String(principal!),
      interest: String(interest!),
      collector_id: collectorUser.user_id,
      start_date: startDate,
      due_date: dueDate,
      term_days: termDays,
      branch_id: branchRow.branch_id,
      status: NEW_LOAN_STATUS,
    })
    .returning({ loan_id: loan_records.loan_id, loan_code: loan_records.loan_code })
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!insertedLoan?.loan_id || !insertedLoan.loan_code) {
    return {
      status: "error",
      message: "Failed to create loan: Unknown error.",
    };
  }

  return {
    status: "success",
    message: "Loan created successfully.",
    result: {
      loanId: String(insertedLoan.loan_id),
      loanCode: insertedLoan.loan_code,
      borrowerName,
      branchName: branchRow.branch_name,
      collectorName,
      principal: principal!,
      interest: interest!,
      startDate,
      dueDate,
      termDays,
      status: NEW_LOAN_STATUS,
    },
  };
}
