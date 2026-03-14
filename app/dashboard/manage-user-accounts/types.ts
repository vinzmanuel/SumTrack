export type ManageUserAccountsPageProps = {
  searchParams?: Promise<{
    branchId?: string;
    areaId?: string;
    role?: string;
    status?: string;
    query?: string;
    page?: string;
  }>;
};

export type ManageUserAccountStatus = "active" | "inactive";

export type ManageUserAccountsFilters = {
  requestedBranchId: number | null;
  requestedAreaId: number | null;
  requestedRoleName: string | null;
  requestedStatus: ManageUserAccountStatus;
  searchQuery: string;
  page: number;
};

export type ManageUserAccountsScope = {
  view: "staff";
  roleName: "Admin" | "Auditor" | "Branch Manager";
  viewerUserId: string;
  selectedBranchId: number | null;
  selectedAreaId: number | null;
  selectedRoleName: string | null;
  selectedStatus: ManageUserAccountStatus;
  allowedBranchIds: number[];
  canChooseBranch: boolean;
  allBranchLabel: string;
  scopeMessage: string;
  searchQuery: string;
  page: number;
};

export type ManageUserAccountsAccessState =
  | ManageUserAccountsScope
  | {
      view: "unauthenticated";
      message: string;
    }
  | {
      view: "forbidden";
      message: string;
    }
  | {
      view: "scope_error";
      message: string;
    };

export type ManagedUserBranchOption = {
  branchId: number;
  branchName: string;
};

export type ManagedUserAreaOption = {
  areaId: number;
  areaCode: string;
};

export type ManagedUserRoleOption = {
  roleId?: number;
  roleName: string;
};

export type ManagedUserListRow = {
  userId: string;
  fullName: string;
  companyId: string;
  username: string;
  roleName: string;
  scopeLabel: string;
  contactNo: string | null;
  email: string | null;
  status: "active" | "inactive";
  canView: boolean;
  canEdit: boolean;
  canManageStatus: boolean;
  canDelete: boolean;
};

export type ManageUserAccountsPageData = {
  branches: ManagedUserBranchOption[];
  areas: ManagedUserAreaOption[];
  roles: ManagedUserRoleOption[];
  users: ManagedUserListRow[];
  selectedAreaId: number | null;
  selectedStatus: ManageUserAccountStatus;
  activeCount: number;
  inactiveCount: number;
  page: number;
  pageSize: number;
  totalCount: number;
};

export type ManagedUserDetail = {
  userId: string;
  fullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
  roleId: number;
  companyId: string;
  username: string;
  email: string | null;
  roleName: string;
  status: "active" | "inactive";
  accountCategory: "Employee" | "Borrower";
  scopeLabel: string;
  contactLabel: string;
  contactNo: string | null;
  dateCreated: string | null;
  address: string | null;
  canEdit: boolean;
  canManageStatus: boolean;
  canDelete: boolean;
  editableRoleOptions: ManagedUserRoleOption[];
};

export function canCreateManagedUser(scope: ManageUserAccountsScope) {
  return scope.roleName === "Admin" || scope.roleName === "Branch Manager";
}

function canBranchManagerManageRole(roleName: string) {
  return roleName === "Secretary" || roleName === "Collector" || roleName === "Borrower";
}

export function canEditManagedUser(scope: ManageUserAccountsScope, row: { roleName: string }) {
  if (scope.roleName === "Admin") {
    return true;
  }

  if (scope.roleName === "Branch Manager") {
    return canBranchManagerManageRole(row.roleName);
  }

  return false;
}

export function canDeleteManagedUser(
  scope: ManageUserAccountsScope,
  row: { roleName: string; userId: string },
) {
  if (row.userId === scope.viewerUserId) {
    return false;
  }

  return canEditManagedUser(scope, row);
}

export function canManageManagedUserStatus(
  scope: ManageUserAccountsScope,
  row: { roleName: string; userId: string },
) {
  if (row.userId === scope.viewerUserId) {
    return false;
  }

  return canEditManagedUser(scope, row);
}
