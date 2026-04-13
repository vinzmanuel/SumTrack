import { Building2 } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { BranchDetailPageSkeleton } from "@/app/dashboard/branches/branch-detail-page-skeleton";

export default function LoadingBranchDetailPage() {
  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          breadcrumbTitle: "Loading branch...",
          description: "Review branch profile, staffing roster, and area coverage inside your allowed scope.",
          icon: <Building2 className="size-9 text-sidebar-foreground/65" />,
          title: "Branch Details",
        }}
      />
      <BranchDetailPageSkeleton />
    </>
  );
}
