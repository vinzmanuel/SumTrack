import { Building2 } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { BranchNetworkPageSkeleton } from "@/app/dashboard/branches/branch-network-page-skeleton";

export default function LoadingBranchesPage() {
  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          description: "Review branch coverage, staffing health, and operational load across your visible network.",
          icon: <Building2 className="size-9 text-sidebar-foreground/65" />,
          title: "Branches",
        }}
      />
      <BranchNetworkPageSkeleton />
    </>
  );
}
