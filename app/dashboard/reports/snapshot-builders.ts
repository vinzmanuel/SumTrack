import type {
  AnalyticsReportTemplateKey,
  OperationalDocumentTemplateKey,
} from "@/app/dashboard/reports/types";

type SnapshotSummaryCard = {
  key: string;
  label: string;
  value: number | string;
  format?: "currency" | "number" | "text";
};

type SnapshotSection =
  | {
      key: string;
      title: string;
      type: "chart";
      chartType: "bar" | "line";
      series: Array<{ key: string; label: string; color: string }>;
      rows: Array<{ bucket: string; values: Record<string, number> }>;
    }
  | {
      key: string;
      title: string;
      type: "table";
      columns: Array<{ key: string; label: string; format?: "currency" | "number" | "text" }>;
      rows: Array<Record<string, number | string>>;
    }
  | {
      key: string;
      title: string;
      type: "field_list";
      rows: Array<{ label: string; value: string }>;
    };

export type AnalyticsReportSnapshot = {
  version: 1;
  category: "analytics";
  templateKey: AnalyticsReportTemplateKey;
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summaryCards: SnapshotSummaryCard[];
  sections: SnapshotSection[];
  meta: Record<string, number | string>;
};

export type OperationalDocumentSnapshot = {
  version: 1;
  category: "document";
  templateKey: OperationalDocumentTemplateKey;
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summaryCards: SnapshotSummaryCard[];
  sections: SnapshotSection[];
  meta: Record<string, number | string>;
};

function buildBaseSnapshot(params: {
  templateKey: AnalyticsReportTemplateKey;
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summaryCards: SnapshotSummaryCard[];
  sections: SnapshotSection[];
  meta: Record<string, number | string>;
}): AnalyticsReportSnapshot {
  return {
    version: 1,
    category: "analytics",
    templateKey: params.templateKey,
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: params.summaryCards,
    sections: params.sections,
    meta: params.meta,
  };
}

function buildDocumentSnapshot(params: {
  templateKey: OperationalDocumentTemplateKey;
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summaryCards: SnapshotSummaryCard[];
  sections: SnapshotSection[];
  meta: Record<string, number | string>;
}): OperationalDocumentSnapshot {
  return {
    version: 1,
    category: "document",
    templateKey: params.templateKey,
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: params.summaryCards,
    sections: params.sections,
    meta: params.meta,
  };
}

export function buildFinancialOverviewSnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summary: {
    collectionsTotal: number;
    expensesTotal: number;
    netTotal: number;
    activeLoans: number;
    overdueLoans: number;
    outstandingBalance: number;
  };
  branchRows: Array<{
    branchName: string;
    collectionsAmount: number;
    expensesAmount: number;
    netAmount: number;
    activeLoans: number;
    overdueLoans: number;
    outstandingBalance: number;
  }>;
}) {
  return buildBaseSnapshot({
    templateKey: "financial_overview",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "collections", label: "Collections", value: params.summary.collectionsTotal, format: "currency" },
      { key: "expenses", label: "Expenses", value: params.summary.expensesTotal, format: "currency" },
      { key: "net", label: "Net Operational Delta", value: params.summary.netTotal, format: "currency" },
      { key: "activeLoans", label: "Active Loans", value: params.summary.activeLoans, format: "number" },
      { key: "overdueLoans", label: "Overdue Loans", value: params.summary.overdueLoans, format: "number" },
      {
        key: "outstandingBalance",
        label: "Outstanding Balance",
        value: params.summary.outstandingBalance,
        format: "currency",
      },
    ],
    sections: [
      {
        key: "branchFinancialSummary",
        title: "Branch Financial Summary",
        type: "table",
        columns: [
          { key: "branchName", label: "Branch" },
          { key: "collectionsAmount", label: "Collections", format: "currency" },
          { key: "expensesAmount", label: "Expenses", format: "currency" },
          { key: "netAmount", label: "Net Delta", format: "currency" },
          { key: "activeLoans", label: "Active Loans", format: "number" },
          { key: "overdueLoans", label: "Overdue Loans", format: "number" },
          { key: "outstandingBalance", label: "Outstanding Balance", format: "currency" },
        ],
        rows: params.branchRows,
      },
    ],
    meta: {
      branchCount: params.branchRows.length,
    },
  });
}

export function buildMonthlyCollectionsSummarySnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summary: {
    totalAmount: number;
    totalEntries: number;
    averageAmount: number;
    missedPayments: number;
  };
  trendRows: Array<{ bucket: string; values: Record<string, number> }>;
  branchRows: Array<{
    branchName: string;
    totalAmount: number;
    totalEntries: number;
    missedPayments: number;
  }>;
  bucketRows: Array<{
    label: string;
    entries: number;
    amount: number;
  }>;
}) {
  return buildBaseSnapshot({
    templateKey: "monthly_collections_summary",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "totalAmount", label: "Total Collections", value: params.summary.totalAmount, format: "currency" },
      { key: "totalEntries", label: "Collection Entries", value: params.summary.totalEntries, format: "number" },
      { key: "averageAmount", label: "Average Amount", value: params.summary.averageAmount, format: "currency" },
      { key: "missedPayments", label: "Missed Payments", value: params.summary.missedPayments, format: "number" },
    ],
    sections: [
      {
        key: "dailyTrend",
        title: "Daily Collections Trend",
        type: "chart",
        chartType: "bar",
        series: [{ key: "collections", label: "Collections", color: "#16a34a" }],
        rows: params.trendRows,
      },
      {
        key: "branchBreakdown",
        title: "Branch Breakdown",
        type: "table",
        columns: [
          { key: "branchName", label: "Branch" },
          { key: "totalAmount", label: "Collections", format: "currency" },
          { key: "totalEntries", label: "Entries", format: "number" },
          { key: "missedPayments", label: "Missed Payments", format: "number" },
        ],
        rows: params.branchRows,
      },
      {
        key: "amountBuckets",
        title: "Amount Buckets",
        type: "table",
        columns: [
          { key: "label", label: "Bucket" },
          { key: "entries", label: "Entries", format: "number" },
          { key: "amount", label: "Amount", format: "currency" },
        ],
        rows: params.bucketRows,
      },
    ],
    meta: {
      branchCount: params.branchRows.length,
      bucketCount: params.bucketRows.length,
    },
  });
}

export function buildActiveLoansSummarySnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summary: {
    activeLoans: number;
    overdueLoans: number;
    principalExposure: number;
    outstandingBalance: number;
  };
  branchRows: Array<{
    branchName: string;
    activeLoans: number;
    overdueLoans: number;
    principalExposure: number;
    outstandingBalance: number;
  }>;
  collectorRows: Array<{
    collectorName: string;
    liveLoanCount: number;
    overdueLoanCount: number;
    principalExposure: number;
    outstandingBalance: number;
  }>;
}) {
  return buildBaseSnapshot({
    templateKey: "active_loans_summary",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "activeLoans", label: "Active Loans", value: params.summary.activeLoans, format: "number" },
      { key: "overdueLoans", label: "Overdue Loans", value: params.summary.overdueLoans, format: "number" },
      {
        key: "principalExposure",
        label: "Principal Exposure",
        value: params.summary.principalExposure,
        format: "currency",
      },
      {
        key: "outstandingBalance",
        label: "Outstanding Balance",
        value: params.summary.outstandingBalance,
        format: "currency",
      },
    ],
    sections: [
      {
        key: "branchLiveLoans",
        title: "Live Loans by Branch",
        type: "table",
        columns: [
          { key: "branchName", label: "Branch" },
          { key: "activeLoans", label: "Active Loans", format: "number" },
          { key: "overdueLoans", label: "Overdue Loans", format: "number" },
          { key: "principalExposure", label: "Principal Exposure", format: "currency" },
          { key: "outstandingBalance", label: "Outstanding Balance", format: "currency" },
        ],
        rows: params.branchRows,
      },
      {
        key: "collectorSummary",
        title: "Collector Summary",
        type: "table",
        columns: [
          { key: "collectorName", label: "Collector" },
          { key: "liveLoanCount", label: "Live Loans", format: "number" },
          { key: "overdueLoanCount", label: "Overdue Loans", format: "number" },
          { key: "principalExposure", label: "Principal Exposure", format: "currency" },
          { key: "outstandingBalance", label: "Outstanding Balance", format: "currency" },
        ],
        rows: params.collectorRows,
      },
    ],
    meta: {
      branchCount: params.branchRows.length,
      collectorCount: params.collectorRows.length,
    },
  });
}

export function buildBranchPerformanceComparisonSnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summary: {
    branchesCompared: number;
    totalBorrowers: number;
    totalCollectors: number;
    totalActiveLoans: number;
    totalOverdueLoans: number;
    totalCollections: number;
  };
  branchRows: Array<{
    branchName: string;
    borrowerCount: number;
    collectorCount: number;
    activeLoanCount: number;
    overdueLoanCount: number;
    collectionsThisMonth: number;
  }>;
}) {
  return buildBaseSnapshot({
    templateKey: "branch_performance_comparison",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "branchesCompared", label: "Branches Compared", value: params.summary.branchesCompared, format: "number" },
      { key: "totalBorrowers", label: "Borrowers", value: params.summary.totalBorrowers, format: "number" },
      { key: "totalCollectors", label: "Collectors", value: params.summary.totalCollectors, format: "number" },
      { key: "totalActiveLoans", label: "Active Loans", value: params.summary.totalActiveLoans, format: "number" },
      { key: "totalOverdueLoans", label: "Overdue Loans", value: params.summary.totalOverdueLoans, format: "number" },
      {
        key: "totalCollections",
        label: "Collections This Month",
        value: params.summary.totalCollections,
        format: "currency",
      },
    ],
    sections: [
      {
        key: "branchComparison",
        title: "Selected Branch Comparison",
        type: "table",
        columns: [
          { key: "branchName", label: "Branch" },
          { key: "borrowerCount", label: "Borrowers", format: "number" },
          { key: "collectorCount", label: "Collectors", format: "number" },
          { key: "activeLoanCount", label: "Active Loans", format: "number" },
          { key: "overdueLoanCount", label: "Overdue Loans", format: "number" },
          { key: "collectionsThisMonth", label: "Collections", format: "currency" },
        ],
        rows: params.branchRows,
      },
    ],
    meta: {
      branchCount: params.branchRows.length,
    },
  });
}

export function buildBorrowerLoanScheduleSnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  borrowerName: string;
  borrowerCompanyId: string;
  borrowerAddress: string;
  branchName: string;
  branchAddress: string;
  areaCode: string;
  collectorName: string;
  loanCode: string;
  startDate: string;
  dueDate: string;
  termDays: number | null;
  status: string;
  principal: number;
  interestRate: number;
  totalPayable: number;
  estimatedDailyPayment: number | null;
  totalPaid: number;
  outstandingBalance: number;
}) {
  return buildDocumentSnapshot({
    templateKey: "borrower_loan_schedule",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "totalPayable", label: "Total Payable", value: params.totalPayable, format: "currency" },
      { key: "totalPaid", label: "Total Paid", value: params.totalPaid, format: "currency" },
      {
        key: "outstandingBalance",
        label: "Outstanding Balance",
        value: params.outstandingBalance,
        format: "currency",
      },
    ],
    sections: [
      {
        key: "borrowerDetails",
        title: "Borrower Details",
        type: "field_list",
        rows: [
          { label: "Borrower", value: params.borrowerName },
          { label: "Company ID", value: params.borrowerCompanyId },
          { label: "Address", value: params.borrowerAddress },
          { label: "Branch", value: params.branchName },
          { label: "Branch Address", value: params.branchAddress },
          { label: "Area", value: params.areaCode },
        ],
      },
      {
        key: "loanScheduleSummary",
        title: "Loan Schedule Summary",
        type: "field_list",
        rows: [
          { label: "Loan Code", value: params.loanCode },
          { label: "Collector", value: params.collectorName },
          { label: "Status", value: params.status },
          { label: "Start Date", value: params.startDate },
          { label: "Due Date", value: params.dueDate },
          { label: "Term (Days)", value: params.termDays !== null ? String(params.termDays) : "N/A" },
          { label: "Principal", value: String(params.principal) },
          { label: "Interest Rate", value: `${params.interestRate}%` },
          { label: "Total Payable", value: String(params.totalPayable) },
          {
            label: "Estimated Daily Payment",
            value: params.estimatedDailyPayment !== null ? String(params.estimatedDailyPayment) : "N/A",
          },
        ],
      },
    ],
    meta: {
      loanCode: params.loanCode,
    },
  });
}

export function buildCollectionReceiptSnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  collectionCode: string;
  collectionDate: string;
  amount: number;
  note: string | null;
  loanCode: string;
  borrowerName: string;
  borrowerCompanyId: string;
  branchName: string;
  collectorName: string;
  encodedByName: string;
}) {
  return buildDocumentSnapshot({
    templateKey: "collection_receipt",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "amount", label: "Amount", value: params.amount, format: "currency" },
    ],
    sections: [
      {
        key: "receiptDetails",
        title: "Receipt Details",
        type: "field_list",
        rows: [
          { label: "Collection Code", value: params.collectionCode },
          { label: "Collection Date", value: params.collectionDate },
          { label: "Loan Code", value: params.loanCode },
          { label: "Borrower", value: params.borrowerName },
          { label: "Borrower Company ID", value: params.borrowerCompanyId },
          { label: "Branch", value: params.branchName },
          { label: "Collector", value: params.collectorName },
          { label: "Encoded By", value: params.encodedByName },
          { label: "Amount", value: String(params.amount) },
          { label: "Note", value: params.note ?? "-" },
        ],
      },
    ],
    meta: {
      collectionCode: params.collectionCode,
    },
  });
}

export function buildLoanReceiptSummarySnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  loanCode: string;
  borrowerName: string;
  borrowerCompanyId: string;
  branchName: string;
  areaCode: string;
  collectorName: string;
  status: string;
  totalPayable: number;
  totalPaid: number;
  outstandingBalance: number;
  collectionRows: Array<{
    collectionCode: string;
    collectionDate: string;
    amount: number;
    collectorName: string;
    note: string;
    outstandingBalance: number;
  }>;
}) {
  return buildDocumentSnapshot({
    templateKey: "loan_receipt_summary",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "totalPayable", label: "Total Payable", value: params.totalPayable, format: "currency" },
      { key: "totalPaid", label: "Total Paid", value: params.totalPaid, format: "currency" },
      {
        key: "outstandingBalance",
        label: "Outstanding Balance",
        value: params.outstandingBalance,
        format: "currency",
      },
      { key: "collectionCount", label: "Collections", value: params.collectionRows.length, format: "number" },
    ],
    sections: [
      {
        key: "loanReceiptHeader",
        title: "Loan Receipt Summary",
        type: "field_list",
        rows: [
          { label: "Loan Code", value: params.loanCode },
          { label: "Borrower", value: params.borrowerName },
          { label: "Borrower Company ID", value: params.borrowerCompanyId },
          { label: "Branch", value: params.branchName },
          { label: "Area", value: params.areaCode },
          { label: "Collector", value: params.collectorName },
          { label: "Status", value: params.status },
        ],
      },
      {
        key: "collectionHistory",
        title: "Collection History",
        type: "table",
        columns: [
          { key: "collectionCode", label: "Collection Code" },
          { key: "collectionDate", label: "Date" },
          { key: "amount", label: "Amount", format: "currency" },
          { key: "collectorName", label: "Collector" },
          { key: "note", label: "Note" },
          { key: "outstandingBalance", label: "Outstanding Balance", format: "currency" },
        ],
        rows: params.collectionRows,
      },
    ],
    meta: {
      loanCode: params.loanCode,
    },
  });
}
