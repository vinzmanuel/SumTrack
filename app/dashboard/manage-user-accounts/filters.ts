import type { DashboardAuthResult } from "@/app/dashboard/auth";
import type {
  ManageUserAccountStatus,
  ManageUserAccountsAccessState,
  ManageUserAccountsFilters,
  ManageUserAccountsPageProps,
} from "@/app/dashboard/manage-user-accounts/types";

function toPositiveInt(value: string | undefined) {
  return /^\d+$/.test(String(value ?? "")) ? Number(value) : null;
}

function normalizeSearchQuery(value: string | undefined) {
  return String(value ?? "").trim().slice(0, 100);
}

function normalizeRoleName(value: string | undefined) {
  const normalized = String(value ?? "").trim().slice(0, 50);
  return normalized ? normalized : null;
}

function normalizeStatus(value: string | undefined): ManageUserAccountStatus {
  return value === "inactive" ? "inactive" : "active";
}

export function parseManageUserAccountsFilters(
  params: Awaited<ManageUserAccountsPageProps["searchParams"]>,
): ManageUserAccountsFilters {
  return {
    requestedBranchId: toPositiveInt(params?.branchId),
    requestedAreaId: toPositiveInt(params?.areaId),
    requestedRoleName: normalizeRoleName(params?.role),
    requestedStatus: normalizeStatus(params?.status),
    searchQuery: normalizeSearchQuery(params?.query),
    page: Math.max(toPositiveInt(params?.page) ?? 1, 1),
  };
}

export function resolveManageUserAccountsAccess(
  auth: DashboardAuthResult,
  filters: ManageUserAccountsFilters,
): ManageUserAccountsAccessState {
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") {
      return {
        view: "unauthenticated",
        message: auth.message,
      };
    }

    return {
      view: "forbidden",
      message: auth.message,
    };
  }

  const roleName = auth.roleName;
  const isAdmin = roleName === "Admin";
  const isAuditor = roleName === "Auditor";
  const isBranchManager = roleName === "Branch Manager";

  if (!isAdmin && !isAuditor && !isBranchManager) {
    return {
      view: "forbidden",
      message: "Only Admin, Auditor, and Branch Manager can access Manage User Accounts.",
    };
  }

  if (isAdmin) {
    return {
      view: "staff",
      roleName: "Admin",
      viewerUserId: auth.userId,
      selectedBranchId: filters.requestedBranchId,
      selectedAreaId: filters.requestedAreaId,
      selectedRoleName: filters.requestedRoleName,
      selectedStatus: filters.requestedStatus,
      allowedBranchIds: [],
      canChooseBranch: true,
      allBranchLabel: "All branches",
      scopeMessage: "",
      searchQuery: filters.searchQuery,
      page: filters.page,
    };
  }

  if (auth.assignedBranchIds.length === 0) {
    return {
      view: "scope_error",
      message: "No active branch assignment found for your account.",
    };
  }

  if (isAuditor) {
    return {
      view: "staff",
      roleName: "Auditor",
      viewerUserId: auth.userId,
      selectedBranchId:
        filters.requestedBranchId && auth.assignedBranchIds.includes(filters.requestedBranchId)
          ? filters.requestedBranchId
          : null,
      selectedAreaId: filters.requestedAreaId,
      selectedRoleName: filters.requestedRoleName,
      selectedStatus: filters.requestedStatus,
      allowedBranchIds: auth.assignedBranchIds,
      canChooseBranch: true,
      allBranchLabel: "All assigned branches",
      scopeMessage: "Read-only access is limited to your assigned branches.",
      searchQuery: filters.searchQuery,
      page: filters.page,
    };
  }

  if (!auth.activeBranchId) {
    return {
      view: "scope_error",
      message: "A single active branch assignment is required for branch-level account management.",
    };
  }

  return {
    view: "staff",
    roleName: "Branch Manager",
    viewerUserId: auth.userId,
    selectedBranchId: auth.activeBranchId,
    selectedAreaId: filters.requestedAreaId,
    selectedRoleName: filters.requestedRoleName,
    selectedStatus: filters.requestedStatus,
    allowedBranchIds: [auth.activeBranchId],
    canChooseBranch: false,
    allBranchLabel: "Own branch",
    scopeMessage: "Branch scope is enforced from your active assignment.",
    searchQuery: filters.searchQuery,
    page: filters.page,
  };
}
