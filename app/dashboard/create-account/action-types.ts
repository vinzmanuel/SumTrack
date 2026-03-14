import type { CreateAccountState } from "@/app/dashboard/create-account/state";

export type AccountCategory = "Employee" | "Borrower";

export type FormFields = {
  account_category: AccountCategory;
  role_id: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  contact_no: string;
  email: string;
  address: string;
  branch_id: string;
  area_id: string;
  branch_ids: string;
};

export type ActionFieldErrors = Partial<Record<keyof FormFields, string>>;

export type ParsedCreateAccountInput = {
  accountCategory: AccountCategory;
  roleId: number | null;
  firstName: string;
  middleName: string;
  lastName: string;
  contactNo: string;
  email: string;
  address: string;
  branchId: number | null;
  areaId: number | null;
  branchIds: string[];
};

export type CreatorRoleName = "Admin" | "Branch Manager" | "Secretary";

export type CreatorAccess = {
  userId: string;
  roleName: CreatorRoleName;
  isAdmin: boolean;
  isBranchManager: boolean;
  isSecretaryCreator: boolean;
  allowedSingleBranchId: number | null;
};

export type SelectedRoleContext = {
  roleId: number;
  roleName: string;
  isAuditorRole: boolean;
  isCollectorRole: boolean;
  branchRequired: boolean;
};

export type SelectedBranch = {
  branch_id: number;
  branch_name: string;
};

export type SelectedArea = {
  area_id: number;
  branch_id: number;
  area_code: string;
  area_no: string;
};

export type ResolvedCreateAccountScope = {
  selectedSingleBranch: SelectedBranch | null;
  selectedBranches: SelectedBranch[];
  selectedArea: SelectedArea | null;
};

export type ProvisionedAuthAccount = {
  userId: string;
  temporaryPassword: string;
};

export type CreateAccountResolution<T> =
  | { ok: true; data: T }
  | { ok: false; state: CreateAccountState };

export const EMPLOYEE_ROLE_NAMES = [
  "Admin",
  "Auditor",
  "Branch Manager",
  "Secretary",
  "Collector",
] as const;

export const AUDITOR_ROLE_NAME = "Auditor";
export const COLLECTOR_ROLE_NAME = "Collector";
export const BORROWER_ROLE_NAME = "Borrower";
export const BRANCH_REQUIRED_ROLE_NAMES = ["Branch Manager", "Secretary"];
