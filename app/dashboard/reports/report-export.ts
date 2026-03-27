"use client";

import { toast } from "sonner";
import type {
  ReportsSnapshotTableSection,
  ReportsViewerPageData,
} from "@/app/dashboard/reports/types";

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

  if (report.templateKey === "financial_overview") {
    return (
      tableSections.find((section) => section.key === "periodBreakdown") ??
      tableSections.find((section) => section.key === "branchFinancialSummary") ??
      null
    );
  }

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

export function canExportCsv(report: ReportsViewerPageData) {
  if (report.templateKey === "collection_receipt") {
    return false;
  }

  return resolveCsvTable(report) !== null;
}

export function exportReportCsv(report: ReportsViewerPageData) {
  const table = resolveCsvTable(report);

  if (!table) {
    toast.error("CSV export is not available for this saved report.");
    return;
  }

  const header = table.columns.map((column) => formatCsvCell(column.label)).join(",");
  const rows = table.rows.map((row) =>
    table.columns
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
}

function copyComputedStyles(source: Element, target: Element) {
  const computedStyle = window.getComputedStyle(source);
  const cssText = Array.from(computedStyle).map((property) => `${property}:${computedStyle.getPropertyValue(property)};`).join("");
  target.setAttribute("style", cssText);
}

function cloneNodeWithInlineStyles<T extends HTMLElement>(sourceNode: T) {
  const clonedNode = sourceNode.cloneNode(true) as T;
  const sourceElements = [sourceNode, ...Array.from(sourceNode.querySelectorAll("*"))];
  const targetElements = [clonedNode, ...Array.from(clonedNode.querySelectorAll("*"))];

  sourceElements.forEach((element, index) => {
    const clonedElement = targetElements[index];
    if (clonedElement) {
      copyComputedStyles(element, clonedElement);
    }
  });

  return clonedNode;
}

function normalizePrintLayout(rootNode: HTMLElement) {
  const elements = [rootNode, ...Array.from(rootNode.querySelectorAll("*"))];

  elements.forEach((element) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    if (
      element.style.overflowX === "auto" ||
      element.style.overflowX === "scroll" ||
      element.style.overflowY === "auto" ||
      element.style.overflowY === "scroll" ||
      element.style.overflow === "auto" ||
      element.style.overflow === "scroll" ||
      element.style.overflow === "hidden"
    ) {
      element.style.overflow = "visible";
      element.style.overflowX = "visible";
      element.style.overflowY = "visible";
    }

    if (element.style.height && element.style.height !== "auto") {
      element.style.height = "auto";
    }

    if (element.style.maxHeight && element.style.maxHeight !== "none") {
      element.style.maxHeight = "none";
    }

    if (element.style.minHeight && element.style.minHeight !== "0px") {
      element.style.minHeight = "0";
    }
  });
}

function isThermalReceiptReport(report: ReportsViewerPageData) {
  return report.templateKey === "collection_receipt" || report.templateKey === "loan_receipt_summary";
}

function buildPrintDocumentHtml(params: {
  title: string;
  contentHtml: string;
  layout: "default" | "receipt";
}) {
  const pageRule =
    params.layout === "receipt"
      ? `
      @page {
        size: 80mm auto;
        margin: 0;
      }
    `
      : `
      @page {
        size: auto;
        margin: 16mm;
      }
    `;

  const bodyRule =
    params.layout === "receipt"
      ? `
      body {
        width: 80mm;
        min-width: 80mm;
        padding: 3mm 4mm 6mm;
        margin: 0 auto;
      }

      * {
        box-shadow: none !important;
      }
    `
      : `
      body {
        padding: 24px;
      }
    `;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${params.title}</title>
    <style>
      ${pageRule}

      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #0f172a;
        font-family: Arial, Helvetica, sans-serif;
      }

      ${bodyRule}

      a, button {
        display: none !important;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        page-break-inside: auto;
      }

      th, td {
        vertical-align: top;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      thead {
        display: table-header-group;
      }

      tfoot {
        display: table-footer-group;
      }

      svg {
        max-width: 100%;
        height: auto;
      }
    </style>
  </head>
  <body>
    ${params.contentHtml}
  </body>
</html>`;
}

function createPrintFrame(reportTitle: string, reportContentNode: HTMLElement) {
  const layout = reportContentNode.dataset.printLayout === "receipt" ? "receipt" : "default";
  const clonedNode = cloneNodeWithInlineStyles(reportContentNode);
  normalizePrintLayout(clonedNode);
  const existingFrame = document.getElementById("reports-print-frame");
  if (existingFrame) {
    existingFrame.remove();
  }

  const iframe = document.createElement("iframe");
  iframe.id = "reports-print-frame";
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";

  document.body.appendChild(iframe);

  const frameDocument = iframe.contentDocument;
  if (!frameDocument) {
    iframe.remove();
    toast.error("Unable to prepare the print document right now.");
    return null;
  }

  frameDocument.open();
  frameDocument.write(
    buildPrintDocumentHtml({
      title: reportTitle,
      contentHtml: clonedNode.outerHTML,
      layout,
    }),
  );
  frameDocument.close();

  return iframe;
}

export function printReportContent(params: {
  report: ReportsViewerPageData;
  contentNode: HTMLElement | null;
  mode: "print" | "pdf";
}) {
  if (!params.contentNode) {
    toast.error("The saved report content is not ready to print yet.");
    return;
  }

  const printFrame = createPrintFrame(params.report.title, params.contentNode);
  if (!printFrame) {
    return;
  }

  const runPrint = () => {
    const frameWindow = printFrame.contentWindow;
    if (!frameWindow) {
      printFrame.remove();
      toast.error("Unable to access the print document right now.");
      return;
    }

    if (params.mode === "pdf") {
      toast.message(
        isThermalReceiptReport(params.report)
          ? "Use your browser's print dialog and choose Save as PDF. Thermal receipts are sized for 80mm paper."
          : "Use your browser's print dialog and choose Save as PDF.",
      );
    }

    frameWindow.focus();
    frameWindow.print();

    window.setTimeout(() => {
      printFrame.remove();
    }, 1500);
  };

  window.setTimeout(runPrint, 150);
}
