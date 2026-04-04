import { BorrowerRecordsModuleSkeleton } from "@/app/dashboard/borrowers/borrower-records-module-skeleton";

export default function LoadingBorrowersPage() {
  return (
    <div className="w-full max-w-none space-y-5 pb-6 pt-1 sm:pb-6 sm:pt-2">
      <BorrowerRecordsModuleSkeleton canChooseBranch showAction />
    </div>
  );
}
