import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import type {
  CreateAccountResolution,
  CreatorAccess,
  ParsedCreateAccountInput,
  ResolvedCreateAccountScope,
  SelectedRoleContext,
} from "@/app/dashboard/create-account/action-types";
import {
  AUDITOR_ROLE_NAME,
  BORROWER_ROLE_NAME,
  BRANCH_REQUIRED_ROLE_NAMES,
  COLLECTOR_ROLE_NAME,
  EMPLOYEE_ROLE_NAMES,
} from "@/app/dashboard/create-account/action-types";
import { createErrorState, toInt } from "@/app/dashboard/create-account/action-validation";
import { db } from "@/db";
import { canCreateAdminAccounts, isSuperAdmin } from "@/lib/auth/superadmin";
import {
  areas,
  branch,
  employee_branch_assignment,
  roles,
  users,
} from "@/db/schema";

async function hasActiveSingleBranchRoleAssignment(roleName: "Branch Manager", branchId: number) {
  return db
    .select({ userId: users.user_id })
    .from(employee_branch_assignment)
    .innerJoin(users, eq(users.user_id, employee_branch_assignment.employee_user_id))
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .where(
      and(
        eq(employee_branch_assignment.branch_id, branchId),
        isNull(employee_branch_assignment.end_date),
        eq(users.status, "active"),
        eq(roles.role_name, roleName),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);
}

async function findActiveAuditorConflicts(branchIds: number[]) {
  if (branchIds.length === 0) {
    return [];
  }

  return db
    .select({
      branchId: employee_branch_assignment.branch_id,
      branchName: branch.branch_name,
      branchCode: branch.branch_code,
    })
    .from(employee_branch_assignment)
    .innerJoin(users, eq(users.user_id, employee_branch_assignment.employee_user_id))
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .innerJoin(branch, eq(branch.branch_id, employee_branch_assignment.branch_id))
    .where(
      and(
        inArray(employee_branch_assignment.branch_id, branchIds),
        isNull(employee_branch_assignment.end_date),
        eq(users.status, "active"),
        eq(roles.role_name, AUDITOR_ROLE_NAME),
      ),
    )
    .catch(() => []);
}

export async function resolveCreateAccountCreatorAccess(): Promise<CreateAccountResolution<CreatorAccess>> {
  const auth = await getDashboardAuthContext();
  if (!auth.ok) {
    return {
      ok: false,
      state: createErrorState(
        auth.reason === "unauthenticated" ? "You must be logged in." : "Unable to verify your app account.",
      ),
    };
  }

  const isAdmin = auth.roleName === "Admin";
  const isBranchManager = auth.roleName === "Branch Manager";
  const isSecretaryCreator = auth.roleName === "Secretary";

  if (!isAdmin && !isBranchManager && !isSecretaryCreator) {
    return {
      ok: false,
      state: createErrorState("Only Admin, Branch Manager, and Secretary users can create accounts."),
    };
  }

  if (!isAdmin && !auth.activeBranchId) {
    return {
      ok: false,
      state: createErrorState("A single active branch assignment is required before creating accounts."),
    };
  }

  return {
    ok: true,
    data: {
      userId: auth.userId,
      companyId: auth.companyId,
      displayName: auth.displayName,
      roleName: auth.roleName as CreatorAccess["roleName"],
      isAdmin,
      isSuperAdmin: isSuperAdmin(auth.userId),
      isBranchManager,
      isSecretaryCreator,
      allowedSingleBranchId: isAdmin ? null : auth.activeBranchId,
    },
  };
}

export async function resolveSelectedRoleContext(
  input: ParsedCreateAccountInput,
  creator: CreatorAccess,
): Promise<CreateAccountResolution<SelectedRoleContext>> {
  if (creator.isSecretaryCreator && input.accountCategory !== "Borrower") {
    return {
      ok: false,
      state: createErrorState("Secretary can only create borrower accounts."),
    };
  }

  const selectedRole = await db
    .select({
      role_id: roles.role_id,
      role_name: roles.role_name,
    })
    .from(roles)
    .where(eq(roles.role_id, input.roleId!))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!selectedRole) {
    return {
      ok: false,
      state: createErrorState("Selected role was not found."),
    };
  }

  const isEmployeeRole = EMPLOYEE_ROLE_NAMES.includes(
    selectedRole.role_name as (typeof EMPLOYEE_ROLE_NAMES)[number],
  );
  const isBorrowerRole = selectedRole.role_name === BORROWER_ROLE_NAME;

  if (input.accountCategory === "Employee" && !isEmployeeRole) {
    return {
      ok: false,
      state: createErrorState("Selected role is not valid for Employee category."),
    };
  }

  if (input.accountCategory === "Borrower" && !isBorrowerRole) {
    return {
      ok: false,
      state: createErrorState("Selected role is not valid for Borrower category."),
    };
  }

  if (creator.isBranchManager && input.accountCategory === "Employee") {
    const allowedBranchManagerEmployeeRoles = ["Secretary", "Collector"];
    if (!allowedBranchManagerEmployeeRoles.includes(selectedRole.role_name)) {
      return {
        ok: false,
        state: createErrorState("Branch Manager can only create Secretary and Collector employee accounts."),
      };
    }
  }

  if (selectedRole.role_name === "Admin" && !canCreateAdminAccounts(creator.userId)) {
    return {
      ok: false,
      state: createErrorState("Only the Superadmin can create Admin accounts."),
    };
  }

  return {
    ok: true,
    data: {
      roleId: selectedRole.role_id,
      roleName: selectedRole.role_name,
      isAuditorRole: selectedRole.role_name === AUDITOR_ROLE_NAME,
      isCollectorRole: selectedRole.role_name === COLLECTOR_ROLE_NAME,
      branchRequired: BRANCH_REQUIRED_ROLE_NAMES.includes(selectedRole.role_name),
    },
  };
}

async function resolveBranchSelection(
  branchId: number,
  creator: CreatorAccess,
): Promise<CreateAccountResolution<{ branch_id: number; branch_name: string }>> {
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
      ok: false,
      state: createErrorState("Selected branch was not found."),
    };
  }

  const activeBranch = await db
    .select({ branch_id: branch.branch_id })
    .from(branch)
    .where(and(eq(branch.branch_id, branchId), eq(branch.status, "active")))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!activeBranch) {
    return {
      ok: false,
      state: createErrorState("Selected branch is inactive and cannot accept new accounts."),
    };
  }

  if (!creator.isAdmin && creator.allowedSingleBranchId !== null && branchRow.branch_id !== creator.allowedSingleBranchId) {
    return {
      ok: false,
      state: createErrorState("You can only create accounts within your assigned branch."),
    };
  }

  return {
    ok: true,
    data: branchRow,
  };
}

export async function resolveCreateAccountScope(
  input: ParsedCreateAccountInput,
  creator: CreatorAccess,
  selectedRole: SelectedRoleContext,
): Promise<CreateAccountResolution<ResolvedCreateAccountScope>> {
  let selectedSingleBranch: ResolvedCreateAccountScope["selectedSingleBranch"] = null;
  let selectedBranches: ResolvedCreateAccountScope["selectedBranches"] = [];
  let selectedArea: ResolvedCreateAccountScope["selectedArea"] = null;

  if (input.accountCategory === "Borrower" || (input.accountCategory === "Employee" && selectedRole.isCollectorRole)) {
    if (!input.branchId) {
      return {
        ok: false,
        state: createErrorState("Selected branch was not found.", {
          branch_id: "Please select a branch.",
        }),
      };
    }

    const branchResolution = await resolveBranchSelection(input.branchId, creator);
    if (!branchResolution.ok) {
      return branchResolution;
    }

    selectedSingleBranch = branchResolution.data;
    selectedBranches = [branchResolution.data];

    if (!input.areaId) {
      return {
        ok: false,
        state: createErrorState("Selected area was not found.", {
          area_id: "Please select an area.",
        }),
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
      .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
      .where(
        and(
          eq(areas.area_id, input.areaId),
          eq(areas.branch_id, input.branchId),
          eq(branch.status, "active"),
          eq(areas.status, "active"),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null);

    if (!areaRow) {
      return {
        ok: false,
        state: createErrorState("Selected area was not found."),
      };
    }

    selectedArea = areaRow;
  }

  if (input.accountCategory === "Employee" && selectedRole.isAuditorRole) {
    if (!creator.isAdmin) {
      return {
        ok: false,
        state: createErrorState("Only Admin can create Auditor accounts."),
      };
    }

    if (input.branchIds.length === 0) {
      return {
        ok: false,
        state: createErrorState("Auditor accounts must have at least one branch assignment.", {
          branch_ids: "Please select at least one branch.",
        }),
      };
    }

    const uniqueBranchIds = Array.from(new Set(input.branchIds))
      .map((id) => toInt(id))
      .filter((id): id is number => Number.isFinite(id));

    const branchRows = uniqueBranchIds.length
      ? await db
          .select({
            branch_id: branch.branch_id,
            branch_name: branch.branch_name,
          })
          .from(branch)
          .where(and(inArray(branch.branch_id, uniqueBranchIds), eq(branch.status, "active")))
          .catch(() => [])
      : [];

    if (branchRows.length !== uniqueBranchIds.length) {
      return {
        ok: false,
        state: createErrorState("One or more selected branches are inactive or were not found."),
      };
    }

    const conflictingAuditorAssignments = await findActiveAuditorConflicts(uniqueBranchIds);
    if (conflictingAuditorAssignments.length > 0) {
      const branchLabel = conflictingAuditorAssignments
        .map((item) => item.branchCode || item.branchName)
        .join(", ");

      return {
        ok: false,
        state: createErrorState(
          `Each branch can only have one Auditor. Resolve the existing Auditor assignment for ${branchLabel} first.`,
          {
            branch_ids: "One or more selected branches already have an active auditor assigned.",
          },
        ),
      };
    }

    selectedBranches = branchRows;
  }

  if (input.accountCategory === "Employee" && !selectedRole.isAuditorRole && !selectedRole.isCollectorRole && input.branchId) {
    const branchResolution = await resolveBranchSelection(input.branchId, creator);
    if (!branchResolution.ok) {
      return branchResolution;
    }

    selectedSingleBranch = branchResolution.data;
    selectedBranches = [branchResolution.data];
  }

  if (input.accountCategory === "Employee" && selectedRole.branchRequired && !selectedSingleBranch) {
    return {
      ok: false,
      state: createErrorState("A branch assignment is required for this role.", {
        branch_id: "Please select a branch.",
      }),
    };
  }

  if (input.accountCategory === "Employee" && selectedRole.roleName === "Branch Manager" && selectedSingleBranch) {
    const existingBranchManager = await hasActiveSingleBranchRoleAssignment(
      "Branch Manager",
      selectedSingleBranch.branch_id,
    );

    if (existingBranchManager) {
      return {
        ok: false,
        state: createErrorState("Each branch can only have one Branch Manager.", {
          branch_id: "This branch already has an active branch manager assigned.",
        }),
      };
    }
  }

  return {
    ok: true,
    data: {
      selectedSingleBranch,
      selectedBranches,
      selectedArea,
    },
  };
}
