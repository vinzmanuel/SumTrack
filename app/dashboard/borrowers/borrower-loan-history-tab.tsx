import Link from "next/link";
import { Button } from "@/components/ui/button";
import { appendBackNavigationToHref } from "@/app/dashboard/back-navigation";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  UI_TABLE_HEADER_ROW_CLASS_NAME,
  UI_TABLE_ROW_HOVER_CLASS_NAME,
  UI_TABLE_WRAPPER_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";
import { LoanVisibleStatusBadge } from "@/app/dashboard/loans/loan-visible-status-badge";
import type { VisibleLoanStatus } from "@/app/dashboard/loans/loan-state";

function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function BorrowerLoanHistoryTab({
  loans,
  returnTo,
}: {
  loans: Array<{
    loanId: number;
    loanCode: string;
    principal: number;
    interest: number;
    startDate: string;
    dueDate: string;
    visibleStatus: VisibleLoanStatus;
    collectorName: string | null;
    remainingBalance: number;
  }>;
  returnTo: string;
}) {
  const rowActionItemClassName =
    "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-foreground outline-hidden transition-colors hover:bg-accent focus:bg-accent";

  if (loans.length === 0) {
    return <p className="text-sm text-muted-foreground">No loan records for this borrower.</p>;
  }

  return (
    <div className={UI_TABLE_WRAPPER_CLASS_NAME}>
      <Table className="min-w-[980px] text-sm">
        <TableHeader>
          <TableRow className={UI_TABLE_HEADER_ROW_CLASS_NAME}>
            <TableHead className="h-auto py-3 pl-5">Loan Code</TableHead>
            <TableHead className="h-auto py-3">Assigned Collector</TableHead>
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
          {loans.map((loan) => {
            const totalPayable = loan.principal + (loan.principal * loan.interest) / 100;

            return (
              <TableRow className={UI_TABLE_ROW_HOVER_CLASS_NAME} key={loan.loanId}>
                <TableCell className="py-3 pl-5 font-medium">{loan.loanCode}</TableCell>
                <TableCell className="py-3 text-muted-foreground">{loan.collectorName || "Unassigned"}</TableCell>
                <TableCell className="py-3">{formatMoney(loan.principal)}</TableCell>
                <TableCell className="py-3">{loan.interest}%</TableCell>
                <TableCell className="py-3">{formatMoney(totalPayable)}</TableCell>
                <TableCell className="py-3">{loan.dueDate}</TableCell>
                <TableCell className="py-3 font-medium text-foreground">{formatMoney(loan.remainingBalance)}</TableCell>
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
                    <DropdownMenuContent align="end" className="w-40 rounded-md p-1.5">
                      <DropdownMenuItem asChild className={rowActionItemClassName}>
                        <Link href={appendBackNavigationToHref(`/dashboard/loans/${loan.loanId}`, {
                          source: "borrowers",
                          returnTo,
                        })}>
                          View
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
