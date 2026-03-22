"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateOperationalDocumentButton } from "@/app/dashboard/loans/[loanId]/generate-operational-document-button";
import type { VisibleLoanStatus } from "@/app/dashboard/loans/loan-state";

export function LoanOperationalDocumentsCard(props: {
  loanId: number;
  visibleStatus: VisibleLoanStatus;
  canGenerate: boolean;
}) {
  const canGenerateLoanReceiptSummary =
    props.visibleStatus === "Completed" ||
    props.visibleStatus === "Archived" ||
    props.visibleStatus === "Abandoned";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan Reports</CardTitle>
        <CardDescription>
          Generate saved loan-specific reports from this record. These entries are written into the shared reports table and stay available in the Reports Library.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 md:flex-row">
        <GenerateOperationalDocumentButton
          disabled={!props.canGenerate}
          disabledReason={
            props.canGenerate ? undefined : "Only Admin, Branch Manager, and Secretary can generate loan reports."
          }
          label="Generate Borrower Loan Schedule"
          sourceEntityId={props.loanId}
          templateKey="borrower_loan_schedule"
          variant="default"
        />
        <GenerateOperationalDocumentButton
          label="Generate Loan Receipt Summary"
          disabled={!props.canGenerate || !canGenerateLoanReceiptSummary}
          disabledReason={
            !props.canGenerate
              ? "Only Admin, Branch Manager, and Secretary can generate loan reports."
              : canGenerateLoanReceiptSummary
                ? undefined
                : "Loan receipt summaries are only available for completed, archived, or abandoned loans."
          }
          sourceEntityId={props.loanId}
          templateKey="loan_receipt_summary"
          variant="outline"
        />
      </CardContent>
    </Card>
  );
}
