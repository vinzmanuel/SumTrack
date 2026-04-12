"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateOperationalDocumentButton } from "@/app/dashboard/loans/[loanId]/generate-operational-document-button";

export function LoanOperationalDocumentsCard(props: {
  loanId: number;
  canGenerate: boolean;
}) {
  return (
    <Card className="rounded-md border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle>Loan Reports</CardTitle>
        <CardDescription>
          Generate saved loan-specific reports from this record. Loan receipt summaries now capture activity up to this point and stay available in the shared Reports Library.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 md:flex-row">
        <GenerateOperationalDocumentButton
          className="h-11 rounded-md"
          disabled={!props.canGenerate}
          disabledReason={
            props.canGenerate ? undefined : "Only Admin, Branch Manager, and Secretary can generate loan reports."
          }
          label="Generate Borrower Loan Schedule"
          successBehavior="stay"
          sourceEntityId={props.loanId}
          templateKey="borrower_loan_schedule"
          variant="default"
        />
        <GenerateOperationalDocumentButton
          className="h-11 rounded-md"
          label="Generate Loan Receipt Summary"
          disabled={!props.canGenerate}
          disabledReason={
            !props.canGenerate
              ? "Only Admin, Branch Manager, and Secretary can generate loan reports."
              : undefined
          }
          successBehavior="redirect"
          sourceEntityId={props.loanId}
          templateKey="loan_receipt_summary"
          variant="outline"
        />
      </CardContent>
    </Card>
  );
}
