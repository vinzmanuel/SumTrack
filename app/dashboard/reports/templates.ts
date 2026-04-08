import type {
  AnalyticsReportTemplateKey,
  OperationalDocumentTemplateKey,
  ReportsAnalyticsTemplateOption,
  ReportsOperationalDocumentTemplateOption,
  ReportsRoleName,
  ReportsSystemGeneratedAnalyticsTemplateKey,
  ReportsSystemRecipientRole,
  ReportsTemplateCategoryDefinition,
  ReportsTemplateCategoryKey,
} from "@/app/dashboard/reports/types";

type AnalyticsTemplateDefinition = Omit<
  ReportsAnalyticsTemplateOption,
  "available" | "availabilityNote" | "categoryLabel"
>;

type OperationalDocumentTemplateDefinition = ReportsOperationalDocumentTemplateOption;

const LEGACY_ANALYTICS_TEMPLATE_KEY_ALIASES: Partial<
  Record<AnalyticsReportTemplateKey | string, AnalyticsReportTemplateKey>
> = {
  monthly_collections_summary: "collections_summary",
};

const SYSTEM_GENERATED_ANALYTICS_TEMPLATES_BY_ROLE: Record<
  ReportsSystemRecipientRole,
  readonly ReportsSystemGeneratedAnalyticsTemplateKey[]
> = {
  Admin: [
    "financial_overview",
    "borrower_summary",
    "loans_summary",
    "branch_performance_comparison",
  ],
  Auditor: [
    "financial_overview",
    "borrower_summary",
    "loans_summary",
    "branch_performance_comparison",
  ],
  "Branch Manager": [
    "financial_overview",
    "borrower_summary",
    "loans_summary",
    "branch_performance_overview",
  ],
};

export const REPORT_TEMPLATE_CATEGORIES: ReportsTemplateCategoryDefinition[] = [
  {
    key: "financials",
    label: "Financials",
    description: "Financial summaries and operating totals across the selected reporting scope.",
    reportCategory: "analytics",
  },
  {
    key: "collections",
    label: "Collections",
    description: "Collection activity, trends, and collector-facing recovery summaries.",
    reportCategory: "analytics",
  },
  {
    key: "loans",
    label: "Loans",
    description: "Loan portfolio snapshots across active, overdue, released, and closed lending states.",
    reportCategory: "analytics",
  },
  {
    key: "borrowers",
    label: "Borrowers",
    description: "Borrower population summaries and borrower-level delinquency views.",
    reportCategory: "analytics",
  },
  {
    key: "branches",
    label: "Branches",
    description: "Cross-branch reporting and branch-to-branch comparison templates.",
    reportCategory: "analytics",
  },
  {
    key: "collectors",
    label: "Collectors",
    description: "Collector-focused production and performance reporting.",
    reportCategory: "analytics",
  },
  {
    key: "documents",
    label: "Documents",
    description: "Operational saved documents generated from loans and collections.",
    reportCategory: "document",
  },
];

export const ANALYTICS_REPORT_TEMPLATES: AnalyticsTemplateDefinition[] = [
  {
    key: "financial_overview",
    label: "Financial Overview",
    category: "financials",
    reportCategory: "analytics",
    description:
      "Financial overview across the selected date range, covering cashflow, recovery/income signals, and live portfolio context.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 1,
    maxBranchCount: null,
    implemented: true,
  },
  {
    key: "expenses_overview",
    label: "Expenses Overview",
    category: "financials",
    reportCategory: "analytics",
    description:
      "Historical expense analysis across the selected reporting window, including spend structure, salary rhythm, utilities, and branch mix.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 1,
    maxBranchCount: null,
    implemented: true,
  },
  {
    key: "collections_summary",
    label: "Collections Summary",
    category: "collections",
    reportCategory: "analytics",
    description:
      "Collection totals, adaptive trend bucketing, and branch activity across the selected reporting period.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 1,
    maxBranchCount: null,
    implemented: true,
  },
  {
    key: "collections_by_collector",
    label: "Collections by Collector",
    category: "collections",
    reportCategory: "analytics",
    description:
      "Collector-by-collector collection totals and activity across the selected reporting period.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 1,
    maxBranchCount: null,
    implemented: true,
  },
  {
    key: "active_loans_summary",
    label: "Active Loans Summary",
    category: "loans",
    reportCategory: "analytics",
    description:
      "Snapshot of active and overdue loans, exposure totals, and selected-branch live-loan summary.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "none",
    minBranchCount: 1,
    maxBranchCount: null,
    implemented: true,
  },
  {
    key: "loans_summary",
    label: "Loans Summary",
    category: "loans",
    reportCategory: "analytics",
    description:
      "Period-based loan overview covering active loans at period end, overdue movement, closed loans, and outstanding balance.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 1,
    maxBranchCount: null,
    implemented: true,
  },
  {
    key: "overdue_loans_report",
    label: "Overdue Loans Report",
    category: "loans",
    reportCategory: "analytics",
    description:
      "Focused overdue-loan report for the current scope, highlighting delinquent balances and overdue counts.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 1,
    maxBranchCount: null,
    implemented: true,
  },
  {
    key: "released_loans_report",
    label: "Released Loans Report",
    category: "loans",
    reportCategory: "analytics",
    description:
      "Release-period loan reporting for loans issued during the selected coverage window.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 1,
    maxBranchCount: null,
    implemented: true,
  },
  {
    key: "closed_loans_report",
    label: "Closed Loans Report",
    category: "loans",
    reportCategory: "analytics",
    description:
      "Closed-loan reporting for fully settled or archived loans inside the chosen reporting window.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 1,
    maxBranchCount: null,
    implemented: true,
  },
  {
    key: "borrower_summary",
    label: "Borrower Summary",
    category: "borrowers",
    reportCategory: "analytics",
    description:
      "Borrower-level summary report for the current scope, including borrower counts and portfolio context.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 1,
    maxBranchCount: null,
    implemented: true,
  },
  {
    key: "borrowers_with_overdue_loans",
    label: "Borrowers with Overdue Loans",
    category: "borrowers",
    reportCategory: "analytics",
    description:
      "Borrower-focused list of accounts currently tied to overdue loans inside the visible scope.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 1,
    maxBranchCount: null,
    implemented: true,
  },
  {
    key: "branch_performance_overview",
    label: "Branch Performance Overview",
    category: "branches",
    reportCategory: "analytics",
    description:
      "Single-branch overview of financial movement and current branch portfolio metrics across the selected reporting period.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 1,
    maxBranchCount: 1,
    implemented: true,
  },
  {
    key: "branch_performance_comparison",
    label: "Branch Performance Comparison",
    category: "branches",
    reportCategory: "analytics",
    description:
      "Selected-branch comparison of borrowers, collectors, active loans, overdue loans, and monthly collections.",
    allowedRoles: ["Admin", "Auditor"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 2,
    maxBranchCount: null,
    implemented: true,
  },
  {
    key: "branch_collections_comparison",
    label: "Branch Collections Comparison",
    category: "branches",
    reportCategory: "analytics",
    description:
      "Selected-branch collections comparison across a shared reporting period. Choose specific branches; two or more branches make the comparison more meaningful.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 1,
    maxBranchCount: null,
    implemented: true,
  },
  {
    key: "branch_loans_comparison",
    label: "Branch Loans Comparison",
    category: "branches",
    reportCategory: "analytics",
    description:
      "Selected-branch loan portfolio comparison across active, overdue, and completed lending activity. Choose specific branches; two or more branches make the comparison more meaningful.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 1,
    maxBranchCount: null,
    implemented: true,
  },
  {
    key: "collector_performance_report",
    label: "Collector Performance Report",
    category: "collectors",
    reportCategory: "analytics",
    description:
      "Single-collector performance summary across the selected reporting window.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 1,
    maxBranchCount: null,
    implemented: true,
  },
  {
    key: "collector_leaderboard_report",
    label: "Collector Leaderboard Report",
    category: "collectors",
    reportCategory: "analytics",
    description:
      "Collector ranking report using average monthly collections across the selected branches and reporting window.",
    allowedRoles: ["Admin", "Auditor", "Branch Manager"],
    generationMode: "manual",
    dateMode: "range",
    minBranchCount: 1,
    maxBranchCount: null,
    implemented: true,
  },
];

export const OPERATIONAL_DOCUMENT_TEMPLATES: OperationalDocumentTemplateDefinition[] = [
  {
    key: "borrower_loan_schedule",
    label: "Borrower Loan Schedule",
    category: "documents",
    categoryLabel: "Documents",
    reportCategory: "document",
    description:
      "Loan-scoped schedule summary document generated from a saved loan record.",
    allowedRoles: ["Admin", "Branch Manager", "Secretary"],
    generationMode: "record",
    sourceEntityType: "loan",
    implemented: true,
  },
  {
    key: "collection_receipt",
    label: "Collection Receipt",
    category: "documents",
    categoryLabel: "Documents",
    reportCategory: "document",
    description:
      "Single collection receipt generated from a saved collection entry.",
    allowedRoles: ["Admin", "Branch Manager", "Secretary"],
    generationMode: "record",
    sourceEntityType: "collection",
    implemented: true,
  },
  {
    key: "loan_receipt_summary",
    label: "Loan Receipt Summary",
    category: "documents",
    categoryLabel: "Documents",
    reportCategory: "document",
    description:
      "Whole-loan payment summary document with saved collection history context.",
    allowedRoles: ["Admin", "Branch Manager", "Secretary"],
    generationMode: "record",
    sourceEntityType: "loan",
    implemented: true,
  },
];

function getTemplateCategoryLabel(category: ReportsTemplateCategoryKey) {
  return REPORT_TEMPLATE_CATEGORIES.find((item) => item.key === category)?.label ?? category;
}

export function normalizeReportTemplateKey(templateKey: string) {
  return LEGACY_ANALYTICS_TEMPLATE_KEY_ALIASES[templateKey] ?? templateKey;
}

function isRoleAllowed(allowedRoles: ReportsRoleName[], roleName: ReportsRoleName) {
  return allowedRoles.includes(roleName);
}

export function getAnalyticsTemplateDefinition(key: AnalyticsReportTemplateKey) {
  const normalizedKey = normalizeReportTemplateKey(key) as AnalyticsReportTemplateKey;
  return ANALYTICS_REPORT_TEMPLATES.find((template) => template.key === normalizedKey) ?? null;
}

export function getOperationalDocumentTemplateDefinition(
  key: OperationalDocumentTemplateKey,
) {
  return OPERATIONAL_DOCUMENT_TEMPLATES.find((template) => template.key === key) ?? null;
}

export function getTemplateCategoryDefinition(category: ReportsTemplateCategoryKey) {
  return REPORT_TEMPLATE_CATEGORIES.find((item) => item.key === category) ?? null;
}

export function resolveReportTemplateLabel(templateKey: string) {
  const normalizedKey = normalizeReportTemplateKey(templateKey);
  const analyticsTemplate = ANALYTICS_REPORT_TEMPLATES.find((template) => template.key === normalizedKey);
  if (analyticsTemplate) {
    return analyticsTemplate.label;
  }

  const documentTemplate = OPERATIONAL_DOCUMENT_TEMPLATES.find((template) => template.key === templateKey);
  if (documentTemplate) {
    return documentTemplate.label;
  }

  return templateKey;
}

export function resolveReportTemplateCategory(templateKey: string) {
  const normalizedKey = normalizeReportTemplateKey(templateKey);
  const analyticsTemplate = ANALYTICS_REPORT_TEMPLATES.find((template) => template.key === normalizedKey);
  if (analyticsTemplate) {
    return {
      key: analyticsTemplate.category,
      label: getTemplateCategoryLabel(analyticsTemplate.category),
      reportCategory: analyticsTemplate.reportCategory,
    } as const;
  }

  const documentTemplate = OPERATIONAL_DOCUMENT_TEMPLATES.find((template) => template.key === templateKey);
  if (documentTemplate) {
    return {
      key: documentTemplate.category,
      label: getTemplateCategoryLabel(documentTemplate.category),
      reportCategory: documentTemplate.reportCategory,
    } as const;
  }

  return null;
}

export function buildAnalyticsTemplateCategoryOptions(): ReportsTemplateCategoryDefinition[] {
  const categoriesInUse = new Set(ANALYTICS_REPORT_TEMPLATES.map((template) => template.category));

  return REPORT_TEMPLATE_CATEGORIES.filter(
    (category) => category.reportCategory === "analytics" && categoriesInUse.has(category.key),
  );
}

export function buildAnalyticsTemplateOptions(
  branchCount: number,
  roleName: ReportsRoleName,
  canAccessAnalytics: boolean,
): ReportsAnalyticsTemplateOption[] {
  return ANALYTICS_REPORT_TEMPLATES.filter((template) =>
    isRoleAllowed(template.allowedRoles, roleName),
  ).map((template) => {
    const implemented = template.implemented;
    const available =
      implemented &&
      canAccessAnalytics &&
      branchCount >= template.minBranchCount;

    let availabilityNote: string | null = null;
    if (!implemented) {
      availabilityNote = "This template is planned but not implemented yet.";
    } else if (!canAccessAnalytics) {
      availabilityNote = "Analytical report generation is not available for your current role.";
    } else if (branchCount < template.minBranchCount) {
      availabilityNote =
        template.minBranchCount > 1
          ? "This template requires at least two selected branches in your current scope."
          : "Select a valid branch scope for this report.";
    }

    return {
      ...template,
      categoryLabel: getTemplateCategoryLabel(template.category),
      available,
      availabilityNote,
    };
  });
}

export function buildOperationalDocumentTemplateOptions(
  roleName: ReportsRoleName,
): ReportsOperationalDocumentTemplateOption[] {
  return OPERATIONAL_DOCUMENT_TEMPLATES.filter((template) =>
    isRoleAllowed(template.allowedRoles, roleName),
  );
}

export function getSystemGeneratedTemplateKeysForRole(roleName: ReportsRoleName) {
  if (roleName === "Secretary") {
    return [] as ReportsSystemGeneratedAnalyticsTemplateKey[];
  }

  return [...SYSTEM_GENERATED_ANALYTICS_TEMPLATES_BY_ROLE[roleName]];
}

export function isSystemGeneratedTemplateAllowedForRole(
  templateKey: string,
  roleName: ReportsRoleName,
) {
  const normalizedTemplateKey = normalizeReportTemplateKey(templateKey);
  const allowedKeys = getSystemGeneratedTemplateKeysForRole(roleName);

  return allowedKeys.includes(normalizedTemplateKey as ReportsSystemGeneratedAnalyticsTemplateKey);
}

export function resolveReportTemplateFilterKeys(templateKey: string) {
  const normalizedTemplateKey = normalizeReportTemplateKey(templateKey);
  const matchingLegacyKeys = Object.entries(LEGACY_ANALYTICS_TEMPLATE_KEY_ALIASES)
    .filter(([, value]) => value === normalizedTemplateKey)
    .map(([key]) => key);

  return Array.from(new Set([normalizedTemplateKey, ...matchingLegacyKeys]));
}

export function getReportTemplateKeysForCategory(category: ReportsTemplateCategoryKey) {
  if (category === "documents") {
    return OPERATIONAL_DOCUMENT_TEMPLATES.map((template) => template.key);
  }

  return ANALYTICS_REPORT_TEMPLATES
    .filter((template) => template.category === category)
    .flatMap((template) => resolveReportTemplateFilterKeys(template.key));
}
