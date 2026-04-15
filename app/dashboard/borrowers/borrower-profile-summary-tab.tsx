import { ManagedUserSummaryCard } from "@/app/dashboard/manage-user-accounts/managed-user-summary-card";
import { BorrowerRiskAssessmentCard } from "@/app/dashboard/borrowers/[borrowerId]/borrower-risk-assessment-dialog-card";

export function BorrowerProfileSummaryTab({
  borrower,
  borrowerId,
  canAssessRisk,
}: {
  borrower: {
    fullName: string;
    fullNameWithMiddle: string;
    companyId: string;
    status: "active" | "inactive";
    contactNumber: string | null;
    email: string | null;
    branchLabel: string;
    areaCode: string;
    address: string | null;
    dateCreated: string | null;
  };
  borrowerId: string;
  canAssessRisk: boolean;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ManagedUserSummaryCard
        companyId={borrower.companyId}
        details={[
          { label: "Full Name", value: borrower.fullNameWithMiddle },
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
        headingName={borrower.fullName}
        title={borrower.fullName}
        hideHeader
      />

      {canAssessRisk ? <BorrowerRiskAssessmentCard borrowerId={borrowerId} /> : null}
    </div>
  );
}
