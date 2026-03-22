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
    netTotal: number;
  };
  periodRows: Array<{
    bucket: string;
    collectionsAmount: number;
    expensesAmount: number;
    netAmount: number;
  }>;
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
          { key: "net", label: "Net", color: "#0f172a", type: "line" },
        ],
        rows: params.periodRows.map((row) => ({
          bucket: row.bucket,
          values: {
            collections: row.collectionsAmount,
            expenses: row.expensesAmount,
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

export function buildCollectionsSummarySnapshot(params: {
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
  bucketMode: "day" | "week" | "month";
}) {
  return buildBaseSnapshot({
    templateKey: "collections_summary",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "totalAmount", label: "Total Collections", value: params.summary.totalAmount, format: "currency" },
      { key: "totalEntries", label: "Collection Entries", value: params.summary.totalEntries, format: "number" },
      {
        key: "averagePerDay",
        label:
          params.bucketMode === "day"
            ? "Average per Day"
            : params.bucketMode === "week"
              ? "Average per Week"
              : "Average per Month",
        value: params.summary.averagePerDay,
        format: "currency",
      },
      {
        key: "highestCollectionDay",
        label:
          params.bucketMode === "day"
            ? "Highest Collection Day"
            : params.bucketMode === "week"
              ? "Highest Collection Week"
              : "Highest Collection Month",
        value: params.summary.highestCollectionDay,
        format: "text",
      },
    ],
    sections: [
      {
        key: "collectionsTrend",
        title:
          params.bucketMode === "day"
            ? "Daily Collections Trend"
            : params.bucketMode === "week"
              ? "Weekly Collections Trend"
              : "Monthly Collections Trend",
        type: "chart",
        chartType: "line",
        valueFormat: "currency",
        series: params.chartSeries,
        rows: params.trendRows,
      },
      {
        key: "collectionsRawData",
        title:
          params.bucketMode === "day"
            ? "Daily Collections Raw Data"
            : params.bucketMode === "week"
              ? "Weekly Collections Raw Data"
              : "Monthly Collections Raw Data",
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
      bucketMode: params.bucketMode,
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
  comparisonNote?: string | null;
  summary: {
    branchesCompared: number;
    totalBorrowers: number;
    totalCollections: number;
    totalExpenses: number;
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
        note: params.comparisonNote ?? undefined,
        series: [
          { key: "collections", label: "Collections", color: "#16a34a", type: "bar" },
          { key: "expenses", label: "Expenses", color: "#f59e0b", type: "bar" },
          { key: "net", label: "Net", color: "#0f172a", type: "bar" },
        ],
        rows: params.branchRows.map((row) => ({
          bucket: row.branchName,
          values: {
            collections: row.collectionsAmount,
            expenses: row.expensesAmount,
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
        note: params.comparisonNote ?? undefined,
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

export function buildLoansSummarySnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summary: {
    activeLoansAtPeriodEnd: number;
    loansThatBecameOverdue: number;
    closedLoansInPeriod: number;
    outstandingBalanceAtPeriodEnd: number;
  };
  chartRows: Array<{ bucket: string; values: Record<string, number> }>;
  rawRows: Array<{ metric: string; value: number }>;
}) {
  return buildBaseSnapshot({
    templateKey: "loans_summary",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "activeLoansAtPeriodEnd", label: "Active Loans at Period End", value: params.summary.activeLoansAtPeriodEnd, format: "number" },
      { key: "loansThatBecameOverdue", label: "Became Overdue", value: params.summary.loansThatBecameOverdue, format: "number" },
      { key: "closedLoansInPeriod", label: "Closed Loans", value: params.summary.closedLoansInPeriod, format: "number" },
      { key: "outstandingBalanceAtPeriodEnd", label: "Outstanding Balance", value: params.summary.outstandingBalanceAtPeriodEnd, format: "currency" },
    ],
    sections: [
      {
        key: "loansSummaryChart",
        title: "Loan-State Summary",
        type: "chart",
        chartType: "bar",
        valueFormat: "number",
        series: [
          { key: "activeLoans", label: "Active Loans", color: "#16a34a", type: "bar" },
          { key: "becameOverdue", label: "Became Overdue", color: "#f59e0b", type: "bar" },
          { key: "closedLoans", label: "Closed Loans", color: "#0ea5e9", type: "bar" },
        ],
        rows: params.chartRows,
      },
      {
        key: "loansSummaryRawData",
        title: "Loan Summary Metrics",
        type: "table",
        columns: [
          { key: "metric", label: "Metric" },
          { key: "value", label: "Value", format: "text" },
        ],
        rows: params.rawRows.map((row) => ({
          metric: row.metric,
          value:
            row.metric === "Outstanding Balance at Period End"
              ? `₱${row.value.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : row.value.toLocaleString("en-PH"),
        })),
      },
    ],
    meta: {
      metricCount: params.rawRows.length,
    },
  });
}

export function buildBranchPerformanceOverviewSnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  branchName: string;
  summary: {
    collections: number;
    expenses: number;
    net: number;
    borrowersWithActiveLoans: number;
    borrowersWithOverdueLoans: number;
    activeLoans: number;
    overdueLoans: number;
    closedLoans: number;
  };
  financialChartRows: Array<{ bucket: string; values: Record<string, number> }>;
  operationalChartRows: Array<{ bucket: string; values: Record<string, number> }>;
  rawRows: Array<{ metric: string; value: number; valueFormat: "currency" | "number" }>;
}) {
  return buildBaseSnapshot({
    templateKey: "branch_performance_overview",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "collections", label: "Collections", value: params.summary.collections, format: "currency" },
      { key: "expenses", label: "Expenses", value: params.summary.expenses, format: "currency" },
      { key: "net", label: "Net", value: params.summary.net, format: "currency" },
      { key: "borrowersWithActiveLoans", label: "Borrowers with Active Loans", value: params.summary.borrowersWithActiveLoans, format: "number" },
      { key: "borrowersWithOverdueLoans", label: "Borrowers with Overdue Loans", value: params.summary.borrowersWithOverdueLoans, format: "number" },
      { key: "activeLoans", label: "Active Loans", value: params.summary.activeLoans, format: "number" },
      { key: "overdueLoans", label: "Overdue Loans", value: params.summary.overdueLoans, format: "number" },
      { key: "closedLoans", label: "Closed Loans", value: params.summary.closedLoans, format: "number" },
    ],
    sections: [
      {
        key: "branchPerformanceOverviewFinancial",
        title: "Financial Overview",
        type: "chart",
        chartType: "bar",
        valueFormat: "currency",
        series: [
          { key: "collections", label: "Collections", color: "#16a34a", type: "bar" },
          { key: "expenses", label: "Expenses", color: "#f59e0b", type: "bar" },
          { key: "net", label: "Net", color: "#0f172a", type: "bar" },
        ],
        rows: params.financialChartRows,
      },
      {
        key: "branchPerformanceOverviewOperational",
        title: "Operational Overview",
        type: "chart",
        chartType: "bar",
        valueFormat: "number",
        series: [
          { key: "borrowersWithActiveLoans", label: "Borrowers with Active Loans", color: "#16a34a", type: "bar" },
          { key: "borrowersWithOverdueLoans", label: "Borrowers with Overdue Loans", color: "#0ea5e9", type: "bar" },
          { key: "activeLoans", label: "Active Loans", color: "#f59e0b", type: "bar" },
          { key: "overdueLoans", label: "Overdue Loans", color: "#ef4444", type: "bar" },
          { key: "closedLoans", label: "Closed Loans", color: "#64748b", type: "bar" },
        ],
        rows: params.operationalChartRows,
      },
      {
        key: "branchPerformanceOverviewMetrics",
        title: "Branch Performance Metrics",
        type: "table",
        columns: [
          { key: "metric", label: "Metric" },
          { key: "value", label: "Value" },
        ],
        rows: params.rawRows.map((row) => ({
          metric: row.metric,
          value:
            row.valueFormat === "currency"
              ? `₱${row.value.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : row.value.toLocaleString("en-PH"),
        })),
      },
    ],
    meta: {
      branchName: params.branchName,
      metricCount: params.rawRows.length,
    },
  });
}

export function buildBranchCollectionsComparisonSnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summary: {
    branchesCompared: number;
    totalCollectedAmount: number;
    totalCollectionsCount: number;
    highestCollectingBranch: string;
    averageCollectionAmount: number;
  };
  chartRows: Array<{ bucket: string; values: Record<string, number> }>;
  rawRows: Array<{
    branchName: string;
    totalCollectedAmount: number;
    collectionsCount: number;
    averageCollectionAmount: number;
    borrowersServed: number;
    collectorsInvolved: number;
  }>;
}) {
  return buildBaseSnapshot({
    templateKey: "branch_collections_comparison",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "branchesCompared", label: "Branches Compared", value: params.summary.branchesCompared, format: "number" },
      {
        key: "totalCollectedAmount",
        label: "Total Collected",
        value: params.summary.totalCollectedAmount,
        format: "currency",
      },
      {
        key: "totalCollectionsCount",
        label: "Collections Count",
        value: params.summary.totalCollectionsCount,
        format: "number",
      },
      {
        key: "highestCollectingBranch",
        label: "Highest Collecting Branch",
        value: params.summary.highestCollectingBranch,
        format: "text",
      },
      {
        key: "averageCollectionAmount",
        label: "Average Collection Amount",
        value: params.summary.averageCollectionAmount,
        format: "currency",
      },
    ],
    sections: [
      {
        key: "branchCollectionsComparisonChart",
        title: "Branch Collections Comparison",
        type: "chart",
        chartType: "bar",
        valueFormat: "currency",
        series: [
          {
            key: "totalCollectedAmount",
            label: "Total Collected",
            color: "#16a34a",
            type: "bar",
            valueFormat: "currency",
            yAxisId: "left",
          },
          {
            key: "collectionsCount",
            label: "Collections Count",
            color: "#0ea5e9",
            type: "bar",
            valueFormat: "number",
            yAxisId: "right",
          },
        ],
        rows: params.chartRows,
      },
      {
        key: "branchCollectionsComparisonRawData",
        title: "Branch Collections Comparison Raw Data",
        type: "table",
        columns: [
          { key: "branchName", label: "Branch" },
          { key: "totalCollectedAmount", label: "Total Collected", format: "currency" },
          { key: "collectionsCount", label: "Collections Count", format: "number" },
          { key: "averageCollectionAmount", label: "Avg Collection Amount", format: "currency" },
          { key: "borrowersServed", label: "Borrowers Served", format: "number" },
          { key: "collectorsInvolved", label: "Collectors Involved", format: "number" },
        ],
        rows: params.rawRows,
      },
    ],
    meta: {
      branchCount: params.rawRows.length,
      rowCount: params.rawRows.length,
    },
  });
}

export function buildBranchLoansComparisonSnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summary: {
    branchesCompared: number;
    totalActiveLoans: number;
    totalOverdueLoans: number;
    totalCompletedLoans: number;
    totalOutstandingBalance: number;
  };
  chartRows: Array<{ bucket: string; values: Record<string, number> }>;
  rawRows: Array<{
    branchName: string;
    activeLoans: number;
    overdueLoans: number;
    completedLoans: number;
    borrowersCount: number;
    outstandingBalance: number;
  }>;
}) {
  return buildBaseSnapshot({
    templateKey: "branch_loans_comparison",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "branchesCompared", label: "Branches Compared", value: params.summary.branchesCompared, format: "number" },
      { key: "totalActiveLoans", label: "Active Loans", value: params.summary.totalActiveLoans, format: "number" },
      { key: "totalOverdueLoans", label: "Overdue Loans", value: params.summary.totalOverdueLoans, format: "number" },
      {
        key: "totalCompletedLoans",
        label: "Completed Loans",
        value: params.summary.totalCompletedLoans,
        format: "number",
      },
      {
        key: "totalOutstandingBalance",
        label: "Outstanding Balance",
        value: params.summary.totalOutstandingBalance,
        format: "currency",
      },
    ],
    sections: [
      {
        key: "branchLoansComparisonChart",
        title: "Branch Loan-State Comparison",
        type: "chart",
        chartType: "bar",
        valueFormat: "number",
        series: [
          { key: "activeLoans", label: "Active Loans", color: "#16a34a", type: "bar" },
          { key: "overdueLoans", label: "Overdue Loans", color: "#f59e0b", type: "bar" },
          { key: "completedLoans", label: "Completed Loans", color: "#64748b", type: "bar" },
        ],
        rows: params.chartRows,
      },
      {
        key: "branchLoansComparisonRawData",
        title: "Branch Loans Comparison Raw Data",
        type: "table",
        columns: [
          { key: "branchName", label: "Branch" },
          { key: "activeLoans", label: "Active Loans", format: "number" },
          { key: "overdueLoans", label: "Overdue Loans", format: "number" },
          { key: "completedLoans", label: "Completed Loans", format: "number" },
          { key: "borrowersCount", label: "Borrowers Count", format: "number" },
          { key: "outstandingBalance", label: "Outstanding Balance", format: "currency" },
        ],
        rows: params.rawRows,
      },
    ],
    meta: {
      branchCount: params.rawRows.length,
      rowCount: params.rawRows.length,
    },
  });
}

export function buildOverdueLoansReportSnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summary: {
    overdueLoansCount: number;
    totalOverdueBalance: number;
    averageDaysOverdue: number;
    maxDaysOverdue: number;
    affectedBorrowers: number;
  };
  chartRows: Array<{ bucket: string; values: Record<string, number> }>;
  rawRows: Array<{
    branchName: string;
    borrowerName: string;
    loanCode: string;
    releaseDate: string;
    dueDate: string;
    daysOverdue: number;
    outstandingBalance: number;
    totalPaid: number;
    expectedTotal: number;
    collectorName: string;
    status: string;
  }>;
}) {
  return buildBaseSnapshot({
    templateKey: "overdue_loans_report",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      {
        key: "overdueLoansCount",
        label: "Overdue Loans",
        value: params.summary.overdueLoansCount,
        format: "number",
      },
      {
        key: "totalOverdueBalance",
        label: "Total Overdue Balance",
        value: params.summary.totalOverdueBalance,
        format: "currency",
      },
      {
        key: "averageDaysOverdue",
        label: "Average Days Overdue",
        value: params.summary.averageDaysOverdue,
        format: "number",
      },
      {
        key: "maxDaysOverdue",
        label: "Max Days Overdue",
        value: params.summary.maxDaysOverdue,
        format: "number",
      },
      {
        key: "affectedBorrowers",
        label: "Affected Borrowers",
        value: params.summary.affectedBorrowers,
        format: "number",
      },
    ],
    sections: [
      {
        key: "overdueLoansByBranch",
        title: "Overdue Loans by Branch",
        type: "chart",
        chartType: "bar",
        valueFormat: "number",
        series: [{ key: "overdueLoans", label: "Overdue Loans", color: "#f59e0b", type: "bar" }],
        rows: params.chartRows,
      },
      {
        key: "overdueLoansRawData",
        title: "Overdue Loans Raw Data",
        type: "table",
        columns: [
          { key: "branchName", label: "Branch" },
          { key: "borrowerName", label: "Borrower" },
          { key: "loanCode", label: "Loan Code" },
          { key: "releaseDate", label: "Release Date" },
          { key: "dueDate", label: "Due Date" },
          { key: "daysOverdue", label: "Days Overdue", format: "number" },
          { key: "outstandingBalance", label: "Outstanding Balance", format: "currency" },
          { key: "totalPaid", label: "Total Paid", format: "currency" },
          { key: "expectedTotal", label: "Expected Total", format: "currency" },
          { key: "collectorName", label: "Collector" },
          { key: "status", label: "Status" },
        ],
        rows: params.rawRows,
      },
    ],
    meta: {
      rowCount: params.rawRows.length,
      branchCount: params.chartRows.length,
    },
  });
}

export function buildCollectionsByCollectorSnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summary: {
    totalCollectedAmount: number;
    totalCollectionsCount: number;
    averagePerCollection: number;
    totalCollectorsIncluded: number;
    totalBorrowersHandled: number;
  };
  chartRows: Array<{ bucket: string; values: Record<string, number> }>;
  rawRows: Array<{
    collectorName: string;
    companyId: string;
    branchName: string;
    totalCollectedAmount: number;
    numberOfCollections: number;
    averagePerCollection: number;
    borrowersHandled: number;
    activeLoansTouched: number;
  }>;
}) {
  return buildBaseSnapshot({
    templateKey: "collections_by_collector",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      {
        key: "totalCollectedAmount",
        label: "Total Collected",
        value: params.summary.totalCollectedAmount,
        format: "currency",
      },
      {
        key: "totalCollectionsCount",
        label: "Collections",
        value: params.summary.totalCollectionsCount,
        format: "number",
      },
      {
        key: "averagePerCollection",
        label: "Avg per Collection",
        value: params.summary.averagePerCollection,
        format: "currency",
      },
      {
        key: "totalCollectorsIncluded",
        label: "Collectors Included",
        value: params.summary.totalCollectorsIncluded,
        format: "number",
      },
      {
        key: "totalBorrowersHandled",
        label: "Borrowers Handled",
        value: params.summary.totalBorrowersHandled,
        format: "number",
      },
    ],
    sections: [
      {
        key: "collectionsByCollectorChart",
        title: "Collections by Collector",
        type: "chart",
        chartType: "bar",
        valueFormat: "currency",
        series: [{ key: "totalCollectedAmount", label: "Total Collected", color: "#16a34a", type: "bar" }],
        rows: params.chartRows,
      },
      {
        key: "collectionsByCollectorRawData",
        title: "Collections by Collector Raw Data",
        type: "table",
        columns: [
          { key: "collectorName", label: "Collector" },
          { key: "companyId", label: "Company ID" },
          { key: "branchName", label: "Branch" },
          { key: "totalCollectedAmount", label: "Total Collected", format: "currency" },
          { key: "numberOfCollections", label: "Number of Collections", format: "number" },
          { key: "averagePerCollection", label: "Avg per Collection", format: "currency" },
          { key: "borrowersHandled", label: "Borrowers Handled", format: "number" },
          { key: "activeLoansTouched", label: "Active Loans Touched", format: "number" },
        ],
        rows: params.rawRows,
      },
    ],
    meta: {
      rowCount: params.rawRows.length,
      collectorCount: params.summary.totalCollectorsIncluded,
    },
  });
}

export function buildReleasedLoansReportSnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summary: {
    releasedLoansCount: number;
    totalReleasedPrincipal: number;
    totalReleasedExpectedAmount: number;
    totalBorrowersInvolved: number;
  };
  chartRows: Array<{ bucket: string; values: Record<string, number> }>;
  rawRows: Array<{
    releaseDate: string;
    branchName: string;
    borrowerName: string;
    loanCode: string;
    principal: number;
    interestRate: string;
    totalExpected: number;
    collectorName: string;
    status: string;
  }>;
}) {
  return buildBaseSnapshot({
    templateKey: "released_loans_report",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      {
        key: "releasedLoansCount",
        label: "Released Loans",
        value: params.summary.releasedLoansCount,
        format: "number",
      },
      {
        key: "totalReleasedPrincipal",
        label: "Total Released Principal",
        value: params.summary.totalReleasedPrincipal,
        format: "currency",
      },
      {
        key: "totalReleasedExpectedAmount",
        label: "Total Expected Amount",
        value: params.summary.totalReleasedExpectedAmount,
        format: "currency",
      },
      {
        key: "totalBorrowersInvolved",
        label: "Borrowers Involved",
        value: params.summary.totalBorrowersInvolved,
        format: "number",
      },
    ],
    sections: [
      {
        key: "releasedLoansByBranch",
        title: "Released Loans by Branch",
        type: "chart",
        chartType: "bar",
        valueFormat: "number",
        series: [{ key: "releasedLoans", label: "Released Loans", color: "#0ea5e9", type: "bar" }],
        rows: params.chartRows,
      },
      {
        key: "releasedLoansRawData",
        title: "Released Loans Raw Data",
        type: "table",
        columns: [
          { key: "releaseDate", label: "Release Date" },
          { key: "branchName", label: "Branch" },
          { key: "borrowerName", label: "Borrower" },
          { key: "loanCode", label: "Loan Code" },
          { key: "principal", label: "Principal", format: "currency" },
          { key: "interestRate", label: "Interest" },
          { key: "totalExpected", label: "Total Expected", format: "currency" },
          { key: "collectorName", label: "Collector" },
          { key: "status", label: "Status" },
        ],
        rows: params.rawRows,
      },
    ],
    meta: {
      rowCount: params.rawRows.length,
      branchCount: params.chartRows.length,
    },
  });
}

export function buildClosedLoansReportSnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summary: {
    closedLoansCount: number;
    totalPrincipal: number;
    totalPaidAmount: number;
    totalBorrowersInvolved: number;
  };
  chartRows: Array<{ bucket: string; values: Record<string, number> }>;
  rawRows: Array<{
    completionDate: string;
    branchName: string;
    borrowerName: string;
    loanCode: string;
    releaseDate: string;
    principal: number;
    totalPaid: number;
    collectorName: string;
    status: string;
  }>;
}) {
  return buildBaseSnapshot({
    templateKey: "closed_loans_report",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      {
        key: "closedLoansCount",
        label: "Closed Loans",
        value: params.summary.closedLoansCount,
        format: "number",
      },
      {
        key: "totalPrincipal",
        label: "Total Principal",
        value: params.summary.totalPrincipal,
        format: "currency",
      },
      {
        key: "totalPaidAmount",
        label: "Total Paid",
        value: params.summary.totalPaidAmount,
        format: "currency",
      },
      {
        key: "totalBorrowersInvolved",
        label: "Borrowers Involved",
        value: params.summary.totalBorrowersInvolved,
        format: "number",
      },
    ],
    sections: [
      {
        key: "closedLoansByBranch",
        title: "Closed Loans by Branch",
        type: "chart",
        chartType: "bar",
        valueFormat: "number",
        series: [{ key: "closedLoans", label: "Closed Loans", color: "#64748b", type: "bar" }],
        rows: params.chartRows,
      },
      {
        key: "closedLoansRawData",
        title: "Closed Loans Raw Data",
        type: "table",
        columns: [
          { key: "completionDate", label: "Completion Date" },
          { key: "branchName", label: "Branch" },
          { key: "borrowerName", label: "Borrower" },
          { key: "loanCode", label: "Loan Code" },
          { key: "releaseDate", label: "Release Date" },
          { key: "principal", label: "Principal", format: "currency" },
          { key: "totalPaid", label: "Total Paid", format: "currency" },
          { key: "collectorName", label: "Collector" },
          { key: "status", label: "Status" },
        ],
        rows: params.rawRows,
      },
    ],
    meta: {
      rowCount: params.rawRows.length,
      branchCount: params.chartRows.length,
    },
  });
}

export function buildBorrowerSummarySnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summary: {
    totalBorrowers: number;
    borrowersWithActiveLoans: number;
    borrowersWithOverdueLoans: number;
    borrowersWithCompletedLoans: number;
    newBorrowers: number;
  };
  chartRows: Array<{ bucket: string; values: Record<string, number> }>;
  rawRows: Array<{
    branchName: string;
    totalBorrowers: number;
    borrowersWithActiveLoans: number;
    borrowersWithOverdueLoans: number;
    borrowersWithCompletedLoans: number;
    newBorrowers: number;
  }>;
}) {
  return buildBaseSnapshot({
    templateKey: "borrower_summary",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "totalBorrowers", label: "Total Borrowers", value: params.summary.totalBorrowers, format: "number" },
      {
        key: "borrowersWithActiveLoans",
        label: "Borrowers with Active Loans",
        value: params.summary.borrowersWithActiveLoans,
        format: "number",
      },
      {
        key: "borrowersWithOverdueLoans",
        label: "Borrowers with Overdue Loans",
        value: params.summary.borrowersWithOverdueLoans,
        format: "number",
      },
      {
        key: "borrowersWithCompletedLoans",
        label: "Borrowers with Completed Loans",
        value: params.summary.borrowersWithCompletedLoans,
        format: "number",
      },
      { key: "newBorrowers", label: "New Borrowers", value: params.summary.newBorrowers, format: "number" },
    ],
    sections: [
      {
        key: "borrowerSummaryChart",
        title: "Borrower Volume by Branch",
        type: "chart",
        chartType: "bar",
        valueFormat: "number",
        series: [{ key: "totalBorrowers", label: "Total Borrowers", color: "#16a34a", type: "bar" }],
        rows: params.chartRows,
      },
      {
        key: "borrowerSummaryRawData",
        title: "Borrower Summary Raw Data",
        type: "table",
        columns: [
          { key: "branchName", label: "Branch" },
          { key: "totalBorrowers", label: "Total Borrowers", format: "number" },
          { key: "borrowersWithActiveLoans", label: "Borrowers with Active Loans", format: "number" },
          { key: "borrowersWithOverdueLoans", label: "Borrowers with Overdue Loans", format: "number" },
          { key: "borrowersWithCompletedLoans", label: "Borrowers with Completed Loans", format: "number" },
          { key: "newBorrowers", label: "New Borrowers", format: "number" },
        ],
        rows: params.rawRows,
      },
    ],
    meta: {
      branchCount: params.rawRows.length,
      rowCount: params.rawRows.length,
    },
  });
}

export function buildBorrowersWithOverdueLoansSnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summary: {
    overdueBorrowersCount: number;
    overdueLoansCount: number;
    totalOverdueBalance: number;
    averageOverdueBalancePerBorrower: number;
    maxDaysOverdue: number;
    totalAffectedBranches: number;
  };
  chartRows: Array<{ bucket: string; values: Record<string, number> }>;
  rawRows: Array<{
    borrowerName: string;
    branch: string;
    collector: string;
    overdueLoansCount: number;
    totalOverdueBalance: number;
    maxDaysOverdue: number;
    latestOverdueDueDate: string;
  }>;
}) {
  return buildBaseSnapshot({
    templateKey: "borrowers_with_overdue_loans",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      {
        key: "overdueBorrowersCount",
        label: "Overdue Borrowers",
        value: params.summary.overdueBorrowersCount,
        format: "number",
      },
      { key: "overdueLoansCount", label: "Overdue Loans", value: params.summary.overdueLoansCount, format: "number" },
      {
        key: "totalOverdueBalance",
        label: "Total Overdue Balance",
        value: params.summary.totalOverdueBalance,
        format: "currency",
      },
      {
        key: "averageOverdueBalancePerBorrower",
        label: "Avg Overdue Balance per Borrower",
        value: params.summary.averageOverdueBalancePerBorrower,
        format: "currency",
      },
      { key: "maxDaysOverdue", label: "Max Days Overdue", value: params.summary.maxDaysOverdue, format: "number" },
      {
        key: "totalAffectedBranches",
        label: "Affected Branches",
        value: params.summary.totalAffectedBranches,
        format: "number",
      },
    ],
    sections: [
      {
        key: "overdueBorrowersByBranch",
        title: "Overdue Borrowers by Branch",
        type: "chart",
        chartType: "bar",
        valueFormat: "number",
        series: [{ key: "overdueBorrowers", label: "Overdue Borrowers", color: "#f59e0b", type: "bar" }],
        rows: params.chartRows,
      },
      {
        key: "borrowersWithOverdueLoansRawData",
        title: "Borrowers with Overdue Loans Raw Data",
        type: "table",
        columns: [
          { key: "borrowerName", label: "Borrower" },
          { key: "branch", label: "Branch" },
          { key: "collector", label: "Collector" },
          { key: "overdueLoansCount", label: "Overdue Loans", format: "number" },
          { key: "totalOverdueBalance", label: "Total Overdue Balance", format: "currency" },
          { key: "maxDaysOverdue", label: "Max Days Overdue", format: "number" },
          { key: "latestOverdueDueDate", label: "Latest Overdue Due Date" },
        ],
        rows: params.rawRows,
      },
    ],
    meta: {
      rowCount: params.rawRows.length,
      branchCount: params.chartRows.length,
    },
  });
}

export function buildCollectorPerformanceReportSnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  collectorLabel: string;
  summary: {
    totalCollected: number;
    averageCollectionAmount: number;
    collectionEntries: number;
    assignedActiveLoans: number;
    portfolioRecoveryRate: string;
    missedPaymentRate: string;
    completionRate: string;
  };
  chartRows: Array<{ bucket: string; values: Record<string, number> }>;
  rawRows: Array<{
    period: string;
    totalCollected: number;
    collectionsCount: number;
    averagePerCollection: number;
    borrowersHandled: number;
    activeLoansHandled: number;
  }>;
}) {
  return buildBaseSnapshot({
    templateKey: "collector_performance_report",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      { key: "totalCollected", label: "Total Collected", value: params.summary.totalCollected, format: "currency" },
      {
        key: "averageCollectionAmount",
        label: "Avg Collection Amount",
        value: params.summary.averageCollectionAmount,
        format: "currency",
      },
      { key: "collectionEntries", label: "Collections Count", value: params.summary.collectionEntries, format: "number" },
      {
        key: "assignedActiveLoans",
        label: "Assigned Active Loans",
        value: params.summary.assignedActiveLoans,
        format: "number",
      },
      {
        key: "portfolioRecoveryRate",
        label: "Portfolio Recovery Rate",
        value: params.summary.portfolioRecoveryRate,
        format: "text",
      },
      {
        key: "missedPaymentRate",
        label: "Missed Payment Rate",
        value: params.summary.missedPaymentRate,
        format: "text",
      },
      {
        key: "completionRate",
        label: "Completion Rate",
        value: params.summary.completionRate,
        format: "text",
      },
    ],
    sections: [
      {
        key: "collectorPerformanceTrend",
        title: "Collected Amount Trend",
        type: "chart",
        chartType: "line",
        valueFormat: "currency",
        series: [{ key: "totalCollected", label: "Collected Amount", color: "#16a34a", type: "line" }],
        rows: params.chartRows,
      },
      {
        key: "collectorPerformanceRawData",
        title: "Collector Activity by Period",
        type: "table",
        columns: [
          { key: "period", label: "Period" },
          { key: "totalCollected", label: "Total Collected", format: "currency" },
          { key: "collectionsCount", label: "Collections Count", format: "number" },
          { key: "averagePerCollection", label: "Avg per Collection", format: "currency" },
          { key: "borrowersHandled", label: "Borrowers Handled", format: "number" },
          { key: "activeLoansHandled", label: "Active Loans Handled", format: "number" },
        ],
        rows: params.rawRows,
      },
    ],
    meta: {
      collectorLabel: params.collectorLabel,
      rowCount: params.rawRows.length,
    },
  });
}

export function buildCollectorLeaderboardReportSnapshot(params: {
  title: string;
  generatedLabel: string;
  scopeLabel: string;
  summary: {
    totalCollectorsRanked: number;
    topCollector: string;
    topCollectorAverageMonthlyCollections: number;
    totalCollectedAcrossRankedCollectors: number;
    averageCollectedPerCollector: number;
  };
  chartRows: Array<{ bucket: string; values: Record<string, number> }>;
  rawRows: Array<{
    rank: number;
    collectorLabel: string;
    companyId: string;
    branchName: string;
    areaLabel: string;
    averageMonthlyCollections: number;
    totalCollected: number;
    assignedActiveLoans: number;
    portfolioRecoveryRate: string;
    missedPaymentRate: string;
    periodChangePercent: string;
  }>;
}) {
  return buildBaseSnapshot({
    templateKey: "collector_leaderboard_report",
    title: params.title,
    generatedLabel: params.generatedLabel,
    scopeLabel: params.scopeLabel,
    summaryCards: [
      {
        key: "totalCollectorsRanked",
        label: "Collectors Ranked",
        value: params.summary.totalCollectorsRanked,
        format: "number",
      },
      { key: "topCollector", label: "Top Collector", value: params.summary.topCollector, format: "text" },
      {
        key: "topCollectorAverageMonthlyCollections",
        label: "Top Collector Avg Monthly",
        value: params.summary.topCollectorAverageMonthlyCollections,
        format: "currency",
      },
      {
        key: "totalCollectedAcrossRankedCollectors",
        label: "Total Collected",
        value: params.summary.totalCollectedAcrossRankedCollectors,
        format: "currency",
      },
      {
        key: "averageCollectedPerCollector",
        label: "Avg Collected per Collector",
        value: params.summary.averageCollectedPerCollector,
        format: "currency",
      },
    ],
    sections: [
      {
        key: "collectorLeaderboardChart",
        title: "Collector Leaderboard",
        type: "chart",
        chartType: "bar",
        layout: "horizontal",
        valueFormat: "currency",
        series: [
          {
            key: "averageMonthlyCollections",
            label: "Average Monthly Collections",
            color: "#16a34a",
            type: "bar",
          },
        ],
        rows: params.chartRows,
      },
      {
        key: "collectorLeaderboardRawData",
        title: "Collector Leaderboard Raw Data",
        type: "table",
        columns: [
          { key: "rank", label: "Rank", format: "number" },
          { key: "collectorLabel", label: "Collector" },
          { key: "companyId", label: "Company ID" },
          { key: "branchName", label: "Branch" },
          { key: "areaLabel", label: "Area" },
          { key: "averageMonthlyCollections", label: "Average Monthly Collections", format: "currency" },
          { key: "totalCollected", label: "Total Collected", format: "currency" },
          { key: "assignedActiveLoans", label: "Assigned Active Loans", format: "number" },
          { key: "portfolioRecoveryRate", label: "Portfolio Recovery Rate" },
          { key: "missedPaymentRate", label: "Missed Payment Rate" },
          { key: "periodChangePercent", label: "Period Change %" },
        ],
        rows: params.rawRows,
      },
    ],
    meta: {
      rowCount: params.rawRows.length,
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
    amount: number | string;
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
