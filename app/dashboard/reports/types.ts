import type { DashboardAuthResult } from "@/app/dashboard/auth";

export type ReportsRoleName =
  | "Admin"
  | "Auditor"
  | "Branch Manager"
  | "Secretary";

export type AnalyticsReportTemplateKey =
  | "financial_overview"
  | "monthly_collections_summary"
  | "active_loans_summary"
  | "branch_performance_comparison";

export type OperationalDocumentTemplateKey =
  | "borrower_loan_schedule"
  | "collection_receipt"
  | "loan_receipt_summary";

export type ReportsBranchOption = {
  branchId: number;
  branchName: string;
};

export type ReportsAnalyticsTemplateOption = {
  key: AnalyticsReportTemplateKey;
  label: string;
  description: string;
  dateMode: "none" | "month" | "range";
  minBranchCount: number;
  available: boolean;
  availabilityNote: string | null;
};

export type ReportsPageData = {
  branchOptions: ReportsBranchOption[];
  analyticsTemplates: ReportsAnalyticsTemplateOption[];
};

export type ReportsLibraryCategoryTab = "all" | "analytics" | "documents";
export type ReportsLibraryStatusTab = "active" | "archived";
export type ReportsCreateTab = "analytics" | "documents";
export type ReportsLibraryGeneratedTypeFilter = "all" | "user" | "system";
export type ReportsLibraryGeneratedDatePreset =
  | "all"
  | "today"
  | "this_week"
  | "this_month"
  | "this_year"
  | "custom";

export type ReportsLibraryFilterState = {
  category: ReportsLibraryCategoryTab;
  status: ReportsLibraryStatusTab;
  templateKey: string | null;
  generatedType: ReportsLibraryGeneratedTypeFilter;
  generatedByRoleName: string | null;
  generatedByUserId: string | null;
  branchIds: number[];
  generatedDatePreset: ReportsLibraryGeneratedDatePreset;
  generatedDateFrom: string | null;
  generatedDateTo: string | null;
  coverageDateFrom: string | null;
  coverageDateTo: string | null;
};

export type ReportsLibraryRow = {
  reportId: number;
  title: string;
  reportCategory: "analytics" | "document";
  templateKey: string;
  templateLabel: string;
  generatedType: "user" | "system";
  generatedAt: string;
  status: "active" | "archived";
  generatedByUserId: string;
  generatedByName: string;
  generatedByRoleName: string | null;
  branchScope: number[];
  dateFrom: string | null;
  dateTo: string | null;
  sourceEntityType: "loan" | "collection" | null;
  sourceEntityId: number | null;
};

export type ReportsLibraryTemplateFilterOption = {
  templateKey: string;
  label: string;
};

export type ReportsLibraryGeneratedByFilterOption = {
  userId: string;
  displayName: string;
  roleName: string | null;
};

export type ReportsLibraryGeneratedByRoleFilterOption = {
  roleName: string;
};

export type ReportsLibraryPageData = {
  filters: ReportsLibraryFilterState;
  rows: ReportsLibraryRow[];
  counts: {
    all: number;
    analytics: number;
    documents: number;
    active: number;
    archived: number;
  };
  filterOptions: {
    templates: ReportsLibraryTemplateFilterOption[];
    generatedByRoles: ReportsLibraryGeneratedByRoleFilterOption[];
    generatedByUsers: ReportsLibraryGeneratedByFilterOption[];
    branches: ReportsBranchOption[];
  };
};

export type ReportsPageAccessState =
    | {
      view: "ready";
      userId: string;
      roleName: ReportsRoleName;
      canAccessAnalytics: boolean;
      canAccessOperationalDocuments: boolean;
      scopeLabel: string;
      scopeDetail: string;
      allowedBranchIds: number[];
      fixedBranchId: number | null;
      fixedBranchName: string | null;
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

export type ReportsPageCategoryItem = {
  key: string;
  title: string;
  blurb: string;
};

export type ReportsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export type ReportsDashboardAuthResult = DashboardAuthResult;
export type ReportsReadyAccessState = Extract<ReportsPageAccessState, { view: "ready" }>;
