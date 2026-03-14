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

  return buildSuccessState({
    input,
    selectedRole: selectedRole.data,
    resolvedScope: resolvedScope.data,
    companyId,
    userId: authProvision.data.userId,
    temporaryPassword: authProvision.data.temporaryPassword,
  });
}
