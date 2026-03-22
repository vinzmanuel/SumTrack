import { Badge } from "@/components/ui/badge";
import type { VisibleLoanStatus } from "@/app/dashboard/loans/loan-state";

function statusBadgeClass(status: VisibleLoanStatus) {
  if (status === "Active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Overdue") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "Completed") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (status === "Archived") {
    return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }

  return "border-rose-200 bg-rose-50 text-rose-700";
}

export function LoanVisibleStatusBadge({ status }: { status: VisibleLoanStatus }) {
  return (
    <Badge className={statusBadgeClass(status)} variant="outline">
      {status}
    </Badge>
  );
}
