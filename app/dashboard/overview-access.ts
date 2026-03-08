import type { DashboardAuthContext } from "@/app/dashboard/auth";
import type { DashboardOverviewState, DashboardScope } from "@/app/dashboard/overview-types";

function resolveDashboardScope(auth: DashboardAuthContext): DashboardScope | null {
  if (auth.roleName === "Admin") {
    return { kind: "all_branches" };
  }

  if (auth.roleName === "Auditor") {
    return { kind: "branches", branchIds: auth.assignedBranchIds };
  }

  if (auth.roleName === "Branch Manager" || auth.roleName === "Secretary") {
    return { kind: "branches", branchIds: auth.activeBranchId ? [auth.activeBranchId] : [] };
  }

  if (auth.roleName === "Collector") {
    return { kind: "collector", collectorId: auth.userId };
  }

  if (auth.roleName === "Borrower") {
    return { kind: "borrower", borrowerId: auth.userId };
  }

  return null;
}

function resolveDashboardVariant(roleName: DashboardAuthContext["roleName"]): DashboardOverviewState["variant"] {
  if (roleName === "Admin" || roleName === "Branch Manager" || roleName === "Auditor") {
    return "management";
  }

  if (roleName === "Secretary") {
    return "secretary";
  }

  if (roleName === "Collector") {
    return "collector";
  }

  if (roleName === "Borrower") {
    return "borrower";
  }

  return "none";
}

export function resolveDashboardOverviewState(auth: DashboardAuthContext): DashboardOverviewState {
  return {
    auth,
    roleName: auth.roleName,
    scope: resolveDashboardScope(auth),
    variant: resolveDashboardVariant(auth.roleName),
  };
}
