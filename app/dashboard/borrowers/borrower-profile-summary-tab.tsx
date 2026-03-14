import { ManagedUserSummaryCard } from "@/app/dashboard/manage-user-accounts/managed-user-summary-card";

export function BorrowerProfileSummaryTab({
  borrower,
}: {
  borrower: {
    fullName: string;
    companyId: string;
    status: "active" | "inactive";
    contactNumber: string | null;
    email: string | null;
    branchLabel: string;
    areaCode: string;
    address: string | null;
    dateCreated: string | null;
  };
}) {
  return (
    <ManagedUserSummaryCard
      companyId={borrower.companyId}
      details={[
        { label: "Full Name", value: borrower.fullName },
        { label: "Contact No.", value: borrower.contactNumber || "N/A" },
        { label: "Email", value: borrower.email || "N/A" },
        { label: "Branch / Scope", value: borrower.branchLabel },
        { label: "Area", value: borrower.areaCode },
        { label: "Address", value: borrower.address || "N/A" },
        { label: "Date Created", value: borrower.dateCreated || "N/A" },
      ]}
      eyebrow="Borrower Profile"
      roleName="Borrower"
      status={borrower.status}
      subtitle="Read-only borrower account details within your allowed scope."
      title={borrower.fullName}
    />
  );
}
