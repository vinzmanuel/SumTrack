import { Users } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { BorrowerRecordsModuleSkeleton } from "@/app/dashboard/borrowers/borrower-records-module-skeleton";

export default function LoadingBorrowersPage() {
  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          description: "Browse and manage borrowers within your current branch and area scope.",
          icon: <Users className="size-9 text-sidebar-foreground/65" />,
          title: "Borrowers",
        }}
      />
      <div className="w-full max-w-none space-y-5 pb-6 pt-1 sm:pb-6 sm:pt-2">
        <BorrowerRecordsModuleSkeleton canChooseBranch showAction />
      </div>
    </>
  );
}
