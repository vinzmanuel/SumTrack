"use client";

import Link from "next/link";
import { useRef } from "react";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatStoredDateTimeForManila } from "@/app/dashboard/datetime";
import {
  canExportCsv,
  exportReportCsv,
  printReportContent,
} from "@/app/dashboard/reports/report-export";
import { ReportsViewerChart } from "@/app/dashboard/reports/reports-viewer-chart";
import { ReportsViewerDataTable } from "@/app/dashboard/reports/reports-viewer-data-table";
import type {
  ReportsSnapshotChartSection,
  ReportsSnapshotFieldListSection,
  ReportsSnapshotSection,
  ReportsSnapshotSummaryItem,
  ReportsSnapshotTableSection,
  ReportsViewerPageData,
  SavedReportSnapshot,
} from "@/app/dashboard/reports/types";

function formatMoney(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatDateTime(value: string) {
  return formatStoredDateTimeForManila(value, {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSummaryValue(item: ReportsSnapshotSummaryItem) {
  if (typeof item.value === "number") {
    if (item.format === "currency") {
      return formatMoney(item.value);
    }

    if (item.format === "number") {
      return item.value.toLocaleString("en-PH");
    }
  }

  return String(item.value);
}

const MONEY_FIELD_LABELS = new Set([
  "Amount",
  "Amount Paid",
  "Daily Payment",
  "Estimated Daily Payment",
  "Outstanding Balance",
  "Principal",
  "Principal + Interest",
  "Remaining Balance",
  "Remaining Balance After Payment",
  "Total Paid",
  "Total Payable",
]);

function tryFormatMoneyText(label: string, value: string) {
  if (!MONEY_FIELD_LABELS.has(label)) {
    return value;
  }

  const normalized = value.replace(/,/g, "").trim();
  if (!normalized || normalized === "-" || /[^0-9.-]/.test(normalized)) {
    return value;
  }

  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return formatMoney(parsed);
}

function getRowNumber(row: Record<string, number | string>, key: string) {
  const value = row[key];
  return typeof value === "number" ? value : 0;
}

function getRowString(row: Record<string, number | string>, key: string) {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : "-";
}

function isChartSection(section: ReportsSnapshotSection): section is ReportsSnapshotChartSection {
  return section.type === "chart";
}

function isTableSection(section: ReportsSnapshotSection): section is ReportsSnapshotTableSection {
  return section.type === "table";
}

function isFieldListSection(section: ReportsSnapshotSection): section is ReportsSnapshotFieldListSection {
  return section.type === "field_list";
}

function findChartSection(snapshot: SavedReportSnapshot, key: string): ReportsSnapshotChartSection | null {
  return (
    snapshot.sections.find(
      (section): section is ReportsSnapshotChartSection =>
        section.key === key && isChartSection(section),
    ) ?? null
  );
}

function findTableSection(snapshot: SavedReportSnapshot, key: string): ReportsSnapshotTableSection | null {
  return (
    snapshot.sections.find(
      (section): section is ReportsSnapshotTableSection =>
        section.key === key && isTableSection(section),
    ) ?? null
  );
}

function findFieldListSection(snapshot: SavedReportSnapshot, key: string): ReportsSnapshotFieldListSection | null {
  return (
    snapshot.sections.find(
      (section): section is ReportsSnapshotFieldListSection =>
        section.key === key && isFieldListSection(section),
    ) ?? null
  );
}

function getTableSections(snapshot: SavedReportSnapshot): ReportsSnapshotTableSection[] {
  return snapshot.sections.filter(
    (section): section is ReportsSnapshotTableSection => isTableSection(section),
  );
}

function omitTableColumn(section: ReportsSnapshotTableSection, columnKey: string): ReportsSnapshotTableSection {
  return {
    ...section,
    columns: section.columns.filter((column) => column.key !== columnKey),
    rows: section.rows.map((row) => {
      const nextRow = { ...row };
      delete nextRow[columnKey];
      return nextRow;
    }),
  };
}

function formatCoveragePeriod(report: ReportsViewerPageData) {
  if (report.dateFrom && report.dateTo) {
    return report.dateFrom === report.dateTo
      ? formatDate(report.dateFrom)
      : `${formatDate(report.dateFrom)} to ${formatDate(report.dateTo)}`;
  }

  return report.snapshot.generatedLabel;
}

function buildMetadataRows(report: ReportsViewerPageData) {
  return [
    { label: "Report Type", value: report.templateLabel },
    { label: "Generated At", value: formatDateTime(report.generatedAt) },
    {
      label: "Generated By",
      value:
        report.generatedType === "system"
          ? "System-generated"
          : report.generatedByRoleName
            ? `${report.generatedByName} (${report.generatedByRoleName})`
            : report.generatedByName,
    },
    {
      label: "Branch Scope",
      value: report.branchScopeNames.length > 0 ? report.branchScopeNames.join(", ") : "N/A",
    },
    { label: "Coverage Period", value: formatCoveragePeriod(report) },
    { label: "Status", value: report.status === "active" ? "Active" : "Archived" },
  ];
}

function buildFieldListRowMap(section: ReportsSnapshotFieldListSection | null) {
  return new Map(section?.rows.map((row) => [row.label, row.value]) ?? []);
}

function getFieldRowValue(
  fieldMap: Map<string, string>,
  label: string,
  fallback: string | null = null,
) {
  const value = fieldMap.get(label)?.trim();

  if (!value || value === "-" || value === "N/A") {
    return fallback;
  }

  return value;
}

function getSummaryCardNumber(snapshot: SavedReportSnapshot, key: string) {
  const item = snapshot.summaryCards.find((summaryItem) => summaryItem.key === key);
  return typeof item?.value === "number" ? item.value : null;
}

function formatReceiptMoney(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatReceiptGeneratedBy(report: ReportsViewerPageData) {
  if (report.generatedType === "system") {
    return "SumTrack System";
  }

  return report.generatedByRoleName
    ? `${report.generatedByName} (${report.generatedByRoleName})`
    : report.generatedByName;
}

function splitReceiptAddress(address: string | null) {
  const value = address?.trim();

  if (!value) {
    return { addressLine: null, localityLine: null };
  }

  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return { addressLine: value, localityLine: null };
  }

  if (parts.length === 2) {
    return { addressLine: parts[0], localityLine: parts[1] };
  }

  return {
    addressLine: parts.slice(0, -2).join(", "),
    localityLine: parts.slice(-2).join(", "),
  };
}

function formatReceiptDate(value: string | null) {
  return formatDate(value);
}

function formatReceiptDateTime(value: string) {
  return formatStoredDateTimeForManila(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isReceiptTemplate(report: ReportsViewerPageData) {
  return report.templateKey === "collection_receipt" || report.templateKey === "loan_receipt_summary";
}

function parseNumericText(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isNaN(parsed) ? null : parsed;
}

function ReceiptDivider() {
  return <div className="border-t border-dashed border-black/35" />;
}

function ReceiptMetaRow(props: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <dt className="shrink-0 text-[10px] uppercase tracking-[0.22em] text-black/60">{props.label}</dt>
      <dd className="max-w-[12rem] text-right text-[11px] font-medium leading-5 text-black break-words">
        {props.value}
      </dd>
    </div>
  );
}

function ReceiptSection(props: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 border-t border-dashed border-black/35" />
        <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.28em] text-black/70">
          {props.title}
        </p>
        <div className="h-px flex-1 border-t border-dashed border-black/35" />
      </div>
      <dl>{props.children}</dl>
    </section>
  );
}

function ReceiptPaper(props: { children: ReactNode }) {
  return (
    <div
      className="mx-auto w-full max-w-[21rem] bg-white px-5 py-6 font-mono text-black shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)]"
      data-print-layout="receipt"
      data-receipt-paper="true"
    >
      {props.children}
    </div>
  );
}

function deriveFinancialOverviewChart(snapshot: SavedReportSnapshot): ReportsSnapshotChartSection | null {
  const branchTable = findTableSection(snapshot, "branchFinancialSummary");
  if (!branchTable) {
    return null;
  }

  const hasSavedIncentives = branchTable.rows.some((row) => typeof row["incentivesAmount"] === "number");
  const series = [
    { key: "collections", label: "Collections", color: "#16a34a", type: "bar" as const },
    { key: "expenses", label: "Expenses", color: "#f59e0b", type: "bar" as const },
    ...(hasSavedIncentives
      ? [{ key: "incentives", label: "Incentives", color: "#6366f1", type: "bar" as const }]
      : []),
    { key: "net", label: "Net", color: "#0f172a", type: "line" as const },
  ];

  return {
    key: "financialTrendFallback",
    title: "Financial Trend",
    type: "chart",
    chartType: "composed",
    valueFormat: "currency",
    note: hasSavedIncentives
      ? "This saved report did not include period buckets, so the chart is using branch totals."
      : "This saved report uses the current simplified financial view, so the chart is using Collections, Expenses, and Net only.",
    series,
    rows: branchTable.rows.map((row) => ({
      bucket: getRowString(row, "branchName"),
      values: {
        collections: getRowNumber(row, "collectionsAmount"),
        expenses: getRowNumber(row, "expensesAmount"),
        net: typeof row["netAmount"] === "number"
          ? getRowNumber(row, "netAmount")
          : getRowNumber(row, "collectionsAmount") -
            getRowNumber(row, "expensesAmount") -
            (hasSavedIncentives ? getRowNumber(row, "incentivesAmount") : 0),
        ...(hasSavedIncentives
          ? { incentives: getRowNumber(row, "incentivesAmount") }
          : {}),
      },
    })),
  };
}

function deriveActiveLoansChart(snapshot: SavedReportSnapshot): ReportsSnapshotChartSection | null {
  const branchTable = findTableSection(snapshot, "branchLiveLoans");
  if (!branchTable) {
    return null;
  }

  return {
    key: "activeLoansFallback",
    title: "Active Loans by Branch",
    type: "chart",
    chartType: "bar",
    valueFormat: "number",
    series: [{ key: "activeLoans", label: "Active Loans", color: "#16a34a", type: "bar" }],
    rows: branchTable.rows.map((row) => ({
      bucket: getRowString(row, "branchName"),
      values: {
        activeLoans: getRowNumber(row, "activeLoans"),
      },
    })),
  };
}

function deriveBranchPerformanceFinancialChart(snapshot: SavedReportSnapshot): ReportsSnapshotChartSection | null {
  const comparisonTable = findTableSection(snapshot, "branchComparison");
  if (!comparisonTable) {
    return null;
  }

  const hasExpenses = comparisonTable.rows.some((row) => typeof row["expensesAmount"] === "number");
  const hasIncentives = comparisonTable.rows.some((row) => typeof row["incentivesAmount"] === "number");
  const series = [
    { key: "collections", label: "Collections", color: "#16a34a", type: "bar" as const },
    { key: "expenses", label: "Expenses", color: "#f59e0b", type: "bar" as const },
    ...(hasIncentives
      ? [{ key: "incentives", label: "Incentives", color: "#6366f1", type: "bar" as const }]
      : []),
    { key: "net", label: "Net", color: "#0f172a", type: "bar" as const },
  ];

  return {
    key: "branchFinancialFallback",
    title: "Financial Comparison",
    type: "chart",
    chartType: "bar",
    valueFormat: "currency",
    note:
      hasExpenses && hasIncentives
        ? undefined
        : hasIncentives
          ? "This older saved comparison does not include all financial metrics, so missing values are shown as zero."
          : "This saved comparison uses the current simplified financial view, so the chart is using Collections, Expenses, and Net only.",
    series,
    rows: comparisonTable.rows.map((row) => ({
      bucket: getRowString(row, "branchName"),
      values: {
        collections:
          typeof row["collectionsAmount"] === "number"
            ? getRowNumber(row, "collectionsAmount")
            : getRowNumber(row, "collectionsThisMonth"),
        expenses: getRowNumber(row, "expensesAmount"),
        net:
          typeof row["netAmount"] === "number"
            ? getRowNumber(row, "netAmount")
            : (typeof row["collectionsAmount"] === "number"
                ? getRowNumber(row, "collectionsAmount")
                : getRowNumber(row, "collectionsThisMonth")) -
              getRowNumber(row, "expensesAmount") -
              (hasIncentives ? getRowNumber(row, "incentivesAmount") : 0),
        ...(hasIncentives
          ? { incentives: getRowNumber(row, "incentivesAmount") }
          : {}),
      },
    })),
  };
}

function deriveBranchPerformanceOperationalChart(snapshot: SavedReportSnapshot): ReportsSnapshotChartSection | null {
  const comparisonTable = findTableSection(snapshot, "branchComparison");
  if (!comparisonTable) {
    return null;
  }

  const hasCompleted = comparisonTable.rows.some((row) => typeof row["completedLoanCount"] === "number");

  return {
    key: "branchOperationalFallback",
    title: "Operational Comparison",
    type: "chart",
    chartType: "bar",
    valueFormat: "number",
    note: hasCompleted
      ? undefined
      : "This older saved comparison does not include completed-loan counts, so that series is shown as zero.",
    series: [
      { key: "borrowers", label: "Borrowers", color: "#16a34a", type: "bar" },
      { key: "activeLoans", label: "Active Loans", color: "#0ea5e9", type: "bar" },
      { key: "overdueLoans", label: "Overdue Loans", color: "#f59e0b", type: "bar" },
      { key: "completedLoans", label: "Completed Loans", color: "#64748b", type: "bar" },
    ],
    rows: comparisonTable.rows.map((row) => ({
      bucket: getRowString(row, "branchName"),
      values: {
        borrowers: getRowNumber(row, "borrowerCount"),
        activeLoans: getRowNumber(row, "activeLoanCount"),
        overdueLoans: getRowNumber(row, "overdueLoanCount"),
        completedLoans: getRowNumber(row, "completedLoanCount"),
      },
    })),
  };
}

function ReportMetadata(props: { report: ReportsViewerPageData }) {
  const rows = buildMetadataRows(props.report);

  return (
    <dl className="grid gap-x-8 gap-y-2 text-sm text-muted-foreground md:grid-cols-2">
      {rows.map((row) => (
        <div className="grid grid-cols-[120px_1fr] gap-3" key={row.label}>
          <dt className="font-medium text-foreground">{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CompactSummary(props: { items: ReportsSnapshotSummaryItem[]; title?: string }) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      {props.title ? <h2 className="text-base font-semibold text-foreground">{props.title}</h2> : null}
      <div className="rounded-lg border border-border/70">
        <div className="grid gap-x-8 gap-y-3 p-4 text-sm md:grid-cols-2 xl:grid-cols-4">
          {props.items.map((item) => (
            <div className="space-y-1" key={item.key}>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
              <p className="font-medium text-foreground">{formatSummaryValue(item)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FieldListBlock(props: {
  section: ReportsSnapshotFieldListSection;
  columns?: 1 | 2;
}) {
  const gridClass = props.columns === 1 ? "grid-cols-1" : "md:grid-cols-2";

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{props.section.title}</h2>
      <div className="rounded-lg border border-border/70 p-4">
        <dl className={`grid gap-x-8 gap-y-3 text-sm ${gridClass}`}>
          {props.section.rows.map((row) => (
            <div className="grid grid-cols-[150px_1fr] gap-3" key={row.label}>
              <dt className="font-medium text-foreground">{row.label}</dt>
              <dd className="text-muted-foreground">
                {tryFormatMoneyText(row.label, row.value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function ReportSection(props: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{props.title}</h2>
        {props.description ? <p className="text-sm text-muted-foreground">{props.description}</p> : null}
      </div>
      {props.children}
    </section>
  );
}

function DocumentHeader(props: { title: string; subtitle: string }) {
  return (
    <div className="border-b border-border/70 pb-5 text-center">
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">SumTrack</p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">Sum Finance Services Corp.</h1>
      <p className="mt-1 text-sm text-muted-foreground">{props.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{props.subtitle}</p>
    </div>
  );
}

function renderFinancialOverview(report: ReportsViewerPageData) {
  const chart = findChartSection(report.snapshot, "financialTrend") ?? deriveFinancialOverviewChart(report.snapshot);
  const periodBreakdown =
    findTableSection(report.snapshot, "periodBreakdown") ?? findTableSection(report.snapshot, "branchFinancialSummary");
  const rawTables = getTableSections(report.snapshot).filter((section) => section.key !== periodBreakdown?.key);

  return (
    <div className="space-y-8">
      <CompactSummary items={report.snapshot.summaryCards} title="Summary" />
      {chart ? (
        <ReportSection title="Financial Chart">
          <ReportsViewerChart chart={chart} />
        </ReportSection>
      ) : null}
      {periodBreakdown ? (
        <ReportSection title={periodBreakdown.title}>
          <ReportsViewerDataTable section={periodBreakdown} />
        </ReportSection>
      ) : null}
      {rawTables.length > 0 ? (
        <ReportSection title="Raw Data">
          <div className="space-y-6">
            {rawTables.map((section) => (
              <div className="space-y-3" key={section.key}>
                <h3 className="text-sm font-medium text-foreground">{section.title}</h3>
                <ReportsViewerDataTable section={section} />
              </div>
            ))}
          </div>
        </ReportSection>
      ) : null}
    </div>
  );
}

function renderCollectionsSummary(report: ReportsViewerPageData) {
  const chart =
    findChartSection(report.snapshot, "collectionsTrend") ??
    findChartSection(report.snapshot, "dailyTrend");
  const rawTables = getTableSections(report.snapshot);

  return (
    <div className="space-y-8">
      <CompactSummary items={report.snapshot.summaryCards} title="Summary" />
      {chart ? (
        <ReportSection title="Collections Trend">
          <ReportsViewerChart chart={chart} forceChartType="line" />
        </ReportSection>
      ) : null}
      {rawTables.length > 0 ? (
        <ReportSection title="Raw Data">
          <div className="space-y-6">
            {rawTables.map((section) => (
              <div className="space-y-3" key={section.key}>
                <h3 className="text-sm font-medium text-foreground">{section.title}</h3>
                <ReportsViewerDataTable section={section} />
              </div>
            ))}
          </div>
        </ReportSection>
      ) : null}
    </div>
  );
}

function renderActiveLoansSummary(report: ReportsViewerPageData) {
  const chart = findChartSection(report.snapshot, "activeLoansByBranch") ?? deriveActiveLoansChart(report.snapshot);
  const rawTables = getTableSections(report.snapshot);

  return (
    <div className="space-y-8">
      <CompactSummary items={report.snapshot.summaryCards} title="Summary" />
      {chart ? (
        <ReportSection title="Active Loans Count">
          <ReportsViewerChart chart={chart} />
        </ReportSection>
      ) : null}
      {rawTables.length > 0 ? (
        <ReportSection title="Raw Data">
          <div className="space-y-6">
            {rawTables.map((section) => (
              <div className="space-y-3" key={section.key}>
                <h3 className="text-sm font-medium text-foreground">{section.title}</h3>
                <ReportsViewerDataTable section={section} />
              </div>
            ))}
          </div>
        </ReportSection>
      ) : null}
    </div>
  );
}

function renderBranchPerformanceComparison(report: ReportsViewerPageData) {
  const financialChart =
    findChartSection(report.snapshot, "financialComparison") ?? deriveBranchPerformanceFinancialChart(report.snapshot);
  const operationalChart =
    findChartSection(report.snapshot, "operationalComparison") ?? deriveBranchPerformanceOperationalChart(report.snapshot);
  const comparisonTable = findTableSection(report.snapshot, "branchComparison");

  return (
    <div className="space-y-8">
      <CompactSummary items={report.snapshot.summaryCards} title="Summary" />
      <p className="text-sm text-muted-foreground">
        Selected branches: {report.branchScopeNames.length > 0 ? report.branchScopeNames.join(", ") : report.snapshot.scopeLabel}
      </p>
      {financialChart ? (
        <ReportSection title="Financial Comparison">
          <ReportsViewerChart chart={financialChart} />
        </ReportSection>
      ) : null}
      {operationalChart ? (
        <ReportSection title="Operational Comparison">
          <ReportsViewerChart chart={operationalChart} />
        </ReportSection>
      ) : null}
      {comparisonTable ? (
        <ReportSection title="Raw Comparison Table">
          <ReportsViewerDataTable section={comparisonTable} />
        </ReportSection>
      ) : null}
    </div>
  );
}

function renderLoansSummary(report: ReportsViewerPageData) {
  return renderAnalyticsChartAndTableReport(report, {
    chartKey: "loansSummaryChart",
    chartTitle: "Loan-State Summary",
    tableKey: "loansSummaryRawData",
    tableTitle: "Loan Summary Metrics",
  });
}

function renderBranchPerformanceOverview(report: ReportsViewerPageData) {
  const financialChart = findChartSection(report.snapshot, "branchPerformanceOverviewFinancial");
  const operationalChart = findChartSection(report.snapshot, "branchPerformanceOverviewOperational");
  const metricsTable = findTableSection(report.snapshot, "branchPerformanceOverviewMetrics");

  return (
    <div className="space-y-8">
      <CompactSummary items={report.snapshot.summaryCards} title="Summary" />
      <p className="text-sm text-muted-foreground">
        Selected branch: {report.branchScopeNames[0] ?? report.snapshot.scopeLabel}
      </p>
      {financialChart ? (
        <ReportSection title="Financial Overview">
          <ReportsViewerChart chart={financialChart} />
        </ReportSection>
      ) : null}
      {operationalChart ? (
        <ReportSection title="Operational Overview">
          <ReportsViewerChart chart={operationalChart} />
        </ReportSection>
      ) : null}
      {metricsTable ? (
        <ReportSection title="Supporting Metrics">
          <ReportsViewerDataTable section={metricsTable} />
        </ReportSection>
      ) : null}
    </div>
  );
}

function renderAnalyticsChartAndTableReport(
  report: ReportsViewerPageData,
  options: {
    chartKey: string;
    chartTitle: string;
    tableKey: string;
    tableTitle: string;
    forceChartType?: ReportsSnapshotChartSection["chartType"];
  },
) {
  const chart = findChartSection(report.snapshot, options.chartKey);
  const rawTable = findTableSection(report.snapshot, options.tableKey);

  return (
    <div className="space-y-8">
      <CompactSummary items={report.snapshot.summaryCards} title="Summary" />
      {chart ? (
        <ReportSection title={options.chartTitle}>
          <ReportsViewerChart chart={chart} forceChartType={options.forceChartType} />
        </ReportSection>
      ) : null}
      {rawTable ? (
        <ReportSection title={options.tableTitle}>
          <ReportsViewerDataTable section={rawTable} />
        </ReportSection>
      ) : null}
    </div>
  );
}

function renderOverdueLoansReport(report: ReportsViewerPageData) {
  return renderAnalyticsChartAndTableReport(report, {
    chartKey: "overdueLoansByBranch",
    chartTitle: "Overdue Loan Burden by Branch",
    tableKey: "overdueLoansRawData",
    tableTitle: "Overdue Loan Details",
  });
}

function renderCollectionsByCollector(report: ReportsViewerPageData) {
  return renderAnalyticsChartAndTableReport(report, {
    chartKey: "collectionsByCollectorChart",
    chartTitle: "Collections by Collector",
    tableKey: "collectionsByCollectorRawData",
    tableTitle: "Collector Collection Breakdown",
  });
}

function renderReleasedLoansReport(report: ReportsViewerPageData) {
  return renderAnalyticsChartAndTableReport(report, {
    chartKey: "releasedLoansByBranch",
    chartTitle: "Released Loans by Branch",
    tableKey: "releasedLoansRawData",
    tableTitle: "Released Loan Details",
  });
}

function renderClosedLoansReport(report: ReportsViewerPageData) {
  return renderAnalyticsChartAndTableReport(report, {
    chartKey: "closedLoansByBranch",
    chartTitle: "Closed Loans by Branch",
    tableKey: "closedLoansRawData",
    tableTitle: "Closed Loan Details",
  });
}

function renderBranchCollectionsComparison(report: ReportsViewerPageData) {
  return renderAnalyticsChartAndTableReport(report, {
    chartKey: "branchCollectionsComparisonChart",
    chartTitle: "Branch Collections Comparison",
    tableKey: "branchCollectionsComparisonRawData",
    tableTitle: "Branch Collection Breakdown",
  });
}

function renderBranchLoansComparison(report: ReportsViewerPageData) {
  return renderAnalyticsChartAndTableReport(report, {
    chartKey: "branchLoansComparisonChart",
    chartTitle: "Branch Loan-State Comparison",
    tableKey: "branchLoansComparisonRawData",
    tableTitle: "Branch Loan Comparison Table",
  });
}

function renderBorrowerSummary(report: ReportsViewerPageData) {
  return renderAnalyticsChartAndTableReport(report, {
    chartKey: "borrowerSummaryChart",
    chartTitle: "Borrower Volume by Branch",
    tableKey: "borrowerSummaryRawData",
    tableTitle: "Borrower Summary Table",
  });
}

function renderBorrowersWithOverdueLoans(report: ReportsViewerPageData) {
  return renderAnalyticsChartAndTableReport(report, {
    chartKey: "overdueBorrowersByBranch",
    chartTitle: "Overdue Borrowers by Branch",
    tableKey: "borrowersWithOverdueLoansRawData",
    tableTitle: "Borrowers with Overdue Loans",
  });
}

function renderCollectorPerformanceReport(report: ReportsViewerPageData) {
  const chart = findChartSection(report.snapshot, "collectorPerformanceTrend");
  const rawTable = findTableSection(report.snapshot, "collectorPerformanceRawData");
  const collectorLabel =
    typeof report.snapshot.meta["collectorLabel"] === "string"
      ? String(report.snapshot.meta["collectorLabel"])
      : null;

  return (
    <div className="space-y-8">
      <CompactSummary items={report.snapshot.summaryCards} title="Summary" />
      {collectorLabel ? (
        <p className="text-sm text-muted-foreground">Collector: {collectorLabel}</p>
      ) : null}
      {chart ? (
        <ReportSection title="Collector Trend">
          <ReportsViewerChart chart={chart} forceChartType="line" />
        </ReportSection>
      ) : null}
      {rawTable ? (
        <ReportSection title="Activity by Period">
          <ReportsViewerDataTable section={rawTable} />
        </ReportSection>
      ) : null}
    </div>
  );
}

function renderCollectorLeaderboardReport(report: ReportsViewerPageData) {
  return renderAnalyticsChartAndTableReport(report, {
    chartKey: "collectorLeaderboardChart",
    chartTitle: "Collector Leaderboard",
    tableKey: "collectorLeaderboardRawData",
    tableTitle: "Collector Ranking Table",
  });
}

function renderBorrowerLoanSchedule(report: ReportsViewerPageData) {
  const borrowerDetails = findFieldListSection(report.snapshot, "borrowerDetails");
  const loanSummary =
    findFieldListSection(report.snapshot, "loanSummary") ?? findFieldListSection(report.snapshot, "loanScheduleSummary");
  const scheduleTable = findTableSection(report.snapshot, "loanScheduleTable");
  const scheduleTableForView =
    scheduleTable && scheduleTable.columns.some((column) => column.key === "collector")
      ? omitTableColumn(scheduleTable, "collector")
      : scheduleTable;

  return (
    <div className="space-y-8">
      <DocumentHeader subtitle={report.snapshot.generatedLabel} title={report.title} />
      <CompactSummary items={report.snapshot.summaryCards} title="Payment Summary" />
      <div className="grid gap-6 lg:grid-cols-2">
        {borrowerDetails ? <FieldListBlock columns={1} section={borrowerDetails} /> : null}
        {loanSummary ? <FieldListBlock columns={1} section={loanSummary} /> : null}
      </div>
      {scheduleTableForView ? (
        <ReportSection title="Loan Schedule">
          <ReportsViewerDataTable
            section={scheduleTableForView}
            cellClassNames={{
              amount: "whitespace-nowrap",
              dailyPayment: "whitespace-nowrap",
              date: "whitespace-nowrap",
              outstandingBalance: "whitespace-nowrap",
              principalPlusInterest: "whitespace-nowrap",
            }}
            columnWidths={{
              date: "7rem",
              principalPlusInterest: "7.25rem",
              dailyPayment: "7rem",
              outstandingBalance: "7.25rem",
              amount: "7rem",
              note: "auto",
            }}
          />
        </ReportSection>
      ) : (
        <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-sm text-muted-foreground">
          This older saved schedule does not include the per-day loan schedule table yet.
        </div>
      )}
    </div>
  );
}

function renderCollectionReceipt(report: ReportsViewerPageData) {
  const branchHeader = findFieldListSection(report.snapshot, "receiptHeader");
  const receiptDetails = findFieldListSection(report.snapshot, "receiptDetails");
  const paymentDetails = findFieldListSection(report.snapshot, "paymentDetails");
  const branchHeaderMap = buildFieldListRowMap(branchHeader);
  const receiptDetailsMap = buildFieldListRowMap(receiptDetails);
  const paymentDetailsMap = buildFieldListRowMap(paymentDetails);
  const branchName =
    getFieldRowValue(branchHeaderMap, "Branch", report.branchScopeNames[0] ?? report.snapshot.scopeLabel) ??
    "Branch";
  const branchAddress = getFieldRowValue(branchHeaderMap, "Branch Address");
  const { addressLine, localityLine } = splitReceiptAddress(branchAddress);
  const amountCollected = getSummaryCardNumber(report.snapshot, "amount");
  const remainingBalance = getSummaryCardNumber(report.snapshot, "remainingBalanceAfterPayment");
  const collectionCode =
    getFieldRowValue(
      receiptDetailsMap,
      "Receipt No.",
      typeof report.snapshot.meta.collectionCode === "string" ? report.snapshot.meta.collectionCode : "N/A",
    ) ?? "N/A";
  const collectionDate = getFieldRowValue(receiptDetailsMap, "Collection Date");
  const borrower = getFieldRowValue(receiptDetailsMap, "Borrower", "N/A") ?? "N/A";
  const borrowerCompanyId = getFieldRowValue(receiptDetailsMap, "Borrower Company ID", "N/A") ?? "N/A";
  const loanCode = getFieldRowValue(receiptDetailsMap, "Loan Code", "N/A") ?? "N/A";
  const collector = getFieldRowValue(receiptDetailsMap, "Collector", "N/A") ?? "N/A";
  const encodedBy = getFieldRowValue(receiptDetailsMap, "Encoded By", "N/A") ?? "N/A";
  const note = getFieldRowValue(paymentDetailsMap, "Note") ?? getFieldRowValue(receiptDetailsMap, "Note");

  return (
    <ReceiptPaper>
      <div className="space-y-4">
        <header className="space-y-1 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-black">
            Sum Finance Services Corp.
          </p>
          <div className="space-y-0.5 text-[10px] leading-4 text-black/70">
            <p className="font-semibold uppercase tracking-[0.18em] text-black">{branchName}</p>
            {localityLine ? <p>{localityLine}</p> : null}
            {addressLine ? <p>{addressLine}</p> : null}
          </div>
        </header>

        <ReceiptDivider />

        <div className="space-y-1 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-black/70">
            Collection Receipt
          </p>
          <p className="text-[13px] font-semibold tracking-[0.18em] text-black">{collectionCode}</p>
        </div>

        <ReceiptDivider />

        <div className="space-y-1.5 text-center">
          <p className="text-[10px] uppercase tracking-[0.24em] text-black/60">Amount Collected</p>
          <p className="text-[24px] font-semibold tracking-tight text-black">
            {formatReceiptMoney(amountCollected)}
          </p>
          <p className="text-[10px] text-black/65">
            Collected on {formatReceiptDate(collectionDate)}
          </p>
        </div>

        <ReceiptSection title="Transaction">
          <ReceiptMetaRow label="Borrower" value={borrower} />
          <ReceiptMetaRow label="Company ID" value={borrowerCompanyId} />
          <ReceiptMetaRow label="Loan Code" value={loanCode} />
          <ReceiptMetaRow label="Collection Date" value={formatReceiptDate(collectionDate)} />
          <ReceiptMetaRow label="Balance After" value={formatReceiptMoney(remainingBalance)} />
        </ReceiptSection>

        <ReceiptSection title="Actors">
          <ReceiptMetaRow label="Collector" value={collector} />
          <ReceiptMetaRow label="Encoded By" value={encodedBy} />
          <ReceiptMetaRow label="Receipt Made By" value={formatReceiptGeneratedBy(report)} />
          <ReceiptMetaRow label="Receipt Date" value={formatReceiptDateTime(report.generatedAt)} />
        </ReceiptSection>

        {note ? (
          <ReceiptSection title="Note">
            <div className="py-1 text-[11px] leading-5 text-black">{note}</div>
          </ReceiptSection>
        ) : null}

        <ReceiptDivider />

        <div className="space-y-1 pt-1 text-center text-[10px] uppercase tracking-[0.18em] text-black/60">
          <p>Saved collection snapshot copy</p>
          <p>Generated by SumTrack</p>
        </div>
      </div>
    </ReceiptPaper>
  );
}

function renderLoanReceiptSummary(report: ReportsViewerPageData) {
  const summarySection = findFieldListSection(report.snapshot, "loanReceiptHeader");
  const historyTable = findTableSection(report.snapshot, "collectionHistory");
  const completionStatement = findFieldListSection(report.snapshot, "completionStatement");
  const summaryMap = buildFieldListRowMap(summarySection);
  const branchName =
    getFieldRowValue(summaryMap, "Branch", report.branchScopeNames[0] ?? report.snapshot.scopeLabel) ?? "Branch";
  const branchAddress = getFieldRowValue(summaryMap, "Branch Address");
  const { addressLine, localityLine } = splitReceiptAddress(branchAddress);
  const borrower = getFieldRowValue(summaryMap, "Borrower", "N/A") ?? "N/A";
  const borrowerCompanyId = getFieldRowValue(summaryMap, "Borrower Company ID", "N/A") ?? "N/A";
  const loanCode = getFieldRowValue(summaryMap, "Loan Code", "N/A") ?? "N/A";
  const collector = getFieldRowValue(summaryMap, "Collector", "N/A") ?? "N/A";
  const releaseDate = getFieldRowValue(summaryMap, "Release Date");
  const completionDate = getFieldRowValue(summaryMap, "Completion Date");
  const status = getFieldRowValue(summaryMap, "Status", "N/A") ?? "N/A";
  const normalizedStatus = status.trim().toLowerCase();
  const isCompletedLoanReceipt =
    normalizedStatus === "completed" || normalizedStatus === "archived" || normalizedStatus === "abandoned";
  const principal = getFieldRowValue(summaryMap, "Principal");
  const principalAmount = parseNumericText(principal);
  const interest = getFieldRowValue(summaryMap, "Interest");
  const totalPaid = getSummaryCardNumber(report.snapshot, "totalPaid");
  const totalPayable = getSummaryCardNumber(report.snapshot, "totalPayable");
  const remainingBalance = getSummaryCardNumber(report.snapshot, "outstandingBalance");
  const collectionCount = getSummaryCardNumber(report.snapshot, "collectionCount");
  const statement = completionStatement?.rows[0]?.value?.trim() || null;
  const latestPaymentDate =
    historyTable?.rows.reduce<string | null>((latestValue, row) => {
      if (typeof row.collectionDate !== "string" || !row.collectionDate.trim()) {
        return latestValue;
      }

      if (!latestValue || row.collectionDate > latestValue) {
        return row.collectionDate;
      }

      return latestValue;
    }, null) ?? null;

  return (
    <ReceiptPaper>
      <div className="space-y-4">
        <header className="space-y-1 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-black">
            Sum Finance Services Corp.
          </p>
          <div className="space-y-0.5 text-[10px] leading-4 text-black/70">
            <p className="font-semibold uppercase tracking-[0.18em] text-black">{branchName}</p>
            {localityLine ? <p>{localityLine}</p> : null}
            {addressLine ? <p>{addressLine}</p> : null}
          </div>
        </header>

        <ReceiptDivider />

        <div className="space-y-1 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-black/70">
            Loan Receipt Summary
          </p>
          <p className="text-[13px] font-semibold tracking-[0.18em] text-black">{loanCode}</p>
        </div>

        <ReceiptDivider />

        <div className="space-y-1.5 text-center">
          <p className="text-[10px] uppercase tracking-[0.24em] text-black/60">
            {isCompletedLoanReceipt ? "Total Paid" : "Total Paid So Far"}
          </p>
          <p className="text-[24px] font-semibold tracking-tight text-black">
            {formatReceiptMoney(totalPaid)}
          </p>
          <p className="text-[10px] text-black/65">
            {isCompletedLoanReceipt
              ? `Completion date ${formatReceiptDate(completionDate)}`
              : latestPaymentDate
                ? `Latest payment ${formatReceiptDate(latestPaymentDate)}`
                : `Snapshot date ${formatReceiptDateTime(report.generatedAt)}`}
          </p>
        </div>

        <ReceiptSection title="Loan Details">
          <ReceiptMetaRow label="Borrower" value={borrower} />
          <ReceiptMetaRow label="Company ID" value={borrowerCompanyId} />
          <ReceiptMetaRow label="Collector" value={collector} />
          <ReceiptMetaRow label={isCompletedLoanReceipt ? "Status" : "Current Status"} value={status} />
          <ReceiptMetaRow label="Release Date" value={formatReceiptDate(releaseDate)} />
          {isCompletedLoanReceipt ? (
            <ReceiptMetaRow label="Completion Date" value={formatReceiptDate(completionDate)} />
          ) : latestPaymentDate ? (
            <ReceiptMetaRow label="Latest Payment" value={formatReceiptDate(latestPaymentDate)} />
          ) : null}
          {!isCompletedLoanReceipt ? (
            <ReceiptMetaRow label="Snapshot Date" value={formatReceiptDateTime(report.generatedAt)} />
          ) : null}
        </ReceiptSection>

        <ReceiptSection title={isCompletedLoanReceipt ? "Settlement" : "Current Position"}>
          {principal ? (
            <ReceiptMetaRow
              label="Principal"
              value={principalAmount !== null ? formatReceiptMoney(principalAmount) : principal}
            />
          ) : null}
          {interest ? <ReceiptMetaRow label="Interest" value={interest} /> : null}
          <ReceiptMetaRow label="Total Payable" value={formatReceiptMoney(totalPayable)} />
          <ReceiptMetaRow
            label={isCompletedLoanReceipt ? "Total Paid" : "Total Paid So Far"}
            value={formatReceiptMoney(totalPaid)}
          />
          <ReceiptMetaRow label="Remaining Balance" value={formatReceiptMoney(remainingBalance)} />
          {!isCompletedLoanReceipt && collectionCount !== null ? (
            <ReceiptMetaRow label="Collections Recorded" value={String(collectionCount)} />
          ) : null}
        </ReceiptSection>

        {historyTable && historyTable.rows.length > 0 ? (
          <ReceiptSection title="Payment Trail">
            <div className="space-y-3">
              {historyTable.rows.map((row, index) => {
                const paymentDate =
                  typeof row.collectionDate === "string" ? formatReceiptDate(row.collectionDate) : "N/A";
                const paymentCode =
                  typeof row.collectionCode === "string" && row.collectionCode.trim()
                    ? row.collectionCode
                    : `Payment ${index + 1}`;
                const amount =
                  typeof row.amount === "number" ? formatReceiptMoney(row.amount) : String(row.amount ?? "N/A");
                const note =
                  typeof row.note === "string" && row.note.trim() && row.note !== "-"
                    ? row.note
                    : null;

                return (
                  <div className="space-y-1.5 py-1" key={`${paymentCode}-${index}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-semibold leading-5 text-black">{paymentCode}</p>
                        <p className="text-[10px] leading-4 text-black/60">{paymentDate}</p>
                      </div>
                      <p className="text-[11px] font-semibold leading-5 text-black">{amount}</p>
                    </div>
                    {note ? <p className="text-[10px] leading-4 text-black/65">{note}</p> : null}
                  </div>
                );
              })}
            </div>
          </ReceiptSection>
        ) : null}

        <ReceiptSection title="Receipt Info">
          <ReceiptMetaRow label="Receipt Made By" value={formatReceiptGeneratedBy(report)} />
          <ReceiptMetaRow label="Receipt Date" value={formatReceiptDateTime(report.generatedAt)} />
        </ReceiptSection>

        {statement ? (
          <>
            <ReceiptDivider />
            <p className="text-center text-[10px] uppercase leading-5 tracking-[0.18em] text-black/60">
              {statement}
            </p>
          </>
        ) : null}
      </div>
    </ReceiptPaper>
  );
}

function renderReportBody(report: ReportsViewerPageData) {
  if (report.templateKey === "financial_overview") {
    return renderFinancialOverview(report);
  }

  if (report.templateKey === "collections_summary" || report.templateKey === "monthly_collections_summary") {
    return renderCollectionsSummary(report);
  }

  if (report.templateKey === "active_loans_summary") {
    return renderActiveLoansSummary(report);
  }

  if (report.templateKey === "loans_summary") {
    return renderLoansSummary(report);
  }

  if (report.templateKey === "overdue_loans_report") {
    return renderOverdueLoansReport(report);
  }

  if (report.templateKey === "collections_by_collector") {
    return renderCollectionsByCollector(report);
  }

  if (report.templateKey === "released_loans_report") {
    return renderReleasedLoansReport(report);
  }

  if (report.templateKey === "closed_loans_report") {
    return renderClosedLoansReport(report);
  }

  if (report.templateKey === "branch_performance_comparison") {
    return renderBranchPerformanceComparison(report);
  }

  if (report.templateKey === "branch_performance_overview") {
    return renderBranchPerformanceOverview(report);
  }

  if (report.templateKey === "branch_collections_comparison") {
    return renderBranchCollectionsComparison(report);
  }

  if (report.templateKey === "branch_loans_comparison") {
    return renderBranchLoansComparison(report);
  }

  if (report.templateKey === "borrower_summary") {
    return renderBorrowerSummary(report);
  }

  if (report.templateKey === "borrowers_with_overdue_loans") {
    return renderBorrowersWithOverdueLoans(report);
  }

  if (report.templateKey === "collector_performance_report") {
    return renderCollectorPerformanceReport(report);
  }

  if (report.templateKey === "collector_leaderboard_report") {
    return renderCollectorLeaderboardReport(report);
  }

  if (report.templateKey === "borrower_loan_schedule") {
    return renderBorrowerLoanSchedule(report);
  }

  if (report.templateKey === "collection_receipt") {
    return renderCollectionReceipt(report);
  }

  if (report.templateKey === "loan_receipt_summary") {
    return renderLoanReceiptSummary(report);
  }

  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-sm text-muted-foreground">
      This saved report template is not supported by the current viewer yet.
    </div>
  );
}

export function ReportsViewPage(props: { backHref?: string; report: ReportsViewerPageData }) {
  const isDocument = props.report.reportCategory === "document";
  const isReceiptDocument = isReceiptTemplate(props.report);
  const reportContentRef = useRef<HTMLDivElement | null>(null);
  const receiptContentRef = useRef<HTMLDivElement | null>(null);
  const csvAvailable = canExportCsv(props.report);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="space-y-5">
        <Link href={props.backHref ?? "/dashboard/reports"}>
          <Button className="gap-2 px-0 text-muted-foreground hover:text-foreground" variant="ghost">
            <ArrowLeft className="h-4 w-4" />
            Back to Reports Library
          </Button>
        </Link>

        <article
          className={
            isReceiptDocument
              ? "mx-auto max-w-5xl rounded-[2rem] border border-border/70 bg-muted/15 px-4 py-6 shadow-sm md:px-8"
              : "mx-auto max-w-5xl rounded-2xl border border-border/70 bg-background px-6 py-8 shadow-sm md:px-10"
          }
        >
          {isReceiptDocument ? (
            <div className="space-y-8">
              <header className="space-y-2 text-center print:hidden">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Saved Receipt Preview</p>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">{props.report.title}</h1>
                <p className="mx-auto max-w-xl text-sm text-muted-foreground">
                  Receipt-formatted output generated from the saved snapshot. Print and PDF export use a narrow
                  thermal-style paper layout.
                </p>
              </header>

              <div data-print-layout="receipt" ref={receiptContentRef}>
                {renderReportBody(props.report)}
              </div>
            </div>
          ) : (
            <div ref={reportContentRef}>
              <header className="space-y-4 border-b border-border/70 pb-6">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    {isDocument ? "Saved Document" : "Saved Report"}
                  </p>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">{props.report.title}</h1>
                  <p className="text-sm text-muted-foreground">{props.report.templateLabel}</p>
                </div>
                <ReportMetadata report={props.report} />
              </header>

              <div className="pt-8">{renderReportBody(props.report)}</div>
            </div>
          )}

          <div className="mt-10 border-t border-border/70 pt-5">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button
                disabled={!csvAvailable}
                onClick={() => exportReportCsv(props.report)}
                type="button"
                variant="outline"
              >
                Export CSV
              </Button>
              <Button
                onClick={() =>
                  printReportContent({
                    report: props.report,
                    contentNode: isReceiptDocument ? receiptContentRef.current : reportContentRef.current,
                    mode: "pdf",
                  })
                }
                type="button"
                variant="outline"
              >
                Export PDF
              </Button>
              <Button
                onClick={() =>
                  printReportContent({
                    report: props.report,
                    contentNode: isReceiptDocument ? receiptContentRef.current : reportContentRef.current,
                    mode: "print",
                  })
                }
                type="button"
              >
                Print
              </Button>
            </div>
            {!csvAvailable ? (
              <p className="mt-3 text-right text-xs text-muted-foreground">
                CSV export is only available when this saved snapshot contains a natural raw table.
              </p>
            ) : null}
          </div>
        </article>
      </div>
    </main>
  );
}
