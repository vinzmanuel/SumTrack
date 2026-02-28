"use server";

import { randomInt, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  branch,
  employee_area_assignment,
  employee_branch_assignment,
  employee_info,
  roles,
  users,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CreateAccountState } from "@/app/dashboard/create-account/state";

type AccountCategory = "Employee" | "Borrower";

type FormFields = {
  account_category: AccountCategory;
  role_id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  contact_number: string;
  address: string;
  branch_id: string;
  area_id: string;
  branch_ids: string;
};

type ActionFieldErrors = Partial<Record<keyof FormFields, string>>;

const EMPLOYEE_ROLE_NAMES = [
  "Admin",
  "Auditor",
  "Branch Manager",
  "Secretary",
  "Collector",
] as const;

const AUDITOR_ROLE_NAME = "Auditor";
const COLLECTOR_ROLE_NAME = "Collector";
const BORROWER_ROLE_NAME = "Borrower";
const BRANCH_REQUIRED_ROLE_NAMES = ["Branch Manager", "Secretary"];

function getTrimmed(formData: FormData, key: keyof FormFields) {
  return String(formData.get(key) ?? "").trim();
}

function toInt(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}

function generateTemporaryPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*_-+=";
  const allChars = `${upper}${lower}${digits}${symbols}`;

  const required = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    symbols[randomInt(symbols.length)],
  ];

  const remainingLength = 14 - required.length;
  const remaining = Array.from({ length: remainingLength }, () => allChars[randomInt(allChars.length)]);
  const mixed = [...required, ...remaining];

  for (let index = mixed.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [mixed[index], mixed[swapIndex]] = [mixed[swapIndex], mixed[index]];
  }

  return mixed.join("");
}

async function deleteAuthUserSafely(userId: string) {
  try {
    const adminClient = createAdminClient();
    await adminClient.auth.admin.deleteUser(userId);
  } catch {
    // Best-effort rollback only.
  }
}

async function generateNextEmployeeCompanyId() {
  const companyRows = await db.select({ company_id: users.company_id }).from(users);
  const maxNumeric = companyRows.reduce((currentMax, row) => {
    if (!/^\d+$/.test(row.company_id)) {
      return currentMax;
    }
    const parsed = Number(row.company_id);
    return Number.isFinite(parsed) ? Math.max(currentMax, parsed) : currentMax;
  }, 0);

  return String(maxNumeric + 1).padStart(6, "0");
}

async function generateNextBorrowerCompanyId(areaId: number, areaCode: string) {
  const rows = await db
    .select({
      company_id: users.company_id,
    })
    .from(borrower_info)
    .innerJoin(users, eq(users.user_id, borrower_info.user_id))
    .where(eq(borrower_info.area_id, areaId));

  const escapedAreaCode = areaCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suffixPattern = new RegExp(`^${escapedAreaCode}-(\\d{4})$`);

  let maxSuffix = 0;
  for (const row of rows) {
    const match = row.company_id.match(suffixPattern);
    if (!match) {
      continue;
    }
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) {
      maxSuffix = Math.max(maxSuffix, parsed);
    }
  }

  const nextSuffix = String(maxSuffix + 1).padStart(4, "0");
  return `${areaCode}-${nextSuffix}`;
}

export async function createAccountAction(
  _prevState: CreateAccountState,
  formData: FormData,
): Promise<CreateAccountState> {
  const accountCategory = getTrimmed(formData, "account_category") as AccountCategory;
  const roleIdRaw = getTrimmed(formData, "role_id");
  const firstName = getTrimmed(formData, "first_name");
  const middleName = getTrimmed(formData, "middle_name");
  const lastName = getTrimmed(formData, "last_name");
  const contactNumberRaw = getTrimmed(formData, "contact_number");
  const contactNumber = contactNumberRaw.replace(/\D/g, "");
  const address = getTrimmed(formData, "address");
  const branchIdRaw = getTrimmed(formData, "branch_id");
  const areaIdRaw = getTrimmed(formData, "area_id");
  const branchIds = formData
    .getAll("branch_ids")
    .map((value) => String(value).trim())
    .filter(Boolean);

  const fieldErrors: ActionFieldErrors = {};
  const roleId = toInt(roleIdRaw);
  const branchId = toInt(branchIdRaw);
  const areaId = toInt(areaIdRaw);

  if (accountCategory !== "Employee" && accountCategory !== "Borrower") {
    fieldErrors.account_category = "Invalid account category.";
  }
  if (!roleId) {
    fieldErrors.role_id = "Role is required.";
  }
  if (!firstName) {
    fieldErrors.first_name = "First name is required.";
  }
  if (!lastName) {
    fieldErrors.last_name = "Last name is required.";
  }

  if (accountCategory === "Borrower") {
    if (!branchId) {
      fieldErrors.branch_id = "Branch is required for borrowers.";
    }
    if (!areaId) {
      fieldErrors.area_id = "Area is required for borrowers.";
    }
    if (!contactNumber) {
      fieldErrors.contact_number = "Contact number is required for borrowers.";
    } else if (contactNumber.length > 11) {
      fieldErrors.contact_number = "Contact number must be at most 11 digits.";
    }
    if (!address) {
      fieldErrors.address = "Address is required for borrowers.";
    }
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
      message: "Only Admin users can create accounts.",
    };
  }

  const selectedRole = await db
    .select({
      role_id: roles.role_id,
      role_name: roles.role_name,
    })
    .from(roles)
    .where(eq(roles.role_id, roleId!))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!selectedRole) {
    return {
      status: "error",
      message: "Selected role was not found.",
    };
  }

  const isEmployeeRole = EMPLOYEE_ROLE_NAMES.includes(
    selectedRole.role_name as (typeof EMPLOYEE_ROLE_NAMES)[number],
  );
  const isBorrowerRole = selectedRole.role_name === BORROWER_ROLE_NAME;

  if (accountCategory === "Employee" && !isEmployeeRole) {
    return {
      status: "error",
      message: "Selected role is not valid for Employee category.",
    };
  }

  if (accountCategory === "Borrower" && !isBorrowerRole) {
    return {
      status: "error",
      message: "Selected role is not valid for Borrower category.",
    };
  }

  const isAuditorRole = selectedRole.role_name === AUDITOR_ROLE_NAME;
  const isCollectorRole = selectedRole.role_name === COLLECTOR_ROLE_NAME;
  const branchRequired = BRANCH_REQUIRED_ROLE_NAMES.includes(selectedRole.role_name);

  let selectedSingleBranch: { branch_id: number; branch_name: string } | null = null;
  let selectedBranches: { branch_id: number; branch_name: string }[] = [];
  let selectedArea: {
    area_id: number;
    branch_id: number;
    area_code: string;
    area_no: string;
  } | null = null;

  if (accountCategory === "Borrower" || (accountCategory === "Employee" && isCollectorRole)) {
    if (!branchId) {
      return {
        status: "error",
        message: "Selected branch was not found.",
        fieldErrors: {
          branch_id: "Please select a branch.",
        },
      };
    }

    const branchRow = await db
      .select({
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
      })
      .from(branch)
      .where(eq(branch.branch_id, branchId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null);

    if (!branchRow) {
      return {
        status: "error",
        message: "Selected branch was not found.",
      };
    }

    selectedSingleBranch = branchRow;
    selectedBranches = [branchRow];

    if (!areaId) {
      return {
        status: "error",
        message: "Selected area was not found.",
        fieldErrors: {
          area_id: "Please select an area.",
        },
      };
    }

    const areaRow = await db
      .select({
        area_id: areas.area_id,
        branch_id: areas.branch_id,
        area_code: areas.area_code,
        area_no: areas.area_no,
      })
      .from(areas)
      .where(and(eq(areas.area_id, areaId), eq(areas.branch_id, branchId)))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null);

    if (!areaRow) {
      return {
        status: "error",
        message: "Selected area was not found.",
      };
    }

    selectedArea = areaRow;
  }

  if (accountCategory === "Employee" && isAuditorRole) {
    if (branchIds.length === 0) {
      return {
        status: "error",
        message: "Auditor accounts must have at least one branch assignment.",
        fieldErrors: {
          branch_ids: "Please select at least one branch.",
        },
      };
    }

    const uniqueBranchIds = Array.from(new Set(branchIds))
      .map((id) => toInt(id))
      .filter((id): id is number => Number.isFinite(id));

    const branchRows = uniqueBranchIds.length
      ? await db
          .select({
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
          })
          .from(branch)
          .where(inArray(branch.branch_id, uniqueBranchIds))
          .catch(() => [])
      : [];

    if (branchRows.length !== uniqueBranchIds.length) {
      return {
        status: "error",
        message: "One or more selected branches were not found.",
      };
    }

    selectedBranches = branchRows;
  }

  if (accountCategory === "Employee" && !isAuditorRole && !isCollectorRole && branchId) {
    const branchRow = await db
      .select({
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
      })
      .from(branch)
      .where(eq(branch.branch_id, branchId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null);

    if (!branchRow) {
      return {
        status: "error",
        message: "Selected branch was not found.",
      };
    }

    selectedSingleBranch = branchRow;
    selectedBranches = [branchRow];
  }

  if (accountCategory === "Employee" && branchRequired && !selectedSingleBranch) {
    return {
      status: "error",
      message: "A branch assignment is required for this role.",
      fieldErrors: {
        branch_id: "Please select a branch.",
      },
    };
  }

  const companyId =
    accountCategory === "Borrower"
      ? await generateNextBorrowerCompanyId(selectedArea!.area_id, selectedArea!.area_code)
      : await generateNextEmployeeCompanyId();
  const username = companyId;

  const temporaryPassword = generateTemporaryPassword();
  const adminClient = createAdminClient();
  const provisionalEmail = `pending-${randomUUID()}@sumtrack.local`;

  const { data: createdAuthData, error: createAuthError } = await adminClient.auth.admin.createUser({
    email: provisionalEmail,
    password: temporaryPassword,
    email_confirm: true,
  });

  if (createAuthError || !createdAuthData.user?.id) {
    return {
      status: "error",
      message: `Unable to create auth account: ${createAuthError?.message ?? "Unknown error."}`,
    };
  }

  const createdUserId = createdAuthData.user.id;
  const internalEmail = `${createdUserId}@sumtrack.local`;

  const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(createdUserId, {
    email: internalEmail,
    email_confirm: true,
  });

  if (updateAuthError) {
    await deleteAuthUserSafely(createdUserId);
    return {
      status: "error",
      message: `Auth user was created, but setting internal email failed: ${updateAuthError.message}`,
    };
  }

  try {
    await db.insert(users).values({
      user_id: createdUserId,
      company_id: companyId,
      username,
      role_id: selectedRole.role_id,
    });
  } catch (error) {
    await deleteAuthUserSafely(createdUserId);
    return {
      status: "error",
      message: `Failed inserting into users: ${getErrorMessage(error)}`,
    };
  }

  if (accountCategory === "Employee") {
    try {
      await db.insert(employee_info).values({
        user_id: createdUserId,
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
      });
    } catch (error) {
      await deleteAuthUserSafely(createdUserId);
      return {
        status: "error",
        message: `Failed inserting into employee_info: ${getErrorMessage(error)}`,
      };
    }

    if (isCollectorRole) {
      const startDate = new Date().toISOString().slice(0, 10);
      try {
        await db.insert(employee_area_assignment).values({
          employee_user_id: createdUserId,
          area_id: selectedArea!.area_id,
          start_date: startDate,
          end_date: null,
        });
      } catch (error) {
        await deleteAuthUserSafely(createdUserId);
        return {
          status: "error",
          message: `Failed inserting area assignment: ${getErrorMessage(error)}`,
        };
      }
    } else if (selectedBranches.length > 0) {
      const startDate = new Date().toISOString().slice(0, 10);
      try {
        await db.insert(employee_branch_assignment).values(
          selectedBranches.map((item) => ({
            employee_user_id: createdUserId,
            branch_id: item.branch_id,
            start_date: startDate,
            end_date: null,
          })),
        );
      } catch (error) {
        await deleteAuthUserSafely(createdUserId);
        return {
          status: "error",
          message: `Failed inserting branch assignment: ${getErrorMessage(error)}`,
        };
      }
    }
  } else {
    try {
      await db.insert(borrower_info).values({
        user_id: createdUserId,
        first_name: firstName,
        middle_name: middleName || null,
        last_name: lastName,
        contact_number: contactNumber,
        address,
        area_id: selectedArea!.area_id,
      });
    } catch (error) {
      await deleteAuthUserSafely(createdUserId);
      return {
        status: "error",
        message: `Failed inserting into borrower_info: ${getErrorMessage(error)}`,
      };
    }
  }

  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

  return {
    status: "success",
    message: "Account created successfully.",
    result: {
      accountCategory,
      companyId,
      fullName,
      username,
      role: selectedRole.role_name,
      userId: createdUserId,
      temporaryPassword,
      assignedBranches: isAuditorRole ? selectedBranches.map((item) => item.branch_name) : [],
      assignedBranch: selectedSingleBranch?.branch_name,
      assignedArea: selectedArea?.area_code,
      contactNumber: accountCategory === "Borrower" ? contactNumber : undefined,
      address: accountCategory === "Borrower" ? address : undefined,
    },
  };
}
