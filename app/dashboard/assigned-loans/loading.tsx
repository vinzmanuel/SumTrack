import { LoanRecordsModuleSkeleton } from "@/app/dashboard/loans/loan-records-module-skeleton";

export default function LoadingAssignedLoansPage() {
  return <LoanRecordsModuleSkeleton canChooseBranchFilter={false} showAction={false} />;
}
