"use client";

import { toast } from "sonner";
import type {
  ReportsSnapshotTableSection,
  ReportsViewerPageData,
} from "@/app/dashboard/reports/types";

type CsvDataset = {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, number | string>>;
};

function notifyReportExport(reportId: number, format: "csv" | "pdf" | "print") {
  return fetch(`/dashboard/reports/${reportId}/export`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ format }),
    keepalive: true,
  }).catch(() => undefined);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatCsvCell(value: unknown) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function resolveCsvTable(report: ReportsViewerPageData): ReportsSnapshotTableSection | null {
  const tableSections = report.snapshot.sections.filter(
    (section): section is ReportsSnapshotTableSection => section.type === "table",
  );

  if (report.templateKey === "collections_summary" || report.templateKey === "monthly_collections_summary") {
    return (
      tableSections.find((section) => section.key === "collectionsRawData") ??
      tableSections.find((section) => section.key === "dailyRawData") ??
      tableSections.find((section) => section.key === "branchBreakdown") ??
      null
    );
  }

  if (report.templateKey === "active_loans_summary") {
    return tableSections.find((section) => section.key === "branchLiveLoans") ?? null;
  }

  if (report.templateKey === "loans_summary") {
    return tableSections.find((section) => section.key === "loansSummaryRawData") ?? null;
  }

  if (report.templateKey === "overdue_loans_report") {
    return tableSections.find((section) => section.key === "overdueLoansRawData") ?? null;
  }

  if (report.templateKey === "collections_by_collector") {
    return tableSections.find((section) => section.key === "collectionsByCollectorRawData") ?? null;
  }

  if (report.templateKey === "released_loans_report") {
    return tableSections.find((section) => section.key === "releasedLoansRawData") ?? null;
  }

  if (report.templateKey === "closed_loans_report") {
    return tableSections.find((section) => section.key === "closedLoansRawData") ?? null;
  }

  if (report.templateKey === "branch_performance_comparison") {
    return tableSections.find((section) => section.key === "branchComparison") ?? null;
  }

  if (report.templateKey === "branch_performance_overview") {
    return tableSections.find((section) => section.key === "branchPerformanceOverviewMetrics") ?? null;
  }

  if (report.templateKey === "branch_collections_comparison") {
    return tableSections.find((section) => section.key === "branchCollectionsComparisonRawData") ?? null;
  }

  if (report.templateKey === "branch_loans_comparison") {
    return tableSections.find((section) => section.key === "branchLoansComparisonRawData") ?? null;
  }

  if (report.templateKey === "borrower_summary") {
    return tableSections.find((section) => section.key === "borrowerSummaryRawData") ?? null;
  }

  if (report.templateKey === "borrowers_with_overdue_loans") {
    return tableSections.find((section) => section.key === "borrowersWithOverdueLoansRawData") ?? null;
  }

  if (report.templateKey === "expenses_overview") {
    return tableSections.find((section) => section.key === "expenseRegister") ?? null;
  }

  if (report.templateKey === "collector_performance_report") {
    return tableSections.find((section) => section.key === "collectorPerformanceRawData") ?? null;
  }

  if (report.templateKey === "collector_leaderboard_report") {
    return tableSections.find((section) => section.key === "collectorLeaderboardRawData") ?? null;
  }

  if (report.templateKey === "borrower_loan_schedule") {
    return tableSections.find((section) => section.key === "loanScheduleTable") ?? null;
  }

  if (report.templateKey === "loan_receipt_summary") {
    return tableSections.find((section) => section.key === "collectionHistory") ?? null;
  }

  return null;
}

function datasetFromTable(table: ReportsSnapshotTableSection): CsvDataset {
  return {
    columns: table.columns.map((column) => ({ key: column.key, label: column.label })),
    rows: table.rows,
  };
}

function resolveFinancialOverviewCsvDataset(report: ReportsViewerPageData): CsvDataset | null {
  const tableSections = report.snapshot.sections.filter(
    (section): section is ReportsSnapshotTableSection => section.type === "table",
  );
  const preferredSections = tableSections;

  if (preferredSections.length === 0) {
    return null;
  }

  const columns: CsvDataset["columns"] = [{ key: "section", label: "Section" }];
  const seenColumnKeys = new Set(["section"]);

  for (const section of preferredSections) {
    for (const column of section.columns) {
      if (seenColumnKeys.has(column.key)) {
        continue;
      }

      columns.push({ key: column.key, label: column.label });
      seenColumnKeys.add(column.key);
    }
  }

  return {
    columns,
    rows: preferredSections.flatMap((section) =>
      section.rows.map((row) => ({
        section: section.title,
        ...row,
      })),
    ),
  };
}

function resolveCsvDataset(report: ReportsViewerPageData): CsvDataset | null {
  if (report.templateKey === "financial_overview") {
    return resolveFinancialOverviewCsvDataset(report);
  }

  if (report.templateKey === "expenses_overview") {
    return resolveFinancialOverviewCsvDataset(report);
  }

  if (report.templateKey === "incentive_payout_history") {
    return resolveFinancialOverviewCsvDataset(report);
  }

  const table = resolveCsvTable(report);
  return table ? datasetFromTable(table) : null;
}

export function canExportCsv(report: ReportsViewerPageData) {
  if (report.templateKey === "collection_receipt") {
    return false;
  }

  return resolveCsvDataset(report) !== null;
}

export function exportReportCsv(report: ReportsViewerPageData) {
  const dataset = resolveCsvDataset(report);

  if (!dataset) {
    toast.error("CSV export is not available for this saved report.");
    return;
  }

  const header = dataset.columns.map((column) => formatCsvCell(column.label)).join(",");
  const rows = dataset.rows.map((row) =>
    dataset.columns
      .map((column) => formatCsvCell(row[column.key] ?? ""))
      .join(","),
  );

  const csv = ["\uFEFF" + header, ...rows].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(report.title) || "saved-report"}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  void notifyReportExport(report.reportId, "csv");
}

function isThermalReceiptReport(report: ReportsViewerPageData) {
  return report.templateKey === "collection_receipt" || report.templateKey === "loan_receipt_summary";
}

function shouldShowHeaderFooterReminder(report: ReportsViewerPageData) {
  return report.reportCategory === "analytics" || report.templateKey === "borrower_loan_schedule";
}

export function printReportContent(params: {
  report: ReportsViewerPageData;
  contentNode: HTMLElement | null;
  mode: "print" | "pdf";
}) {
  const mode = params.mode === "pdf" ? "pdf" : "print";
  const printUrl = `/reports-print/${params.report.reportId}?mode=${mode}`;
  const popup = window.open(printUrl, "_blank");

  if (mode === "pdf") {
    void notifyReportExport(params.report.reportId, "pdf");
    toast.message(
      isThermalReceiptReport(params.report)
        ? "Use your browser's print dialog and choose Save as PDF. Thermal receipts are sized for 80mm paper."
        : shouldShowHeaderFooterReminder(params.report)
          ? "Use your browser's print dialog and choose Save as PDF. Turn off Headers and Footers to remove the browser date/URL/page markers."
          : "Use your browser's print dialog and choose Save as PDF.",
    );
  } else {
    void notifyReportExport(params.report.reportId, "print");
    if (shouldShowHeaderFooterReminder(params.report)) {
      toast.message("For clean output, disable browser Headers and Footers in the print dialog.");
    }
  }

  if (popup) {
    return;
  }
  toast.error("Unable to open print preview. Please allow popups for this site.");
}
