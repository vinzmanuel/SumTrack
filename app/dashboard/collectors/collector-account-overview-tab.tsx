import { ManagedUserSummaryCard } from "@/app/dashboard/manage-user-accounts/managed-user-summary-card";
import type { CollectorProfileData } from "@/app/dashboard/collectors/types";

export function CollectorAccountOverviewTab({
  data,
}: {
  data: CollectorProfileData;
}) {
  return (
    <ManagedUserSummaryCard
      companyId={data.companyId}
      details={[
        { label: "Full Name", value: data.fullName },
        { label: "Contact No.", value: data.contactNo || "N/A" },
        { label: "Email", value: data.email || "N/A" },
        { label: "Branch / Scope", value: data.branchName },
        { label: "Area Assignment", value: data.areaLabel },
        { label: "Date Created", value: data.dateCreated || "N/A" },
      ]}
      eyebrow="Collector Profile"
      roleName={data.roleName}
      status={data.status}
      subtitle="Read-only account details for this collector within your allowed scope."
      title={data.fullName}
    />
  );
}
