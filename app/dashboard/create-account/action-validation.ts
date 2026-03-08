import type { CreateAccountState } from "@/app/dashboard/create-account/state";
import type { ActionFieldErrors, FormFields, ParsedCreateAccountInput } from "@/app/dashboard/create-account/action-types";

export function getTrimmed(formData: FormData, key: keyof FormFields) {
  return String(formData.get(key) ?? "").trim();
}

export function toInt(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}

export function createErrorState(message: string, fieldErrors?: ActionFieldErrors): CreateAccountState {
  return {
    status: "error",
    message,
    fieldErrors,
  };
}

export function parseCreateAccountForm(formData: FormData): ParsedCreateAccountInput {
  const accountCategory = getTrimmed(formData, "account_category") as ParsedCreateAccountInput["accountCategory"];
  const contactNumberRaw = getTrimmed(formData, "contact_number");

  return {
    accountCategory,
    roleId: toInt(getTrimmed(formData, "role_id")),
    firstName: getTrimmed(formData, "first_name"),
    middleName: getTrimmed(formData, "middle_name"),
    lastName: getTrimmed(formData, "last_name"),
    contactNumber: contactNumberRaw.replace(/\D/g, ""),
    address: getTrimmed(formData, "address"),
    branchId: toInt(getTrimmed(formData, "branch_id")),
    areaId: toInt(getTrimmed(formData, "area_id")),
    branchIds: formData
      .getAll("branch_ids")
      .map((value) => String(value).trim())
      .filter(Boolean),
  };
}

export function validateCreateAccountInput(input: ParsedCreateAccountInput): ActionFieldErrors {
  const fieldErrors: ActionFieldErrors = {};

  if (input.accountCategory !== "Employee" && input.accountCategory !== "Borrower") {
    fieldErrors.account_category = "Invalid account category.";
  }
  if (!input.roleId) {
    fieldErrors.role_id = "Role is required.";
  }
  if (!input.firstName) {
    fieldErrors.first_name = "First name is required.";
  }
  if (!input.lastName) {
    fieldErrors.last_name = "Last name is required.";
  }

  if (input.accountCategory === "Borrower") {
    if (!input.branchId) {
      fieldErrors.branch_id = "Branch is required for borrowers.";
    }
    if (!input.areaId) {
      fieldErrors.area_id = "Area is required for borrowers.";
    }
    if (!input.contactNumber) {
      fieldErrors.contact_number = "Contact number is required for borrowers.";
    } else if (input.contactNumber.length > 11) {
      fieldErrors.contact_number = "Contact number must be at most 11 digits.";
    }
    if (!input.address) {
      fieldErrors.address = "Address is required for borrowers.";
    }
  }

  return fieldErrors;
}
