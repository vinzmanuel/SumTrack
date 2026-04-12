import { LoanRecordsModuleSkeleton } from "@/app/dashboard/loans/loan-records-module-skeleton";

export default function LoadingLoansPage() {
  return (
    <div className="w-full max-w-none space-y-4">
      <LoanRecordsModuleSkeleton canChooseBranchFilter showAction />
    </div>
  );
}
