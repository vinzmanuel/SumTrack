"use server";

import type { CreateAccountState } from "@/app/dashboard/create-account/state";
import { resolveCreateAccountCreatorAccess, resolveCreateAccountScope, resolveSelectedRoleContext } from "@/app/dashboard/create-account/action-access";
import {
  deleteAuthUserSafely,
  generateNextBorrowerCompanyId,
  generateNextEmployeeCompanyId,
  provisionAuthAccount,
} from "@/app/dashboard/create-account/action-identifiers";
import type { ParsedCreateAccountInput, ResolvedCreateAccountScope, SelectedRoleContext } from "@/app/dashboard/create-account/action-types";
import { persistCreateAccountRecords } from "@/app/dashboard/create-account/action-persistence";
import { createErrorState, parseCreateAccountForm, validateCreateAccountInput } from "@/app/dashboard/create-account/action-validation";
import { isValidPhilippineMobile } from "@/app/dashboard/account-field-validation";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { logAuditEvents } from "@/lib/audit/logger";

async function resolveCompanyId(
  input: ParsedCreateAccountInput,
  resolvedScope: ResolvedCreateAccountScope,
) {
  return input.accountCategory === "Borrower"
    ? generateNextBorrowerCompanyId(resolvedScope.selectedArea!.area_id, resolvedScope.selectedArea!.area_code)
    : generateNextEmployeeCompanyId();
}

function buildSuccessState(params: {
  input: ParsedCreateAccountInput;
  selectedRole: SelectedRoleContext;
  resolvedScope: ResolvedCreateAccountScope;
  companyId: string;
  userId: string;
  temporaryPassword: string;
}): CreateAccountState {
  const fullName = [params.input.firstName, params.input.middleName, params.input.lastName].filter(Boolean).join(" ");

  return {
    status: "success",
    message: "Account created successfully.",
    result: {
      accountCategory: params.input.accountCategory,
      companyId: params.companyId,
      fullName,
      username: params.companyId,
      role: params.selectedRole.roleName,
      userId: params.userId,
      temporaryPassword: params.temporaryPassword,
      assignedBranches: params.selectedRole.isAuditorRole
        ? params.resolvedScope.selectedBranches.map((item) => item.branch_name)
        : [],
      assignedBranch: params.resolvedScope.selectedSingleBranch?.branch_name,
      assignedArea: params.resolvedScope.selectedArea?.area_code,
      contactNo: params.input.contactNo || undefined,
      email: params.input.email || undefined,
      status: "active",
      address: params.input.accountCategory === "Borrower" ? params.input.address : undefined,
    },
  };
}

export async function createAccountAction(
  _prevState: CreateAccountState,
  formData: FormData,
): Promise<CreateAccountState> {
  const input = parseCreateAccountForm(formData);
  const fieldErrors = validateCreateAccountInput(input);

  if (Object.keys(fieldErrors).length > 0) {
    return createErrorState("Please fix the highlighted fields.", fieldErrors);
  }

  const creatorAccess = await resolveCreateAccountCreatorAccess();
  if (!creatorAccess.ok) {
    return creatorAccess.state;
  }

  const selectedRole = await resolveSelectedRoleContext(input, creatorAccess.data);
  if (!selectedRole.ok) {
    return selectedRole.state;
  }

  if (
    (input.accountCategory === "Borrower" || selectedRole.data.isCollectorRole) &&
    !input.contactNo
  ) {
    return createErrorState("Please fix the highlighted fields.", {
      contact_no: "Contact number is required for this role.",
    });
  }

  if (input.contactNo && !isValidPhilippineMobile(input.contactNo)) {
    return createErrorState("Please fix the highlighted fields.", {
      contact_no: "Enter a valid PH mobile number starting with 09.",
    });
  }

  const resolvedScope = await resolveCreateAccountScope(input, creatorAccess.data, selectedRole.data);
  if (!resolvedScope.ok) {
    return resolvedScope.state;
  }

  const companyId = await resolveCompanyId(input, resolvedScope.data);
  const authProvision = await provisionAuthAccount();
  if (!authProvision.ok) {
    return authProvision.state;
  }

  const persistence = await persistCreateAccountRecords({
    userId: authProvision.data.userId,
    companyId,
    username: companyId,
    creatorUserId: creatorAccess.data.userId,
    input,
    selectedRole: selectedRole.data,
    resolvedScope: resolvedScope.data,
  });

  if (!persistence.ok) {
    await deleteAuthUserSafely(authProvision.data.userId);
    return createErrorState(persistence.message);
  }

  const requestContext = await getAuditRequestContext();
  const fullName = [input.firstName, input.middleName, input.lastName].filter(Boolean).join(" ");
  const branchScope =
    resolvedScope.data.selectedBranches.length > 0
      ? resolvedScope.data.selectedBranches.map((item) => item.branch_id)
      : resolvedScope.data.selectedSingleBranch
        ? [resolvedScope.data.selectedSingleBranch.branch_id]
        : resolvedScope.data.selectedArea
          ? [resolvedScope.data.selectedArea.branch_id]
          : [];

  await logAuditEvents([
    {
      action: "user.created",
      entityType: "user",
      entityId: authProvision.data.userId,
      actor: {
        type: "user",
        userId: creatorAccess.data.userId,
        companyId: creatorAccess.data.companyId,
        displayName: creatorAccess.data.displayName,
        roleName: creatorAccess.data.roleName,
      },
      target: {
        userId: authProvision.data.userId,
        companyId,
        displayName: fullName,
      },
      branchId: resolvedScope.data.selectedSingleBranch?.branch_id ?? resolvedScope.data.selectedArea?.branch_id ?? null,
      branchScope,
      description: `Created ${selectedRole.data.roleName} account for ${fullName}.`,
      requestContext,
      metadata: {
        accountCategory: input.accountCategory,
        roleName: selectedRole.data.roleName,
        branchIds: branchScope,
        areaId: resolvedScope.data.selectedArea?.area_id ?? null,
        areaCode: resolvedScope.data.selectedArea?.area_code ?? null,
      },
    },
    ...(resolvedScope.data.selectedBranches.length > 0
      ? resolvedScope.data.selectedBranches.map((item) => ({
          action: "assignment.branch_started" as const,
          entityType: "assignment" as const,
          entityId: authProvision.data.userId,
          actor: {
            type: "user" as const,
            userId: creatorAccess.data.userId,
            companyId: creatorAccess.data.companyId,
            displayName: creatorAccess.data.displayName,
            roleName: creatorAccess.data.roleName,
          },
          target: {
            userId: authProvision.data.userId,
            companyId,
            displayName: fullName,
          },
          branchId: item.branch_id,
          branchScope,
          description: `Started branch assignment for ${fullName} in ${item.branch_name}.`,
          requestContext,
          metadata: {
            branchId: item.branch_id,
            branchName: item.branch_name,
            roleName: selectedRole.data.roleName,
          },
        }))
      : []),
    ...(resolvedScope.data.selectedArea
      ? [
          {
            action: "assignment.area_started" as const,
            entityType: "assignment" as const,
            entityId: authProvision.data.userId,
            actor: {
              type: "user" as const,
              userId: creatorAccess.data.userId,
              companyId: creatorAccess.data.companyId,
              displayName: creatorAccess.data.displayName,
              roleName: creatorAccess.data.roleName,
            },
            target: {
              userId: authProvision.data.userId,
              companyId,
              displayName: fullName,
            },
            branchId: resolvedScope.data.selectedArea.branch_id,
            branchScope,
            description: `Started area assignment for ${fullName} in ${resolvedScope.data.selectedArea.area_code}.`,
            requestContext,
            metadata: {
              areaId: resolvedScope.data.selectedArea.area_id,
              areaCode: resolvedScope.data.selectedArea.area_code,
              branchId: resolvedScope.data.selectedArea.branch_id,
            },
          },
        ]
      : []),
  ]);

  return buildSuccessState({
    input,
    selectedRole: selectedRole.data,
    resolvedScope: resolvedScope.data,
    companyId,
    userId: authProvision.data.userId,
    temporaryPassword: authProvision.data.temporaryPassword,
  });
}
