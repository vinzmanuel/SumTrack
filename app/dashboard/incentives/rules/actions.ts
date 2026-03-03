"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { branch, employee_branch_assignment, incentive_rules, roles, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import type { IncentiveRuleFormState } from "@/app/dashboard/incentives/rules/state";

type FormFields = {
  branch_id: string;
  role_id: string;
  percent_value: string;
  flat_amount: string;
};

type ActionFieldErrors = Partial<Record<keyof FormFields, string>>;

const ADMIN_MANAGEABLE_ROLES = ["Branch Manager", "Secretary", "Collector"] as const;
const BRANCH_MANAGER_MANAGEABLE_ROLES = ["Secretary", "Collector"] as const;

function getTrimmed(formData: FormData, key: keyof FormFields) {
  return String(formData.get(key) ?? "").trim();
}

function toInt(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

function parseNonNegative(value: string) {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

export async function upsertIncentiveRuleAction(
  _prevState: IncentiveRuleFormState,
  formData: FormData,
): Promise<IncentiveRuleFormState> {
  const branchIdRaw = getTrimmed(formData, "branch_id");
  const roleIdRaw = getTrimmed(formData, "role_id");
  const percentValueRaw = getTrimmed(formData, "percent_value");
  const flatAmountRaw = getTrimmed(formData, "flat_amount");

  const fieldErrors: ActionFieldErrors = {};
  const requestedBranchId = toInt(branchIdRaw);
  const requestedRoleId = toInt(roleIdRaw);
  const percentValue = parseNonNegative(percentValueRaw);
  const flatAmount = parseNonNegative(flatAmountRaw);

  if (!requestedRoleId) {
    fieldErrors.role_id = "Role is required.";
  }

  if (percentValue === null) {
    fieldErrors.percent_value = "Percent value must be greater than or equal to 0.";
  }

  if (flatAmount === null) {
    fieldErrors.flat_amount = "Flat amount must be greater than or equal to 0.";
  }

  if (percentValue !== null && flatAmount !== null && percentValue === 0 && flatAmount === 0) {
    fieldErrors.percent_value = "Percent value and flat amount cannot both be 0.";
    fieldErrors.flat_amount = "Percent value and flat amount cannot both be 0.";
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

  const isAdmin = currentRole?.role_name === "Admin";
  const isBranchManager = currentRole?.role_name === "Branch Manager";

  if (!isAdmin && !isBranchManager) {
    return {
      status: "error",
      message: "Only Admin and Branch Manager users can manage incentive rules.",
    };
  }

  let resolvedBranchId: number | null = null;

  if (isAdmin) {
    if (!requestedBranchId) {
      fieldErrors.branch_id = "Branch is required.";
    } else {
      resolvedBranchId = requestedBranchId;
    }
  }

  if (isBranchManager) {
    const activeAssignments = await db
      .select({
        branch_id: employee_branch_assignment.branch_id,
      })
      .from(employee_branch_assignment)
      .where(
        and(
          eq(employee_branch_assignment.employee_user_id, currentAuthUser.id),
          isNull(employee_branch_assignment.end_date),
        ),
      )
      .catch(() => []);

    if (activeAssignments.length === 0) {
      return {
        status: "error",
        message: "No active branch assignment found for your account.",
      };
    }

    const uniqueBranchIds = Array.from(new Set(activeAssignments.map((assignment) => assignment.branch_id)));

    if (uniqueBranchIds.length !== 1) {
      return {
        status: "error",
        message: "Unable to resolve a single active branch assignment.",
      };
    }

    resolvedBranchId = uniqueBranchIds[0];

    if (requestedBranchId !== null && requestedBranchId !== resolvedBranchId) {
      return {
        status: "error",
        message: "You can only manage incentive rules for your assigned branch.",
      };
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const resolvedRole = await db
    .select({
      role_id: roles.role_id,
      role_name: roles.role_name,
    })
    .from(roles)
    .where(eq(roles.role_id, requestedRoleId!))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!resolvedRole) {
    return {
      status: "error",
      message: "Selected role was not found.",
    };
  }

  if (isAdmin && !ADMIN_MANAGEABLE_ROLES.includes(resolvedRole.role_name as (typeof ADMIN_MANAGEABLE_ROLES)[number])) {
    return {
      status: "error",
      message: "Admin can only manage Branch Manager, Secretary, and Collector incentive rules.",
    };
  }

  if (
    isBranchManager &&
    !BRANCH_MANAGER_MANAGEABLE_ROLES.includes(
      resolvedRole.role_name as (typeof BRANCH_MANAGER_MANAGEABLE_ROLES)[number],
    )
  ) {
    return {
      status: "error",
      message: "Branch Manager can only manage Secretary and Collector incentive rules.",
    };
  }

  const branchRow = await db
    .select({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
    })
    .from(branch)
    .where(eq(branch.branch_id, resolvedBranchId!))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!branchRow) {
    return {
      status: "error",
      message: "Resolved branch was not found.",
    };
  }

  const existingRules = await db
    .select({ rule_id: incentive_rules.rule_id })
    .from(incentive_rules)
    .where(
      and(
        eq(incentive_rules.branch_id, branchRow.branch_id),
        eq(incentive_rules.role_id, resolvedRole.role_id),
      ),
    )
    .catch(() => []);

  let mode: "created" | "updated" = "created";

  if (existingRules.length > 0) {
    mode = "updated";
    const existingRuleIds = existingRules.map((rule) => rule.rule_id);

    await db
      .update(incentive_rules)
      .set({
        percent_value: String(percentValue!),
        flat_amount: String(flatAmount!),
      })
      .where(inArray(incentive_rules.rule_id, existingRuleIds))
      .catch(() => null);
  } else {
    await db
      .insert(incentive_rules)
      .values({
        branch_id: branchRow.branch_id,
        role_id: resolvedRole.role_id,
        percent_value: String(percentValue!),
        flat_amount: String(flatAmount!),
      })
      .catch(() => null);
  }

  const savedRule = await db
    .select({
      rule_id: incentive_rules.rule_id,
    })
    .from(incentive_rules)
    .where(
      and(
        eq(incentive_rules.branch_id, branchRow.branch_id),
        eq(incentive_rules.role_id, resolvedRole.role_id),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!savedRule?.rule_id) {
    return {
      status: "error",
      message: "Failed to save incentive rule.",
    };
  }

  return {
    status: "success",
    message: mode === "created" ? "Incentive rule created." : "Incentive rule updated.",
    result: {
      mode,
      branchName: branchRow.branch_name,
      roleName: resolvedRole.role_name,
      percentValue: percentValue!,
      flatAmount: flatAmount!,
    },
  };
}
