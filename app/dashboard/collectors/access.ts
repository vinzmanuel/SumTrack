import type { DashboardAuthContext } from "@/app/dashboard/auth";
import type { CollectorsAccessState } from "@/app/dashboard/collectors/types";

export function resolveCollectorsPageAccess(
  auth: DashboardAuthContext,
  filters: { requestedBranchId: number | null },
): CollectorsAccessState {
  if (auth.roleName === "Admin") {
    return {
      view: "analytics",
      roleName: auth.roleName,
      allowedBranchIds: auth.assignedBranchIds,
      selectedBranchId:
        filters.requestedBranchId && auth.assignedBranchIds.includes(filters.requestedBranchId)
          ? filters.requestedBranchId
          : null,
      canChooseBranch: true,
      branchFilterLabel: "Branch",
      fixedBranchName: null,
    };
  }

  if (auth.roleName === "Auditor") {
    return {
      view: "analytics",
      roleName: auth.roleName,
      allowedBranchIds: auth.assignedBranchIds,
      selectedBranchId:
        filters.requestedBranchId && auth.assignedBranchIds.includes(filters.requestedBranchId)
          ? filters.requestedBranchId
          : null,
      canChooseBranch: true,
      branchFilterLabel: "Assigned Branch",
      fixedBranchName: null,
    };
  }

  if (auth.roleName === "Branch Manager") {
    if (!auth.activeBranchId) {
      return {
        view: "forbidden",
        message: "No active branch assignment was found for this account.",
      };
    }

    return {
      view: "analytics",
      roleName: auth.roleName,
      allowedBranchIds: [auth.activeBranchId],
      selectedBranchId: auth.activeBranchId,
      canChooseBranch: false,
      branchFilterLabel: "Branch",
      fixedBranchName: auth.activeBranchName,
    };
  }

  return {
    view: "forbidden",
    message: "You are not authorized to view collectors analytics.",
  };
}
