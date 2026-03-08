import type { ExportIncentiveRow } from "@/app/dashboard/incentives/export-print-tools";
import type { IncentiveRow } from "@/app/dashboard/incentives/lib";

export function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: number) {
  return `${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export function sectionTotal(rows: IncentiveRow[]) {
  return rows.reduce((sum, row) => sum + (row.computedIncentive ?? 0), 0);
}

export function toExportRows(rows: IncentiveRow[]): ExportIncentiveRow[] {
  return rows.map((row) => ({
    employeeName: row.employeeName,
    companyId: row.companyId,
    roleName: row.roleName,
    branchName: row.branchName,
    baseAmount: formatMoney(row.baseAmount),
    percentValue: row.percentValue === null ? "No incentive rule configured" : formatPercent(row.percentValue),
    flatAmount: row.flatAmount === null ? "No incentive rule configured" : formatMoney(row.flatAmount),
    computedIncentive:
      row.computedIncentive === null ? "No incentive rule configured" : formatMoney(row.computedIncentive),
  }));
}
