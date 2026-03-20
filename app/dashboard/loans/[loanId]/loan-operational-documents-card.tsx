"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateOperationalDocumentButton } from "@/app/dashboard/loans/[loanId]/generate-operational-document-button";

export function LoanOperationalDocumentsCard(props: {
  loanId: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational Documents</CardTitle>
        <CardDescription>
          Generate saved operational documents from this loan record. These entries are written into the shared reports table for later library, viewer, and export passes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 md:flex-row">
        <GenerateOperationalDocumentButton
          label="Generate Borrower Loan Schedule"
          sourceEntityId={props.loanId}
          templateKey="borrower_loan_schedule"
          variant="default"
        />
        <GenerateOperationalDocumentButton
          label="Generate Loan Receipt Summary"
          sourceEntityId={props.loanId}
          templateKey="loan_receipt_summary"
          variant="outline"
        />
      </CardContent>
    </Card>
  );
}
