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
