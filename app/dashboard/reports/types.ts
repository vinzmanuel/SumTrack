import type { DashboardAuthResult } from "@/app/dashboard/auth";

export type ReportsRoleName =
  | "Admin"
  | "Auditor"
  | "Branch Manager"
  | "Secretary";

export type ReportsSystemRecipientRole = Extract<
  ReportsRoleName,
  "Admin" | "Auditor" | "Branch Manager"
>;

export type AnalyticsReportTemplateKey =
  | "financial_overview"
  | "expenses_overview"
  | "monthly_collections_summary"
  | "collections_summary"
  | "active_loans_summary"
  | "loans_summary"
  | "branch_performance_comparison"
  | "branch_performance_overview"
  | "collections_by_collector"
  | "overdue_loans_report"
  | "released_loans_report"
  | "closed_loans_report"
  | "borrower_summary"
  | "borrowers_with_overdue_loans"
  | "branch_collections_comparison"
  | "branch_loans_comparison"
  | "collector_performance_report"
  | "collector_leaderboard_report";

export type ReportsSystemGeneratedAnalyticsTemplateKey =
  | "financial_overview"
  | "borrower_summary"
  | "loans_summary"
  | "branch_performance_comparison"
  | "branch_performance_overview";

export type OperationalDocumentTemplateKey =
  | "borrower_loan_schedule"
  | "collection_receipt"
  | "loan_receipt_summary";

export type ReportsTemplateCategoryKey =
  | "financials"
  | "collections"
  | "loans"
  | "borrowers"
  | "branches"
  | "collectors"
  | "documents";

export type ReportsTemplatePersistedCategory = "analytics" | "document";

export type ReportsTemplateCategoryDefinition = {
  key: ReportsTemplateCategoryKey;
  label: string;
  description: string;
  reportCategory: ReportsTemplatePersistedCategory;
};

export type ReportsAnalyticsTemplateOption = {
  key: AnalyticsReportTemplateKey;
  label: string;
  category: ReportsTemplateCategoryKey;
  categoryLabel: string;
  reportCategory: "analytics";
  description: string;
  allowedRoles: ReportsRoleName[];
  generationMode: "manual";
  dateMode: "none" | "month" | "range";
  minBranchCount: number;
  maxBranchCount: number | null;
  implemented: boolean;
  available: boolean;
  availabilityNote: string | null;
};

export type ReportsOperationalDocumentTemplateOption = {
  key: OperationalDocumentTemplateKey;
  label: string;
  category: "documents";
  categoryLabel: string;
  reportCategory: "document";
  description: string;
  allowedRoles: ReportsRoleName[];
  generationMode: "record";
  sourceEntityType: "loan" | "collection";
  implemented: boolean;
};

export type ReportsSnapshotValueFormat = "currency" | "number" | "text";

export type ReportsSnapshotSummaryItem = {
  key: string;
  label: string;
  value: number | string;
  format?: ReportsSnapshotValueFormat;
};

export type ReportsSnapshotChartSeries = {
  key: string;
  label: string;
  color: string;
  type?: "bar" | "line";
  stackId?: string;
  valueFormat?: ReportsSnapshotValueFormat;
  yAxisId?: "left" | "right";
};

export type ReportsSnapshotChartSection = {
  key: string;
  title: string;
  type: "chart";
  chartType: "bar" | "line" | "composed";
  layout?: "vertical" | "horizontal";
  indexLabel?: string;
  valueFormat?: ReportsSnapshotValueFormat;
  note?: string;
  showLegend?: boolean;
  series: ReportsSnapshotChartSeries[];
  rows: Array<{ bucket: string; values: Record<string, number> }>;
};

export type ReportsSnapshotTableColumn = {
  key: string;
  label: string;
  format?: ReportsSnapshotValueFormat;
};

export type ReportsSnapshotTableSection = {
  key: string;
  title: string;
  type: "table";
  columns: ReportsSnapshotTableColumn[];
  rows: Array<Record<string, number | string>>;
};

export type ReportsSnapshotFieldListSection = {
  key: string;
  title: string;
  type: "field_list";
  rows: Array<{ label: string; value: string }>;
};

export type ReportsSnapshotSection =
  | ReportsSnapshotChartSection
  | ReportsSnapshotTableSection
  | ReportsSnapshotFieldListSection;

export type AnalyticsReportSnapshot = {
  version: 1;
  category: "analytics";
  templateKey: AnalyticsReportTemplateKey;
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summaryCards: ReportsSnapshotSummaryItem[];
  sections: ReportsSnapshotSection[];
  meta: Record<string, number | string | boolean | null>;
};

export type OperationalDocumentSnapshot = {
  version: 1;
  category: "document";
  templateKey: OperationalDocumentTemplateKey;
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summaryCards: ReportsSnapshotSummaryItem[];
  sections: ReportsSnapshotSection[];
  meta: Record<string, number | string | boolean | null>;
};

export type SavedReportSnapshot = AnalyticsReportSnapshot | OperationalDocumentSnapshot;

export type ReportsBranchOption = {
  branchId: number;
  branchName: string;
};

export type ReportsCollectorOption = {
  collectorId: string;
  collectorName: string;
  companyId: string;
  branchId: number;
  branchName: string;
};

export type ReportsPageData = {
  branchOptions: ReportsBranchOption[];
  collectorOptions: ReportsCollectorOption[];
  analyticsTemplates: ReportsAnalyticsTemplateOption[];
  analyticsTemplateCategories: ReportsTemplateCategoryDefinition[];
  operationalDocumentTemplates: ReportsOperationalDocumentTemplateOption[];
};

export type ReportsLibraryCategoryTab = "all" | "analytics" | "documents";
export type ReportsLibraryStatusTab = "active" | "archived";
export type ReportsCreateTab = "analytics" | "documents";
export type ReportsLibraryGeneratedTypeFilter = "all" | "user" | "system";
export type ReportsDateRangePreset =
  | "this_week"
  | "this_month"
  | "past_30_days"
  | "past_6_months"
  | "this_year"
  | "lifetime"
  | "custom";

export type ReportsLibraryFilterState = {
  category: ReportsLibraryCategoryTab;
  status: ReportsLibraryStatusTab;
  page: number;
  pageSize: number;
  templateCategory: ReportsTemplateCategoryKey | null;
  templateKey: string | null;
  generatedType: ReportsLibraryGeneratedTypeFilter;
  generatedByRoleName: string | null;
  generatedByUserId: string | null;
  branchIds: number[];
  generatedDatePreset: ReportsDateRangePreset;
  generatedDateFrom: string | null;
  generatedDateTo: string | null;
  coverageDatePreset: ReportsDateRangePreset;
  coverageDateFrom: string | null;
  coverageDateTo: string | null;
};

export type ReportsLibraryRow = {
  reportId: number;
  title: string;
  reportCategory: "analytics" | "document";
  templateCategory: ReportsTemplateCategoryKey;
  templateCategoryLabel: string;
  templateKey: string;
  templateLabel: string;
  generatedType: "user" | "system";
  generatedAt: string;
  status: "active" | "archived";
  generatedByUserId: string;
  generatedByName: string;
  generatedByCompanyId: string | null;
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
  templateCategory: ReportsTemplateCategoryKey;
};

export type ReportsLibraryTemplateCategoryFilterOption = {
  key: ReportsTemplateCategoryKey;
  label: string;
  reportCategory: ReportsTemplatePersistedCategory;
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
  page: number;
  pageSize: number;
  totalCount: number;
  counts: {
    all: number;
    analytics: number;
    documents: number;
    active: number;
    archived: number;
  };
  filterOptions: {
    templateCategories: ReportsLibraryTemplateCategoryFilterOption[];
    templates: ReportsLibraryTemplateFilterOption[];
    generatedByRoles: ReportsLibraryGeneratedByRoleFilterOption[];
    generatedByUsers: ReportsLibraryGeneratedByFilterOption[];
    branches: ReportsBranchOption[];
  };
};

export type ReportsViewerPageData = {
  reportId: number;
  title: string;
  reportCategory: "analytics" | "document";
  templateKey: string;
  templateLabel: string;
  generatedType: "user" | "system";
  generatedAt: string;
  generatedByName: string;
  generatedByRoleName: string | null;
  status: "active" | "archived";
  branchScopeIds: number[];
  branchScopeNames: string[];
  dateFrom: string | null;
  dateTo: string | null;
  sourceEntityType: "loan" | "collection" | null;
  sourceEntityId: number | null;
  snapshot: SavedReportSnapshot;
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
