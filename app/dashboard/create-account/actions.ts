"use server";

import { randomInt, randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CreateAccountState } from "@/app/dashboard/create-account/state";

type AccountCategory = "Employee" | "Borrower";

type FormFields = {
  account_category: AccountCategory;
  role_id: string;
  first_name: string;
  last_name: string;
  contact_number: string;
  address: string;
  branch_id: string;
  branch_ids: string;
};

type RoleRow = {
  role_id: string;
  role_name: string;
};

type BranchRow = {
  branch_id: string;
  branch_name: string;
};

type AppUserRow = {
  role_id: string | null;
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
const BORROWER_ROLE_NAME = "Borrower";
const BRANCH_REQUIRED_ROLE_NAMES = ["Branch Manager", "Secretary", "Collector"];

function getTrimmed(formData: FormData, key: keyof FormFields) {
  return String(formData.get(key) ?? "").trim();
}

function toDbId(value: string) {
  return /^\d+$/.test(value) ? Number(value) : value;
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
  const remaining = Array.from({ length: remainingLength }, () => {
    return allChars[randomInt(allChars.length)];
  });

  const mixed = [...required, ...remaining];
  for (let i = mixed.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
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

export async function createAccountAction(
  _prevState: CreateAccountState,
  formData: FormData,
): Promise<CreateAccountState> {
  const accountCategory = getTrimmed(formData, "account_category") as AccountCategory;
  const roleId = getTrimmed(formData, "role_id");
  const firstName = getTrimmed(formData, "first_name");
  const lastName = getTrimmed(formData, "last_name");
  const contactNumberRaw = getTrimmed(formData, "contact_number");
  const contactNumber = contactNumberRaw.replace(/\D/g, "");
  const address = getTrimmed(formData, "address");
  const branchId = getTrimmed(formData, "branch_id");
  const branchIds = formData
    .getAll("branch_ids")
    .map((value) => String(value).trim())
    .filter(Boolean);

  const fieldErrors: ActionFieldErrors = {};

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
      message: "Only Admin users can create accounts.",
    };
  }

  const { data: selectedRole, error: selectedRoleError } = await supabase
    .from("roles")
    .select("role_id, role_name")
    .eq("role_id", toDbId(roleId))
    .maybeSingle<RoleRow>();

  if (selectedRoleError || !selectedRole) {
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
  const branchRequired = BRANCH_REQUIRED_ROLE_NAMES.includes(selectedRole.role_name);
  let selectedBranch: BranchRow | null = null;
  let selectedBranches: BranchRow[] = [];

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

    const uniqueBranchIds = Array.from(new Set(branchIds));
    const { data: branchRows, error: branchRowsError } = await supabase
      .from("branch")
      .select("branch_id, branch_name")
      .in(
        "branch_id",
        uniqueBranchIds.map((id) => toDbId(id)),
      );

    if (branchRowsError || !branchRows || branchRows.length !== uniqueBranchIds.length) {
      return {
        status: "error",
        message: "One or more selected branches were not found.",
      };
    }

    selectedBranches = branchRows as BranchRow[];
  }

  if (accountCategory === "Employee" && !isAuditorRole && branchId) {
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
    selectedBranch = branch;
    selectedBranches = [branch];
  }

  if (accountCategory === "Employee" && branchRequired && !selectedBranch) {
    return {
      status: "error",
      message: "A branch assignment is required for this role.",
      fieldErrors: {
        branch_id: "Please select a branch.",
      },
    };
  }

  const temporaryPassword = generateTemporaryPassword();
  const adminClient = createAdminClient();
  const provisionalEmail = `pending-${randomUUID()}@sumtrack.local`;

  const { data: createdAuthData, error: createAuthError } =
    await adminClient.auth.admin.createUser({
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

  const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
    createdUserId,
    {
      email: internalEmail,
      email_confirm: true,
    },
  );

  if (updateAuthError) {
    await deleteAuthUserSafely(createdUserId);
    return {
      status: "error",
      message: `Auth user was created, but setting internal email failed: ${updateAuthError.message}`,
    };
  }

  const { error: usersInsertError } = await supabase.from("users").insert({
    user_id: createdUserId,
    username: createdUserId,
    role_id: selectedRole.role_id,
  });

  if (usersInsertError) {
    await deleteAuthUserSafely(createdUserId);
    return {
      status: "error",
      message: `Failed inserting into users: ${usersInsertError.message}`,
    };
  }

  if (accountCategory === "Employee") {
    const { error: employeeInsertError } = await supabase.from("employee_info").insert({
      user_id: createdUserId,
      first_name: firstName,
      last_name: lastName,
    });

    if (employeeInsertError) {
      await deleteAuthUserSafely(createdUserId);
      return {
        status: "error",
        message: `Failed inserting into employee_info: ${employeeInsertError.message}`,
      };
    }

    if (selectedBranches.length > 0) {
      const startDate = new Date().toISOString().slice(0, 10);
      const { error: assignmentError } = await supabase
        .from("employee_branch_assignment")
        .insert(
          selectedBranches.map((branch) => ({
            employee_user_id: createdUserId,
            branch_id: branch.branch_id,
            start_date: startDate,
            end_date: null,
          })),
        );

      if (assignmentError) {
        await deleteAuthUserSafely(createdUserId);
        return {
          status: "error",
          message: `Failed inserting branch assignment: ${assignmentError.message}`,
        };
      }
    }
  } else {
    const { error: borrowerInsertError } = await supabase.from("borrower_info").insert({
      user_id: createdUserId,
      first_name: firstName,
      last_name: lastName,
      contact_number: contactNumber,
      address,
    });

    if (borrowerInsertError) {
      await deleteAuthUserSafely(createdUserId);
      return {
        status: "error",
        message: `Failed inserting into borrower_info: ${borrowerInsertError.message}`,
      };
    }
  }

  return {
    status: "success",
    message: "Account created successfully.",
    result: {
      accountCategory,
      fullName: `${firstName} ${lastName}`.trim(),
      username: createdUserId,
      role: selectedRole.role_name,
      userId: createdUserId,
      temporaryPassword,
      assignedBranches: selectedBranches.map((branch) => branch.branch_name),
      contactNumber: accountCategory === "Borrower" ? contactNumber : undefined,
      address: accountCategory === "Borrower" ? address : undefined,
    },
  };
}
