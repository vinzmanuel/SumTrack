import { User } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { ManagedUserSummaryCard } from "@/app/dashboard/manage-user-accounts/managed-user-summary-card";

export default function LoadingManagedUserDetailPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <DashboardHeaderConfigurator
        config={{
          breadcrumbTitle: "Loading employee...",
          description: "Review read-only employee account details, role context, and branch or area scope assignment.",
          icon: <User className="size-9 text-sidebar-foreground/65" />,
          title: "Employee Details",
        }}
      />
      <ManagedUserSummaryCard
        companyId="..."
        details={[
          { label: "Full Name", value: "Loading..." },
          { label: "Status", value: "Loading..." },
          { label: "Current Branch / Scope", value: "Loading..." },
          { label: "Contact No.", value: "Loading..." },
          { label: "Email", value: "Loading..." },
          { label: "Account Category", value: "Loading..." },
          { label: "Date Created", value: "Loading..." },
        ]}
        eyebrow="Account Overview"
        headingName="Loading employee..."
        roleName="Loading..."
        status="active"
        subtitle="Loading account details..."
        title="Employee Details"
      />
    </div>
  );
}
