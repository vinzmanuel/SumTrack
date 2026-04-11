import type { ReportsDashboardAuthResult, ReportsPageAccessState } from "@/app/dashboard/reports/types";

function formatBranchScopeLabel(branchCount: number) {
  if (branchCount <= 0) {
    return "No branch scope";
  }

  if (branchCount === 1) {
    return "1 assigned branch";
  }

  return `${branchCount} assigned branches`;
}

export function resolveReportsPageAccess(
  auth: ReportsDashboardAuthResult,
): ReportsPageAccessState {
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

  if (auth.roleName === "Admin") {
    return {
      view: "ready",
      userId: auth.userId,
      companyId: auth.companyId,
      displayName: auth.displayName,
      roleName: "Admin",
      canAccessAnalytics: true,
      canAccessOperationalDocuments: true,
      scopeLabel: "Global Scope",
      scopeDetail: "Admin can access analytical reports and operational documents across the dashboard.",
      allowedBranchIds: auth.assignedBranchIds,
      fixedBranchId: null,
      fixedBranchName: null,
    };
  }

  if (auth.roleName === "Auditor") {
    if (auth.assignedBranchIds.length === 0) {
      return {
        view: "scope_error",
        message: "No active branch jurisdictions were found for your account.",
      };
    }

    return {
      view: "ready",
      userId: auth.userId,
      companyId: auth.companyId,
      displayName: auth.displayName,
      roleName: "Auditor",
      canAccessAnalytics: true,
      canAccessOperationalDocuments: false,
      scopeLabel: formatBranchScopeLabel(auth.assignedBranchIds.length),
      scopeDetail: "Auditor access is limited to analytical reporting within assigned branch jurisdictions.",
      allowedBranchIds: auth.assignedBranchIds,
      fixedBranchId: null,
      fixedBranchName: null,
    };
  }

  if (auth.roleName === "Branch Manager") {
    if (!auth.activeBranchId || !auth.activeBranchName) {
      return {
        view: "scope_error",
        message: "A single active branch assignment is required before opening the Reports module.",
      };
    }

    return {
      view: "ready",
      userId: auth.userId,
      companyId: auth.companyId,
      displayName: auth.displayName,
      roleName: "Branch Manager",
      canAccessAnalytics: true,
      canAccessOperationalDocuments: true,
      scopeLabel: auth.activeBranchName,
      scopeDetail: "Branch Manager access is fixed to the current active branch.",
      allowedBranchIds: [auth.activeBranchId],
      fixedBranchId: auth.activeBranchId,
      fixedBranchName: auth.activeBranchName,
    };
  }

  if (auth.roleName === "Secretary") {
    if (!auth.activeBranchId || !auth.activeBranchName) {
      return {
        view: "scope_error",
        message: "A single active branch assignment is required before opening the Reports module.",
      };
    }

    return {
      view: "ready",
      userId: auth.userId,
      companyId: auth.companyId,
      displayName: auth.displayName,
      roleName: "Secretary",
      canAccessAnalytics: false,
      canAccessOperationalDocuments: true,
      scopeLabel: auth.activeBranchName,
      scopeDetail: "Secretary access is limited to operational document workflows within the assigned branch.",
      allowedBranchIds: [auth.activeBranchId],
      fixedBranchId: auth.activeBranchId,
      fixedBranchName: auth.activeBranchName,
    };
  }

  return {
    view: "forbidden",
    message: "You are not authorized to access the Reports module.",
  };
}
