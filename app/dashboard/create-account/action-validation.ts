import type { CreateAccountState } from "@/app/dashboard/create-account/state";
import type { ActionFieldErrors, FormFields, ParsedCreateAccountInput } from "@/app/dashboard/create-account/action-types";
import {
  isValidEmailAddress,
  isValidPhilippineMobile,
  normalizeAccountContactNo,
  normalizeAccountEmail,
} from "@/app/dashboard/account-field-validation";

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
  const contactNoRaw = getTrimmed(formData, "contact_no");

  return {
    accountCategory,
    roleId: toInt(getTrimmed(formData, "role_id")),
    firstName: getTrimmed(formData, "first_name"),
    middleName: getTrimmed(formData, "middle_name"),
    lastName: getTrimmed(formData, "last_name"),
    contactNo: normalizeAccountContactNo(contactNoRaw),
    email: normalizeAccountEmail(getTrimmed(formData, "email")),
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

  if (input.email && !isValidEmailAddress(input.email)) {
    fieldErrors.email = "Enter a valid email address.";
  }

  if (input.accountCategory === "Borrower") {
    if (!input.branchId) {
      fieldErrors.branch_id = "Branch is required for borrowers.";
    }
    if (!input.areaId) {
      fieldErrors.area_id = "Area is required for borrowers.";
    }
    if (!input.contactNo) {
      fieldErrors.contact_no = "Contact number is required for borrowers.";
    } else if (!isValidPhilippineMobile(input.contactNo)) {
      fieldErrors.contact_no = "Enter a valid PH mobile number starting with 09.";
    }
    if (!input.address) {
      fieldErrors.address = "Address is required for borrowers.";
    }
  } else if (input.contactNo && !isValidPhilippineMobile(input.contactNo)) {
    fieldErrors.contact_no = "Enter a valid PH mobile number starting with 09.";
  }

  return fieldErrors;
}
