"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  branch,
  employee_area_assignment,
  employee_info,
  loan_records,
  roles,
  users,
} from "@/db/schema";
import { resolveCreateLoanAccess } from "@/app/dashboard/create-loan/access";
import {
  calculateCalendarDayDiff,
  calculateScheduledDueDate,
} from "@/app/dashboard/loans/loan-schedule";
import { LIVE_STORED_LOAN_STATUSES } from "@/app/dashboard/loans/loan-state";
import type { CreateLoanState } from "@/app/dashboard/create-loan/state";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { logAuditEvent } from "@/lib/audit/logger";

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

const NEW_LOAN_STATUS = "active";
const MAX_PRINCIPAL = 25_000;
const INTEREST_INPUT_PATTERN = /^\d{1,2}(\.\d{1,2})?$/;

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

function toUtcDate(value: string) {
  const parsed = parseDateParts(value);
  if (!parsed) {
    return null;
  }

  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}

function getGoodFriday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easterSunday = new Date(Date.UTC(year, month - 1, day));
  easterSunday.setUTCDate(easterSunday.getUTCDate() - 2);
  return easterSunday;
}

function getBlockedCustomDateReason(value: string) {
  const parsed = parseDateParts(value);
  const date = toUtcDate(value);

  if (!parsed || !date) {
    return null;
  }

  if (date.getUTCDay() === 0) {
    return "Sundays are not allowed for custom terms.";
  }

  const goodFriday = getGoodFriday(parsed.year);
  if (
    goodFriday.getUTCFullYear() === parsed.year &&
    goodFriday.getUTCMonth() + 1 === parsed.month &&
    goodFriday.getUTCDate() === parsed.day
  ) {
    return "Good Friday is not allowed for custom terms.";
  }

  if (parsed.month === 1 && parsed.day === 1) {
    return "New Year's Day is not allowed for custom terms.";
  }

  if (parsed.month === 11 && parsed.day === 1) {
    return "All Saints' Day is not allowed for custom terms.";
  }

  if (parsed.month === 12 && parsed.day === 25) {
    return "Christmas Day is not allowed for custom terms.";
  }

  return null;
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
  const requestContext = await getAuditRequestContext();
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
  const principalClamped = principal === null ? null : Math.min(principal, MAX_PRINCIPAL);

  const interest = parseNonNegativeNumber(interestRaw);
  if (interest === null) {
    fieldErrors.interest = "Interest must be a number greater than or equal to 0.";
  } else if (!INTEREST_INPUT_PATTERN.test(interestRaw)) {
    fieldErrors.interest = "Interest must be up to 2 digits (max 99.99).";
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

  const access = await resolveCreateLoanAccess();
  if (!access.ok) {
    return {
      status: "error",
      message: access.message,
    };
  }

  const isAdmin = access.isAdmin;
  const canUseCustomTerm = access.roleName === "Admin" || access.roleName === "Branch Manager";
  const allowedBranchId = access.fixedBranchId;

  const borrowerInfo = await db
    .select({
      user_id: borrower_info.user_id,
      area_id: borrower_info.area_id,
      first_name: borrower_info.first_name,
      last_name: borrower_info.last_name,
      company_id: users.company_id,
      username: users.username,
      borrower_branch_id: areas.branch_id,
      borrower_area_id: areas.area_id,
      borrower_area_status: areas.status,
      branch_name: branch.branch_name,
      branch_status: branch.status,
    })
    .from(borrower_info)
    .innerJoin(users, eq(users.user_id, borrower_info.user_id))
    .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
    .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
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

  const borrowerName =
    [borrowerInfo.first_name, borrowerInfo.last_name].filter(Boolean).join(" ") ||
    borrowerInfo.username ||
    borrowerInfo.user_id;

  const branchIdDb = toDbId(branchId);
  const areaIdDb = toDbId(areaId);

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

  if (borrowerInfo.borrower_area_id !== areaIdDb) {
    return {
      status: "error",
      message: "Selected area does not match the borrower's assigned area.",
      fieldErrors: {
        area_id: "Borrower belongs to a different area.",
      },
    };
  }

  if (borrowerInfo.borrower_branch_id !== branchIdDb) {
    return {
      status: "error",
      message: "Selected branch does not match the borrower's assigned branch.",
      fieldErrors: {
        branch_id: `Borrower belongs to ${borrowerInfo.branch_name}.`,
      },
    };
  }

  if (borrowerInfo.branch_status !== "active") {
    return {
      status: "error",
      message: "Loans cannot be created under an inactive branch.",
      fieldErrors: {
        branch_id: "Selected branch is inactive.",
      },
    };
  }

  if (borrowerInfo.borrower_area_status !== "active") {
    return {
      status: "error",
      message: "Loans cannot be created under an inactive area.",
      fieldErrors: {
        area_id: "Selected area is inactive.",
      },
    };
  }

  if (!isAdmin && allowedBranchId !== null && borrowerInfo.borrower_branch_id !== allowedBranchId) {
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
      username: users.username,
      role_name: roles.role_name,
      first_name: employee_info.first_name,
      last_name: employee_info.last_name,
    })
    .from(users)
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .where(eq(users.user_id, collectorId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!collectorUser?.user_id) {
    return {
      status: "error",
      message: "Selected collector was not found.",
      fieldErrors: {
        collector_id: "Collector account not found.",
      },
    };
  }

  if (collectorUser.role_name !== "Collector") {
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
        eq(employee_area_assignment.area_id, borrowerInfo.borrower_area_id),
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

  const collectorName =
    [collectorUser.first_name, collectorUser.last_name].filter(Boolean).join(" ") ||
    collectorUser.username ||
    collectorUser.user_id;

  if (!borrowerInfo.company_id) {
    return {
      status: "error",
      message: "Borrower company ID is missing.",
    };
  }

  const existingLoans = await db
    .select({
      loan_id: loan_records.loan_id,
      status: loan_records.status,
    })
    .from(loan_records)
    .where(
      and(
        eq(loan_records.borrower_id, borrowerInfo.user_id),
        inArray(loan_records.status, [...LIVE_STORED_LOAN_STATUSES]),
      ),
    )
    .then((rows) => rows)
    .catch(() => []);

  const hasExistingActiveLoan = existingLoans.length > 0;

  if (hasExistingActiveLoan) {
    return {
      status: "error",
      message: "This borrower already has an active loan. Only one active loan is allowed.",
      fieldErrors: {
        borrower_id: "Borrower already has an active loan.",
      },
    };
  }

  const nextLoanCode = await generateNextLoanCode(borrowerInfo.user_id, borrowerInfo.company_id).catch(
    () => null,
  );

  if (!nextLoanCode) {
    return {
      status: "error",
      message: "Failed to generate a loan code.",
    };
  }

  const rawCalendarDayDiff = calculateCalendarDayDiff(startDate, dueDate);
  if (rawCalendarDayDiff === null) {
    return {
      status: "error",
      message: "Invalid loan term. Due date must be after start date.",
      fieldErrors: {
        due_date: "Due date must be after start date.",
      },
    };
  }

  let termDays: number | null = rawCalendarDayDiff;

  if (!canUseCustomTerm && termDays !== 58 && termDays !== 60) {
    const expectedScheduleTerm = termOption === "58" || termOption === "60" ? Number(termOption) : null;
    if (expectedScheduleTerm === null) {
      return {
        status: "error",
        message: "Non-admin users can only create 58-day or 60-day loans.",
        fieldErrors: {
          due_date: "Loan term must be 58 or 60 scheduled due dates.",
        },
      };
    }
    termDays = expectedScheduleTerm;
  }

  if (termOption === "58" || termOption === "60") {
    const expectedDueDate = calculateScheduledDueDate({
      startDate,
      obligationCount: Number(termOption),
    });
    if (!expectedDueDate || dueDate !== expectedDueDate) {
      return {
        status: "error",
        message: "Due date does not match the selected fixed term.",
        fieldErrors: {
          due_date: "Due date must match the generated valid collection schedule.",
        },
      };
    }
    termDays = Number(termOption);
  } else if (termOption === "custom") {
    if (!canUseCustomTerm) {
      return {
        status: "error",
        message: "Only Admin or Branch Manager can use custom loan terms.",
      };
    }

    const blockedStartDateReason = getBlockedCustomDateReason(startDate);
    const blockedDueDateReason = getBlockedCustomDateReason(dueDate);
    if (blockedStartDateReason || blockedDueDateReason) {
      return {
        status: "error",
        message: "Custom terms cannot use restricted dates.",
        fieldErrors: {
          ...(blockedStartDateReason ? { start_date: blockedStartDateReason } : {}),
          ...(blockedDueDateReason ? { due_date: blockedDueDateReason } : {}),
        },
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
      principal: String(principalClamped!),
      interest: String(interest!),
      collector_id: collectorUser.user_id,
      start_date: startDate,
      due_date: dueDate,
      term_days: termDays,
      branch_id: borrowerInfo.borrower_branch_id,
      created_by: access.userId,
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

  await logAuditEvent({
    action: "loan.created",
    entityType: "loan",
    entityId: insertedLoan.loan_code,
    actor: {
      type: "user",
      userId: access.userId,
      roleName: access.roleName,
    },
    branchId: borrowerInfo.borrower_branch_id,
    branchScope: [borrowerInfo.borrower_branch_id],
    description: `Created loan ${insertedLoan.loan_code} for ${borrowerName}.`,
    requestContext,
    metadata: {
      loanCode: insertedLoan.loan_code,
      borrowerId: borrowerInfo.user_id,
      borrowerCompanyId: borrowerInfo.company_id,
      borrowerName,
      collectorId: collectorUser.user_id,
      collectorName,
      branchId: borrowerInfo.borrower_branch_id,
      areaId: borrowerInfo.borrower_area_id,
      principal: principalClamped!,
      interest: interest!,
      startDate,
      dueDate,
      termDays,
      status: NEW_LOAN_STATUS,
    },
  });

  return {
    status: "success",
    message: "Loan created successfully.",
    result: {
      loanId: String(insertedLoan.loan_id),
      loanCode: insertedLoan.loan_code,
      borrowerName,
      branchName: borrowerInfo.branch_name,
      collectorName,
      principal: principalClamped!,
      interest: interest!,
      startDate,
      dueDate,
      termDays,
      status: "Active",
    },
  };
}
