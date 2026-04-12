import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { appendBackNavigationToHref } from "@/app/dashboard/back-navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoanArchiveButton } from "@/app/dashboard/loans/loan-archive-button";
import { LoanDeleteButton } from "@/app/dashboard/loans/loan-delete-button";
import { LoanVisibleStatusBadge } from "@/app/dashboard/loans/loan-visible-status-badge";
import {
  UI_TABLE_HEADER_ROW_CLASS_NAME,
  UI_TABLE_ROW_HOVER_CLASS_NAME,
  UI_TABLE_WRAPPER_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";
import type { LoanListRow } from "@/app/dashboard/loans/types";

function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function rowActionItemClassName(tone: "default" | "amber" | "red") {
  if (tone === "amber") {
    return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-amber-600 outline-hidden transition-colors hover:bg-amber-50 focus:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10 dark:focus:bg-amber-500/10";
  }

  if (tone === "red") {
    return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 outline-hidden transition-colors hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 dark:focus:bg-red-500/10";
  }

  return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-foreground outline-hidden transition-colors hover:bg-accent focus:bg-accent";
}

export function LoansTable({
  loans,
  returnTo,
  source = "loans",
}: {
  loans: LoanListRow[];
  returnTo: string;
  source?: string;
}) {
  if (loans.length === 0) {
    return (
      <div className={UI_TABLE_WRAPPER_CLASS_NAME}>
        <Table className="min-w-[1200px] text-sm">
          <TableBody>
            <TableRow>
              <TableCell className="py-10 text-center text-sm text-muted-foreground" colSpan={11}>
                No loans found for your scope.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className={UI_TABLE_WRAPPER_CLASS_NAME}>
      <Table className="min-w-[1200px] text-sm">
        <TableHeader>
          <TableRow className={UI_TABLE_HEADER_ROW_CLASS_NAME}>
            <TableHead className="h-auto py-3 pl-5">Loan Code</TableHead>
            <TableHead className="h-auto py-3">Borrower</TableHead>
            <TableHead className="h-auto py-3">Branch</TableHead>
            <TableHead className="h-auto py-3">Collector</TableHead>
            <TableHead className="h-auto py-3">Principal</TableHead>
            <TableHead className="h-auto py-3">Interest</TableHead>
            <TableHead className="h-auto py-3">Total Payable</TableHead>
            <TableHead className="h-auto py-3">Due Date</TableHead>
            <TableHead className="h-auto py-3">Remaining Balance</TableHead>
            <TableHead className="h-auto py-3">Status</TableHead>
            <TableHead className="h-auto py-3">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loans.map((loan) => (
            <TableRow className={UI_TABLE_ROW_HOVER_CLASS_NAME} key={loan.loanId}>
              <TableCell className="py-3 pl-5 font-medium">{loan.loanCode}</TableCell>
              <TableCell className="py-3">{loan.borrowerName}</TableCell>
              <TableCell className="py-3">{loan.branchName}</TableCell>
              <TableCell className="py-3">{loan.collectorName}</TableCell>
              <TableCell className="py-3">{formatMoney(loan.principal)}</TableCell>
              <TableCell className="py-3">{loan.interest}%</TableCell>
              <TableCell className="py-3">{formatMoney(loan.totalPayable)}</TableCell>
              <TableCell className="py-3">{loan.dueDate}</TableCell>
              <TableCell className="py-3">{formatMoney(loan.remainingBalance)}</TableCell>
              <TableCell className="py-3">
                <LoanVisibleStatusBadge status={loan.visibleStatus} />
              </TableCell>
              <TableCell className="py-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      className="h-9 w-9 rounded-md border-0 bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground dark:bg-transparent dark:hover:bg-white/[0.08]"
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Open actions for {loan.loanCode}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44 rounded-md p-1.5">
                    <DropdownMenuItem asChild className={rowActionItemClassName("default")}>
                      <Link href={appendBackNavigationToHref(`/dashboard/loans/${loan.loanId}`, {
                        source,
                        returnTo,
                      })}>
                        View
                      </Link>
                    </DropdownMenuItem>
                    {loan.canArchive ? (
                      <LoanArchiveButton
                        loanCode={loan.loanCode}
                        loanId={loan.loanId}
                        trigger={
                          <button className={rowActionItemClassName("amber")} type="button">
                            Archive
                          </button>
                        }
                        visibleStatus={loan.visibleStatus}
                      />
                    ) : null}
                    {loan.canDelete ? (
                      <LoanDeleteButton
                        loanCode={loan.loanCode}
                        loanId={loan.loanId}
                        trigger={
                          <button className={rowActionItemClassName("red")} type="button">
                            Delete
                          </button>
                        }
                      />
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
