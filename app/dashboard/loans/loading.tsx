import { LoanRecordsModuleSkeleton } from "@/app/dashboard/loans/loan-records-module-skeleton";

export default function LoadingLoansPage() {
  return (
    <div className="w-full max-w-none space-y-5 pb-6 pt-1 sm:pb-6 sm:pt-2">
      <LoanRecordsModuleSkeleton canChooseBranchFilter showAction />
    </div>
  );
}
