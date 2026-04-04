export type ManageUserAccountsPageProps = {
  searchParams?: Promise<{
    branchId?: string;
    areaId?: string;
    role?: string;
    status?: string;
    sort?: string;
    query?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export type ManageUserAccountStatus = "active" | "inactive";
export type ManageUserAccountsSort =
  | "date_created_asc"
  | "date_created_desc"
  | "role_asc"
  | "role_desc";

export type ManageUserAccountsFilters = {
  requestedBranchId: number | null;
  requestedAreaId: number | null;
  requestedRoleName: string | null;
  requestedStatus: ManageUserAccountStatus;
  requestedSort: ManageUserAccountsSort;
  searchQuery: string;
  page: number;
  pageSize: number;
};

export type ManageUserAccountsScope = {
  view: "staff";
  roleName: "Admin" | "Auditor" | "Branch Manager";
  viewerUserId: string;
  selectedBranchId: number | null;
  selectedAreaId: number | null;
  selectedRoleName: string | null;
  selectedStatus: ManageUserAccountStatus;
  selectedSort: ManageUserAccountsSort;
  allowedBranchIds: number[];
  canChooseBranch: boolean;
  allBranchLabel: string;
  scopeMessage: string;
  searchQuery: string;
  page: number;
  pageSize: number;
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
  branchCode?: string;
};

export type ManagedUserAreaOption = {
  areaId: number;
  areaCode: string;
  branchId?: number;
};

export type ManagedUserRoleOption = {
  roleId?: number;
  roleName: string;
};

export type ManagedCollectorBlockedActionType =
  | "role_change"
  | "branch_reassignment"
  | "area_reassignment"
  | "deactivate"
  | "delete";

export type ManagedCollectorReassignmentRequiredPayload = {
  errorType: "reassignment_required";
  reassignmentRequired: true;
  actionType: ManagedCollectorBlockedActionType;
  collectorId: string;
  currentRole: string;
  nextRole?: string | null;
  nextBranchId?: number | null;
  nextAreaId?: number | null;
  activeLoanCount: number;
  overdueLoanCount: number;
  totalLiveLoanCount: number;
  message: string;
};

export type ManagedUserMutationErrorPayload = {
  message?: string;
} & Partial<ManagedCollectorReassignmentRequiredPayload>;

export type ManagedCollectorReassignmentCandidate = {
  userId: string;
  fullName: string;
  companyId: string;
  areaId: number;
  areaCode: string;
  branchId: number;
  branchCode: string;
  branchName: string;
};

export type ManagedCollectorReassignmentPreview = ManagedCollectorReassignmentRequiredPayload & {
  collectorName: string;
  collectorCompanyId: string;
  currentAreaCode: string | null;
  currentBranchCode: string | null;
  candidateScopeLabel: string;
  candidates: ManagedCollectorReassignmentCandidate[];
};

export type ManagedCollectorReassignmentResult = {
  ok: true;
  reassignedLoanCount: number;
  replacementCollectorId: string;
  replacementCollectorName: string;
};

export type ManagedUserListRow = {
  userId: string;
  fullName: string;
  displayName: string;
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
  canEditRole: boolean;
  editableRoleOptions: ManagedUserRoleOption[];
  canEditBranchAssignment: boolean;
  canEditAuditorBranchAssignments: boolean;
  canEditAreaAssignment: boolean;
  currentBranchId: number | null;
  currentBranchName: string | null;
  currentAreaId: number | null;
  currentAreaCode: string | null;
  currentBranchAssignments: ManagedUserBranchOption[];
  editableBranchOptions: ManagedUserBranchOption[];
  editableAreaOptions: ManagedUserAreaOption[];
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
