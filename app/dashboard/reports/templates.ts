import type {
  AnalyticsReportTemplateKey,
  OperationalDocumentTemplateKey,
  ReportsAnalyticsTemplateOption,
} from "@/app/dashboard/reports/types";

type AnalyticsTemplateDefinition = {
  key: AnalyticsReportTemplateKey;
  label: string;
  description: string;
  dateMode: "none" | "month" | "range";
  minBranchCount: number;
};

export const ANALYTICS_REPORT_TEMPLATES: AnalyticsTemplateDefinition[] = [
  {
    key: "financial_overview",
    label: "Financial Overview",
    description:
      "Flexible financial reporting template for collections, expenses, and live-loan exposure across the selected date range.",
    dateMode: "range",
    minBranchCount: 1,
  },
  {
    key: "monthly_collections_summary",
    label: "Monthly Collections Summary",
    description:
      "Monthly collection totals, daily activity trend, and missed-payment signals across the selected branches.",
    dateMode: "month",
    minBranchCount: 1,
  },
  {
    key: "active_loans_summary",
    label: "Active Loans Summary",
    description:
      "Snapshot of active and overdue loans, exposure totals, and selected-branch live-loan summary.",
    dateMode: "none",
    minBranchCount: 1,
  },
  {
    key: "branch_performance_comparison",
    label: "Branch Performance Comparison",
    description:
      "Selected-branch comparison of borrowers, collectors, active loans, overdue loans, and monthly collections.",
    dateMode: "month",
    minBranchCount: 2,
  },
];

type OperationalDocumentTemplateDefinition = {
  key: OperationalDocumentTemplateKey;
  label: string;
  description: string;
  sourceEntityType: "loan" | "collection";
};

export const OPERATIONAL_DOCUMENT_TEMPLATES: OperationalDocumentTemplateDefinition[] = [
  {
    key: "borrower_loan_schedule",
    label: "Borrower Loan Schedule",
    description:
      "Loan-scoped schedule summary document generated from a saved loan record.",
    sourceEntityType: "loan",
  },
  {
    key: "collection_receipt",
    label: "Collection Receipt",
    description:
      "Single collection receipt generated from a saved collection entry.",
    sourceEntityType: "collection",
  },
  {
    key: "loan_receipt_summary",
    label: "Loan Receipt Summary",
    description:
      "Whole-loan payment summary document with saved collection history context.",
    sourceEntityType: "loan",
  },
];

export function getAnalyticsTemplateDefinition(key: AnalyticsReportTemplateKey) {
  return ANALYTICS_REPORT_TEMPLATES.find((template) => template.key === key) ?? null;
}

export function getOperationalDocumentTemplateDefinition(
  key: OperationalDocumentTemplateKey,
) {
  return OPERATIONAL_DOCUMENT_TEMPLATES.find((template) => template.key === key) ?? null;
}

export function resolveReportTemplateLabel(templateKey: string) {
  const analyticsTemplate = ANALYTICS_REPORT_TEMPLATES.find((template) => template.key === templateKey);
  if (analyticsTemplate) {
    return analyticsTemplate.label;
  }

  const documentTemplate = OPERATIONAL_DOCUMENT_TEMPLATES.find((template) => template.key === templateKey);
  if (documentTemplate) {
    return documentTemplate.label;
  }

  return templateKey;
}

export function buildAnalyticsTemplateOptions(
  branchCount: number,
  canAccessAnalytics: boolean,
): ReportsAnalyticsTemplateOption[] {
  return ANALYTICS_REPORT_TEMPLATES.map((template) => {
    const available = canAccessAnalytics && branchCount >= template.minBranchCount;

    return {
      ...template,
      available,
      availabilityNote: available
        ? null
        : template.minBranchCount > 1
          ? "This template requires at least two selected branches in your current scope."
          : "Analytical report generation is not available for your current role.",
    };
  });
}
