import { LoanRecordsModuleSkeleton } from "@/app/dashboard/loans/loan-records-module-skeleton";

export default function LoadingMyLoansPage() {
  return (
    <div className="w-full max-w-none space-y-4">
      <LoanRecordsModuleSkeleton canChooseBranchFilter={false} showAction={false} />
    </div>
  );
}
