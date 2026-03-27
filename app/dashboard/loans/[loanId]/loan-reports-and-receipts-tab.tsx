"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GenerateOperationalDocumentButton } from "@/app/dashboard/loans/[loanId]/generate-operational-document-button";
import { LoanOperationalDocumentsCard } from "@/app/dashboard/loans/[loanId]/loan-operational-documents-card";

type LoanReceiptRow = {
  collectionId: string;
  collectionDate: string;
  amount: number;
  note: string | null;
};

type LoanReportsAndReceiptsTabProps = {
  loanId: number;
  canGenerateOperationalDocuments: boolean;
  receiptRows: LoanReceiptRow[];
};

function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function LoanReportsAndReceiptsTab({
  loanId,
  canGenerateOperationalDocuments,
  receiptRows,
}: LoanReportsAndReceiptsTabProps) {
  return (
    <div className="space-y-6">
      <LoanOperationalDocumentsCard
        canGenerate={canGenerateOperationalDocuments}
        loanId={loanId}
      />

      <Card>
        <CardHeader>
          <CardTitle>Collection Receipts</CardTitle>
          <CardDescription>
            Generate individual payment receipts from recorded passbook entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {receiptRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recorded collections yet.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-2 py-2.5 font-medium">Date</th>
                    <th className="px-2 py-2.5 font-medium">Amount</th>
                    <th className="px-2 py-2.5 font-medium">Note</th>
                    <th className="px-2 py-2.5 font-medium">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptRows.map((row) => (
                    <tr className="border-b" key={row.collectionId}>
                      <td className="px-2 py-3">{row.collectionDate}</td>
                      <td className="px-2 py-3">{formatMoney(row.amount)}</td>
                      <td className="px-2 py-3">{row.note || "-"}</td>
                      <td className="px-2 py-3">
                        <GenerateOperationalDocumentButton
                          disabled={!canGenerateOperationalDocuments}
                          disabledReason={
                            canGenerateOperationalDocuments
                              ? undefined
                              : "Only Admin, Branch Manager, and Secretary can generate receipts."
                          }
                          label="Generate Receipt"
                          size="sm"
                          sourceEntityId={Number(row.collectionId)}
                          successBehavior="stay"
                          templateKey="collection_receipt"
                          variant="outline"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
