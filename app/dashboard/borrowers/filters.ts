import type { DashboardAuthResult } from "@/app/dashboard/auth";
import type { BorrowersAccessState, BorrowersListFilters, BorrowersPageProps } from "@/app/dashboard/borrowers/types";

function toPositiveInt(value: string | undefined) {
  return /^\d+$/.test(String(value ?? "")) ? Number(value) : null;
}

export function parseBorrowersListFilters(
  params: Awaited<BorrowersPageProps["searchParams"]>,
): BorrowersListFilters {
  return {
    requestedBranchId: toPositiveInt(params?.branchId),
    requestedAreaId: toPositiveInt(params?.areaId),
  };
}

export function resolveBorrowersPageAccess(
  auth: DashboardAuthResult,
  filters: BorrowersListFilters,
): BorrowersAccessState {
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

  const role = auth.roleName;
  const isAdmin = role === "Admin";
  const isAuditor = role === "Auditor";
  const isBranchScoped = role === "Branch Manager" || role === "Secretary";

  if (!isAdmin && !isAuditor && !isBranchScoped) {
    return {
      view: "forbidden",
      message:
        "You are logged in, but only Admin, Branch Manager, Secretary, and Auditor can access borrowers.",
    };
  }

  if (isAdmin) {
    return {
      view: "staff",
      roleName: role,
      selectedBranchId: filters.requestedBranchId,
      requestedAreaId: filters.requestedAreaId,
      allowedBranchIds: [],
      canChooseBranch: true,
      allBranchLabel: "All branches",
      scopeMessage: "",
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
      roleName: role,
      selectedBranchId:
        filters.requestedBranchId && auth.assignedBranchIds.includes(filters.requestedBranchId)
          ? filters.requestedBranchId
          : null,
      requestedAreaId: filters.requestedAreaId,
      allowedBranchIds: auth.assignedBranchIds,
      canChooseBranch: true,
      allBranchLabel: "All assigned branches",
      scopeMessage: "Read-only view is limited to your assigned branches.",
    };
  }

  if (auth.assignedBranchIds.length !== 1 || !auth.activeBranchId) {
    return {
      view: "scope_error",
      message: "Multiple active branch assignments detected. Please contact Admin.",
    };
  }

  return {
    view: "staff",
    roleName: role,
    selectedBranchId: auth.activeBranchId,
    requestedAreaId: filters.requestedAreaId,
    allowedBranchIds: [auth.activeBranchId],
    canChooseBranch: false,
    allBranchLabel: "All branches",
    scopeMessage: "Branch scope is enforced from your active assignment.",
  };
}
