import type { DashboardAuthResult } from "@/app/dashboard/auth";
import type { AnalyticsChartModel } from "@/components/analytics/types";

export type BranchStatus = "active" | "inactive";

export type BranchesAccessState =
  | {
      view: "network";
      roleName: "Admin" | "Auditor";
      allowedBranchIds: number[];
      canCreateBranch: boolean;
      scopeMessage: string;
    }
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

export type BranchNetworkCardData = {
  branchId: number;
  branchName: string;
  branchCode: string;
  status: BranchStatus;
  municipalityName: string;
  provinceName: string;
  branchAddress: string;
  managerName: string | null;
  managerCompanyId: string | null;
  collectorCount: number;
  borrowerCount: number;
  activeLoanCount: number;
  overdueLoanCount: number;
  collectionsThisMonth: number;
  dateCreated: string | null;
};

export type BranchNetworkPageData = {
  branches: BranchNetworkCardData[];
  totalCount: number;
  canCreateBranch: boolean;
  scopeMessage: string;
};

export type BranchDetailTabKey = "overview" | "employees" | "areas";

export type BranchDetailAccessState =
  | {
      view: "detail";
      roleName: "Admin" | "Auditor" | "Branch Manager";
      allowedBranchIds: number[];
      scopeMessage: string;
    }
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

export type BranchDetailOverviewData = {
  branchId: number;
  branchName: string;
  branchCode: string;
  status: BranchStatus;
  municipalityName: string;
  provinceName: string;
  branchAddress: string;
  dateCreated: string | null;
  statusLabel: string;
  managerName: string | null;
  managerCompanyId: string | null;
  auditorName: string | null;
  auditorCompanyId: string | null;
  branchManagerCount: number;
  auditorCount: number;
  secretaryCount: number;
  collectorCount: number;
  borrowerCount: number;
  activeAreaCount: number;
  activeLoanCount: number;
  overdueLoanCount: number;
  collectionsThisMonth: number;
  collectionsTrend: AnalyticsChartModel;
};

export type BranchActionPermissions = {
  canEditDetails: boolean;
  canManageLifecycle: boolean;
  canDelete: boolean;
  canManageEmployees: boolean;
  canManageAreas: boolean;
};

export type BranchMutationResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export type BranchCreateMutationResult =
  | {
      ok: true;
      message: string;
      branchCode: string;
    }
  | {
      ok: false;
      message: string;
    };

export type BranchEmployeeListRow = {
  userId: string;
  fullName: string;
  companyId: string;
  roleName: string;
  status: "active" | "inactive";
  scopeLabel: string;
  contactNo: string | null;
  email: string | null;
  canView: boolean;
  canEdit: boolean;
};

export type BranchEmployeesTabData = {
  branchCode: string;
  employees: BranchEmployeeListRow[];
};

export type BranchAreaListRow = {
  areaId: number;
  areaCode: string;
  areaNo: string;
  description: string | null;
  status: "active" | "inactive";
  assignedCollectorLabel: string;
  assignedCollectorNames: string[];
  borrowerCount: number;
  activeLoanCount: number;
  overdueLoanCount: number;
  collectionsThisMonth: number;
  dateCreated: string | null;
};

export type BranchAreasTabData = {
  branchCode: string;
  areas: BranchAreaListRow[];
};

export type BranchAreaCreateMutationResult =
  | {
      ok: true;
      message: string;
      area: BranchAreaListRow;
    }
  | {
      ok: false;
      message: string;
    };

export function parseBranchDetailTab(value: string | undefined): BranchDetailTabKey {
  if (value === "employees" || value === "areas") {
    return value;
  }

  return "overview";
}

export function resolveBranchesPageAccess(auth: DashboardAuthResult): BranchesAccessState {
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
      view: "network",
      roleName: "Admin",
      allowedBranchIds: auth.assignedBranchIds,
      canCreateBranch: true,
      scopeMessage: "Admin can create branches and manage branch lifecycle from this module.",
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
      view: "network",
      roleName: "Auditor",
      allowedBranchIds: auth.assignedBranchIds,
      canCreateBranch: false,
      scopeMessage: "Read-only branch oversight is limited to your assigned branch jurisdictions.",
    };
  }

  return {
    view: "forbidden",
    message: "Only Admin and Auditor can access the Branches module right now.",
  };
}

export function resolveBranchDetailAccess(auth: DashboardAuthResult): BranchDetailAccessState {
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
      view: "detail",
      roleName: "Admin",
      allowedBranchIds: auth.assignedBranchIds,
      scopeMessage: "Admin can review the full branch detail workspace.",
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
      view: "detail",
      roleName: "Auditor",
      allowedBranchIds: auth.assignedBranchIds,
      scopeMessage: "Auditor access is limited to assigned branch jurisdictions.",
    };
  }

  if (auth.roleName === "Branch Manager") {
    if (!auth.activeBranchId) {
      return {
        view: "scope_error",
        message: "A single active branch assignment is required to view branch details.",
      };
    }

    return {
      view: "detail",
      roleName: "Branch Manager",
      allowedBranchIds: [auth.activeBranchId],
      scopeMessage: "Branch Manager access is limited to your own active branch.",
    };
  }

  return {
    view: "forbidden",
    message: "You are not allowed to access branch details.",
  };
}
