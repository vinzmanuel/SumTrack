import { Badge } from "@/components/ui/badge";
import type { VisibleLoanStatus } from "@/app/dashboard/loans/loan-state";

function statusBadgeClass(status: VisibleLoanStatus) {
  if (status === "Active") {
    return "whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 py-1 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  if (status === "Overdue") {
    return "whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 py-1 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
  }

  if (status === "Completed") {
    return "whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 py-1 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300";
  }

  if (status === "Archived") {
    return "whitespace-nowrap rounded-md border border-zinc-200 bg-zinc-50 py-1 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100";
  }

  return "whitespace-nowrap rounded-md border border-rose-200 bg-rose-50 py-1 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300";
}

export function LoanVisibleStatusBadge({ status }: { status: VisibleLoanStatus }) {
  return (
    <Badge className={statusBadgeClass(status)} variant="outline">
      {status}
    </Badge>
  );
}
