"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";

export type ExportIncentiveRow = {
  employeeName: string;
  companyId: string;
  roleName: string;
  branchName: string;
  baseAmount: string;
  percentValue: string;
  flatAmount: string;
  computedIncentive: string;
};

type ExportPrintToolsProps = {
  rows: ExportIncentiveRow[];
  fileName: string;
  modeLabel: string;
};

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

export function ExportPrintTools({ rows, fileName, modeLabel }: ExportPrintToolsProps) {
  const csvContent = useMemo(() => {
    const header = [
      "Employee Name",
      "Company ID",
      "Role",
      "Branch",
      "Base Amount",
      "Percent Value",
      "Flat Amount",
      "Computed Incentive",
      "Source Mode",
    ];
    const body = rows.map((row) =>
      [
        row.employeeName,
        row.companyId,
        row.roleName,
        row.branchName,
        row.baseAmount,
        row.percentValue,
        row.flatAmount,
        row.computedIncentive,
        modeLabel,
      ]
        .map((cell) => escapeCsv(cell))
        .join(","),
    );

    return [header.join(","), ...body].join("\n");
  }, [modeLabel, rows]);

  function handleExport() {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => window.print()} type="button" variant="outline">
        Print
      </Button>
      <Button disabled={rows.length === 0} onClick={handleExport} type="button" variant="secondary">
        Export CSV
      </Button>
    </div>
  );
}
