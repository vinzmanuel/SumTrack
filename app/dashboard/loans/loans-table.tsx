import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { LoanListRow } from "@/app/dashboard/loans/types";

function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function LoansTable({ loans }: { loans: LoanListRow[] }) {
  if (loans.length === 0) {
    return <p className="text-muted-foreground text-sm">No loans found for your scope.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-2 py-2.5 font-medium">Loan Code</th>
            <th className="px-2 py-2.5 font-medium">Borrower</th>
            <th className="px-2 py-2.5 font-medium">Branch</th>
            <th className="px-2 py-2.5 font-medium">Collector</th>
            <th className="px-2 py-2.5 font-medium">Principal</th>
            <th className="px-2 py-2.5 font-medium">Interest</th>
            <th className="px-2 py-2.5 font-medium">Start Date</th>
            <th className="px-2 py-2.5 font-medium">Due Date</th>
            <th className="px-2 py-2.5 font-medium">Status</th>
            <th className="px-2 py-2.5 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <tr className="border-b" key={loan.loanId}>
              <td className="px-2 py-3">{loan.loanCode}</td>
              <td className="px-2 py-3">{loan.borrowerName}</td>
              <td className="px-2 py-3">{loan.branchName}</td>
              <td className="px-2 py-3">{loan.collectorName}</td>
              <td className="px-2 py-3">{formatMoney(loan.principal)}</td>
              <td className="px-2 py-3">{loan.interest}%</td>
              <td className="px-2 py-3">{loan.startDate}</td>
              <td className="px-2 py-3">{loan.dueDate}</td>
              <td className="px-2 py-3">{loan.status}</td>
              <td className="px-2 py-3">
                <Link href={`/dashboard/loans/${loan.loanId}`}>
                  <Button size="sm" type="button" variant="outline">
                    View
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
