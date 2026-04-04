"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/app/dashboard/expenses/format";
import type { ExpenseListRow } from "@/app/dashboard/expenses/types";
import { formatStoredDateTimeForManila } from "@/app/dashboard/datetime";

const headerRowClassName = "border-border/70 bg-[var(--app-table-header)]";

function formatRecordedByName(row: ExpenseListRow) {
  const companyIdSuffix = row.recordedByCompanyId ? ` (${row.recordedByCompanyId})` : "";

  if (row.recordedByFirstName && row.recordedByLastName) {
    const middleInitial = row.recordedByMiddleName?.trim()
      ? `${row.recordedByMiddleName.trim().charAt(0)}.`
      : null;

    return `${[row.recordedByFirstName, middleInitial, row.recordedByLastName].filter(Boolean).join(" ")}${companyIdSuffix}`;
  }

  if (row.recordedByUsername) {
    return `${row.recordedByUsername}${companyIdSuffix}`;
  }

  return row.recordedByCompanyId ?? "N/A";
}

function recordedByRoleBadgeClass(roleName: string | null) {
  if (roleName === "Admin") return "whitespace-nowrap border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300";
  if (roleName === "Auditor") return "whitespace-nowrap border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300";
  if (roleName === "Branch Manager") return "whitespace-nowrap border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
  if (roleName === "Secretary") return "whitespace-nowrap border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300";
  if (roleName === "Collector") return "whitespace-nowrap border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
  return "whitespace-nowrap border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100";
}

function ExpandedDetailRows(props: {
  details: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="space-y-3">
      {props.details.map((detail) => (
        <div
          className="grid items-start gap-x-6 gap-y-1 border-b border-border/50 pb-3 last:border-b-0 last:pb-0 md:grid-cols-[160px_minmax(0,1fr)]"
          key={`${detail.label}-${detail.value}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 md:pt-1">
            {detail.label}
          </p>
          <p className="text-sm leading-6 text-foreground">{detail.value}</p>
        </div>
      ))}
    </div>
  );
}

function buildExpenseDetails(row: ExpenseListRow) {
  return [
    { label: "Expense ID", value: String(row.expenseId) },
    { label: "Branch", value: row.branchName },
    { label: "Description", value: row.description || "-" },
    { label: "Recorded At", value: formatStoredDateTimeForManila(row.recordedAt) },
  ];
}

export function ExpensesTable({ expenses }: { expenses: ExpenseListRow[] }) {
  const [expandedExpenseId, setExpandedExpenseId] = useState<number | null>(null);

  if (expenses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-12 text-center">
        <p className="text-base font-medium text-foreground">No expenses found for the selected filters.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Try adjusting the branch, period, or category to widen the result set.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border">
      <Table className="[&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:first-child]:pl-5 [&_th:last-child]:pr-5">
        <TableHeader>
          <TableRow className={headerRowClassName}>
            <TableHead>Category</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Expense Date</TableHead>
            <TableHead>Recorded By</TableHead>
            <TableHead aria-label="Details" className="w-[9rem] text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((row) => {
            const isExpanded = expandedExpenseId === row.expenseId;

            return (
              <Fragment key={row.expenseId}>
                <TableRow>
                  <TableCell>{row.category}</TableCell>
                  <TableCell className="font-medium">{formatMoney(row.amount)}</TableCell>
                  <TableCell>{row.expenseDate}</TableCell>
                  <TableCell className="max-w-80 whitespace-normal">
                    <div className="flex min-w-0 flex-wrap items-start gap-2">
                      {row.recordedByRoleName ? (
                        <Badge className={recordedByRoleBadgeClass(row.recordedByRoleName)} variant="outline">
                          {row.recordedByRoleName}
                        </Badge>
                      ) : null}
                      <span className="min-w-0 flex-1 whitespace-normal wrap-break-word text-sm leading-5 text-foreground">
                        {formatRecordedByName(row)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      className="text-muted-foreground"
                      onClick={() =>
                        setExpandedExpenseId((current) => (current === row.expenseId ? null : row.expenseId))
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {isExpanded ? "Hide details" : "View details"}
                      {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    </Button>
                  </TableCell>
                </TableRow>
                {isExpanded ? (
                  <TableRow className="bg-zinc-50/60 hover:bg-zinc-50/60 dark:bg-white/[0.04] dark:hover:bg-white/[0.04]">
                    <TableCell className="p-0" colSpan={5}>
                      <div className="border-t border-border/70 px-5 py-4">
                        <ExpandedDetailRows details={buildExpenseDetails(row)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
