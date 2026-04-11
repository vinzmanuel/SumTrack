"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  getUiRoleBadgeClassName,
  UI_TABLE_HEADER_ROW_CLASS_NAME,
  UI_TABLE_ROW_HOVER_CLASS_NAME,
  UI_TABLE_WRAPPER_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";
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
    <div className={UI_TABLE_WRAPPER_CLASS_NAME}>
      <Table className="[&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:first-child]:pl-5 [&_th:last-child]:pr-5">
        <TableHeader>
          <TableRow className={UI_TABLE_HEADER_ROW_CLASS_NAME}>
            <TableHead className="h-auto py-3 font-medium">Category</TableHead>
            <TableHead className="h-auto py-3 font-medium">Amount</TableHead>
            <TableHead className="h-auto py-3 font-medium">Expense Date</TableHead>
            <TableHead className="h-auto py-3 font-medium">Recorded By</TableHead>
            <TableHead aria-label="Details" className="w-[9rem] text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((row) => {
            const isExpanded = expandedExpenseId === row.expenseId;

            return (
              <Fragment key={row.expenseId}>
                <TableRow className={UI_TABLE_ROW_HOVER_CLASS_NAME}>
                  <TableCell className="py-3">{row.category}</TableCell>
                  <TableCell className="py-3 font-medium">{formatMoney(row.amount)}</TableCell>
                  <TableCell className="py-3">{row.expenseDate}</TableCell>
                  <TableCell className="max-w-80 whitespace-normal">
                    <div className="flex min-w-0 flex-wrap items-start gap-2">
                      {row.recordedByRoleName ? (
                        <Badge className={getUiRoleBadgeClassName(row.recordedByRoleName)} variant="outline">
                          {row.recordedByRoleName}
                        </Badge>
                      ) : null}
                      <span className="min-w-0 flex-1 whitespace-normal wrap-break-word text-sm leading-5 text-foreground">
                        {formatRecordedByName(row)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Button
                      className="h-9 rounded-md text-muted-foreground"
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
