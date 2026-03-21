import type {
  AnalyticsReportSnapshot,
  AnalyticsReportTemplateKey,
  OperationalDocumentSnapshot,
  OperationalDocumentTemplateKey,
  ReportsSnapshotSection,
  ReportsSnapshotSummaryItem,
} from "@/app/dashboard/reports/types";

function buildBaseSnapshot(params: {
  templateKey: AnalyticsReportTemplateKey;
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summaryCards: ReportsSnapshotSummaryItem[];
  sections: ReportsSnapshotSection[];
  meta: Record<string, number | string | boolean | null>;
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
  summaryCards: ReportsSnapshotSummaryItem[];
  sections: ReportsSnapshotSection[];
  meta: Record<string, number | string | boolean | null>;
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
    incentivesTotal: number;
    netTotal: number;
  };
  periodRows: Array<{
    bucket: string;
    collectionsAmount: number;
    expensesAmount: number;
    incentivesAmount: number;
    netAmount: number;
  }>;
  branchRows: Array<{
    branchName: string;
    collectionsAmount: number;
    expensesAmount: number;
    incentivesAmount: number;
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
      { key: "incentives", label: "Incentives", value: params.summary.incentivesTotal, format: "currency" },
      { key: "net", label: "Net", value: params.summary.netTotal, format: "currency" },
    ],
    sections: [
      {
        key: "financialTrend",
        title: "Financial Trend",
        type: "chart",
        chartType: "composed",
        valueFormat: "currency",
        series: [
          { key: "collections", label: "Collections", color: "#16a34a", type: "bar" },
          { key: "expenses", label: "Expenses", color: "#f59e0b", type: "bar" },
          { key: "incentives", label: "Incentives", color: "#6366f1", type: "bar" },
          { key: "net", label: "Net", color: "#0f172a", type: "line" },
        ],
        rows: params.periodRows.map((row) => ({
          bucket: row.bucket,
          values: {
            collections: row.collectionsAmount,
            expenses: row.expensesAmount,
            incentives: row.incentivesAmount,
            net: row.netAmount,
          },
        })),
      },
      {
        key: "periodBreakdown",
        title: "Period Breakdown",
        type: "table",
        columns: [
          { key: "bucket", label: "Period Bucket" },
          { key: "collectionsAmount", label: "Collections", format: "currency" },
          { key: "expensesAmount", label: "Expenses", format: "currency" },
          { key: "incentivesAmount", label: "Incentives", format: "currency" },
          { key: "netAmount", label: "Net", format: "currency" },
        ],
        rows: params.periodRows,
      },
      {
        key: "branchFinancialSummary",
        title: "Branch Financial Summary",
        type: "table",
        columns: [
          { key: "branchName", label: "Branch" },
          { key: "collectionsAmount", label: "Collections", format: "currency" },
          { key: "expensesAmount", label: "Expenses", format: "currency" },
          { key: "incentivesAmount", label: "Incentives", format: "currency" },
          { key: "netAmount", label: "Net", format: "currency" },
          { key: "activeLoans", label: "Active Loans", format: "number" },
          { key: "overdueLoans", label: "Overdue Loans", format: "number" },
          { key: "outstandingBalance", label: "Outstanding Balance", format: "currency" },
        ],
        rows: params.branchRows,
      },
    ],
    meta: {
      branchCount: params.branchRows.length,
      bucketCount: params.periodRows.length,
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
    averagePerDay: number;
    highestCollectionDay: string;
  };
  chartSeries: Array<{ key: string; label: string; color: string }>;
  trendRows: Array<{ bucket: string; values: Record<string, number> }>;
  rawColumns: Array<{ key: string; label: string; format?: "currency" | "number" | "text" }>;
  rawRows: Array<Record<string, number | string>>;
  branchRows: Array<Record<string, number | string>>;
}) {
  return buildBaseSnapshot({
    templateKey: "monthly_collections_summary",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "totalAmount", label: "Total Collections", value: params.summary.totalAmount, format: "currency" },
      { key: "totalEntries", label: "Collection Entries", value: params.summary.totalEntries, format: "number" },
      { key: "averagePerDay", label: "Average per Day", value: params.summary.averagePerDay, format: "currency" },
      { key: "highestCollectionDay", label: "Highest Collection Day", value: params.summary.highestCollectionDay, format: "text" },
    ],
    sections: [
      {
        key: "dailyTrend",
        title: "Daily Collections Trend",
        type: "chart",
        chartType: "line",
        valueFormat: "currency",
        series: params.chartSeries,
        rows: params.trendRows,
      },
      {
        key: "dailyRawData",
        title: "Daily Collections Raw Data",
        type: "table",
        columns: params.rawColumns,
        rows: params.rawRows,
      },
      {
        key: "branchBreakdown",
        title: "Branch Breakdown",
        type: "table",
        columns: [
          { key: "branchName", label: "Branch" },
          { key: "totalAmount", label: "Collections", format: "currency" },
          { key: "totalEntries", label: "Entries", format: "number" },
          { key: "averageAmount", label: "Average Amount", format: "currency" },
        ],
        rows: params.branchRows,
      },
    ],
    meta: {
      branchCount: params.branchRows.length,
      bucketCount: params.trendRows.length,
    },
  });
}

export function buildActiveLoansSummarySnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summary: {
    activeLoanCount: number;
    overdueLoanCount: number;
    outstandingBalance: number;
    borrowerCount: number;
    averageOutstandingPerLoan: number;
  };
  chartRows: Array<{ bucket: string; values: Record<string, number> }>;
  branchRows: Array<{
    branchName: string;
    borrowerCount: number;
    activeLoans: number;
    overdueLoans: number;
    principalExposure: number;
    outstandingBalance: number;
    averageOutstandingPerLoan: number;
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
      { key: "activeLoans", label: "Active Loans", value: params.summary.activeLoanCount, format: "number" },
      { key: "borrowerCount", label: "Borrowers", value: params.summary.borrowerCount, format: "number" },
      {
        key: "outstandingBalance",
        label: "Outstanding Balance",
        value: params.summary.outstandingBalance,
        format: "currency",
      },
      {
        key: "averageOutstandingPerLoan",
        label: "Average Outstanding per Loan",
        value: params.summary.averageOutstandingPerLoan,
        format: "currency",
      },
    ],
    sections: [
      {
        key: "activeLoansByBranch",
        title: "Active Loans by Branch",
        type: "chart",
        chartType: "bar",
        valueFormat: "number",
        series: [{ key: "activeLoans", label: "Active Loans", color: "#16a34a", type: "bar" }],
        rows: params.chartRows,
      },
      {
        key: "branchLiveLoans",
        title: "Live Loans by Branch",
        type: "table",
        columns: [
          { key: "branchName", label: "Branch" },
          { key: "borrowerCount", label: "Borrowers", format: "number" },
          { key: "activeLoans", label: "Active Loans", format: "number" },
          { key: "overdueLoans", label: "Overdue Loans", format: "number" },
          { key: "principalExposure", label: "Principal Exposure", format: "currency" },
          { key: "outstandingBalance", label: "Outstanding Balance", format: "currency" },
          { key: "averageOutstandingPerLoan", label: "Average Outstanding / Loan", format: "currency" },
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
      overdueLoanCount: params.summary.overdueLoanCount,
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
    totalCollections: number;
    totalExpenses: number;
    totalIncentives: number;
    totalNet: number;
    totalActiveLoans: number;
    totalOverdueLoans: number;
    totalCompletedLoans: number;
  };
  branchRows: Array<{
    branchName: string;
    borrowerCount: number;
    collectionsAmount: number;
    expensesAmount: number;
    incentivesAmount: number;
    netAmount: number;
    activeLoanCount: number;
    overdueLoanCount: number;
    completedLoanCount: number;
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
      { key: "totalCollections", label: "Collections", value: params.summary.totalCollections, format: "currency" },
      { key: "totalExpenses", label: "Expenses", value: params.summary.totalExpenses, format: "currency" },
      { key: "totalIncentives", label: "Incentives", value: params.summary.totalIncentives, format: "currency" },
      { key: "totalNet", label: "Net", value: params.summary.totalNet, format: "currency" },
      { key: "totalActiveLoans", label: "Active Loans", value: params.summary.totalActiveLoans, format: "number" },
      { key: "totalOverdueLoans", label: "Overdue Loans", value: params.summary.totalOverdueLoans, format: "number" },
      { key: "totalCompletedLoans", label: "Completed Loans", value: params.summary.totalCompletedLoans, format: "number" },
    ],
    sections: [
      {
        key: "financialComparison",
        title: "Financial Comparison",
        type: "chart",
        chartType: "bar",
        valueFormat: "currency",
        series: [
          { key: "collections", label: "Collections", color: "#16a34a", type: "bar" },
          { key: "expenses", label: "Expenses", color: "#f59e0b", type: "bar" },
          { key: "incentives", label: "Incentives", color: "#6366f1", type: "bar" },
          { key: "net", label: "Net", color: "#0f172a", type: "bar" },
        ],
        rows: params.branchRows.map((row) => ({
          bucket: row.branchName,
          values: {
            collections: row.collectionsAmount,
            expenses: row.expensesAmount,
            incentives: row.incentivesAmount,
            net: row.netAmount,
          },
        })),
      },
      {
        key: "operationalComparison",
        title: "Operational Comparison",
        type: "chart",
        chartType: "bar",
        valueFormat: "number",
        series: [
          { key: "borrowers", label: "Borrowers", color: "#16a34a", type: "bar" },
          { key: "activeLoans", label: "Active Loans", color: "#0ea5e9", type: "bar" },
          { key: "overdueLoans", label: "Overdue Loans", color: "#f59e0b", type: "bar" },
          { key: "completedLoans", label: "Completed Loans", color: "#64748b", type: "bar" },
        ],
        rows: params.branchRows.map((row) => ({
          bucket: row.branchName,
          values: {
            borrowers: row.borrowerCount,
            activeLoans: row.activeLoanCount,
            overdueLoans: row.overdueLoanCount,
            completedLoans: row.completedLoanCount,
          },
        })),
      },
      {
        key: "branchComparison",
        title: "Selected Branch Comparison",
        type: "table",
        columns: [
          { key: "branchName", label: "Branch" },
          { key: "collectionsAmount", label: "Collections", format: "currency" },
          { key: "expensesAmount", label: "Expenses", format: "currency" },
          { key: "incentivesAmount", label: "Incentives", format: "currency" },
          { key: "netAmount", label: "Net", format: "currency" },
          { key: "borrowerCount", label: "Borrowers", format: "number" },
          { key: "activeLoanCount", label: "Active Loans", format: "number" },
          { key: "overdueLoanCount", label: "Overdue Loans", format: "number" },
          { key: "completedLoanCount", label: "Completed Loans", format: "number" },
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
  scheduleRows: Array<{
    date: string;
    principalPlusInterest: number;
    dailyPayment: number;
    outstandingBalance: number;
    amount: number;
    collector: string;
    note: string;
  }>;
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
        key: "loanSummary",
        title: "Loan Summary",
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
      {
        key: "loanScheduleTable",
        title: "Loan Schedule",
        type: "table",
        columns: [
          { key: "date", label: "Date" },
          { key: "principalPlusInterest", label: "Principal + Interest", format: "currency" },
          { key: "dailyPayment", label: "Daily Payment", format: "currency" },
          { key: "outstandingBalance", label: "Outstanding Balance", format: "currency" },
          { key: "amount", label: "Amount", format: "currency" },
          { key: "collector", label: "Collector" },
          { key: "note", label: "Note" },
        ],
        rows: params.scheduleRows,
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
  branchAddress: string;
  remainingBalanceAfterPayment: number;
}) {
  return buildDocumentSnapshot({
    templateKey: "collection_receipt",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "amount", label: "Amount", value: params.amount, format: "currency" },
      {
        key: "remainingBalanceAfterPayment",
        label: "Remaining Balance After Payment",
        value: params.remainingBalanceAfterPayment,
        format: "currency",
      },
    ],
    sections: [
      {
        key: "receiptHeader",
        title: "Branch Header",
        type: "field_list",
        rows: [
          { label: "Branch", value: params.branchName },
          { label: "Branch Address", value: params.branchAddress },
        ],
      },
      {
        key: "receiptDetails",
        title: "Receipt Details",
        type: "field_list",
        rows: [
          { label: "Receipt No.", value: params.collectionCode },
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
      {
        key: "paymentDetails",
        title: "Payment Details",
        type: "field_list",
        rows: [
          { label: "Amount Paid", value: String(params.amount) },
          { label: "Remaining Balance After Payment", value: String(params.remainingBalanceAfterPayment) },
          { label: "Encoded By", value: params.encodedByName },
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
  startDate: string;
  completionDate: string;
  principal: number;
  interestRate: number;
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
          { label: "Release Date", value: params.startDate },
          { label: "Completion Date", value: params.completionDate },
          { label: "Principal", value: String(params.principal) },
          { label: "Interest", value: `${params.interestRate}%` },
          { label: "Principal + Interest", value: String(params.totalPayable) },
          { label: "Total Paid", value: String(params.totalPaid) },
          { label: "Remaining Balance", value: String(params.outstandingBalance) },
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
      {
        key: "completionStatement",
        title: "Completion Statement",
        type: "field_list",
        rows: [
          {
            label: "Statement",
            value:
              params.outstandingBalance <= 0
                ? "This loan has been fully paid based on the saved report snapshot."
                : "This saved snapshot still shows a remaining balance.",
          },
        ],
      },
    ],
    meta: {
      loanCode: params.loanCode,
    },
  });
}
