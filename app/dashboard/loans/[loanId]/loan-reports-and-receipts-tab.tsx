"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GenerateOperationalDocumentButton } from "@/app/dashboard/loans/[loanId]/generate-operational-document-button";
import { LoanOperationalDocumentsCard } from "@/app/dashboard/loans/[loanId]/loan-operational-documents-card";
import {
  UI_TABLE_HEADER_ROW_CLASS_NAME,
  UI_TABLE_ROW_HOVER_CLASS_NAME,
  UI_TABLE_WRAPPER_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";

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
    <div className="space-y-4">
      <LoanOperationalDocumentsCard
        canGenerate={canGenerateOperationalDocuments}
        loanId={loanId}
      />

      <Card className="rounded-md border-border/70 shadow-sm">
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
            <div className={UI_TABLE_WRAPPER_CLASS_NAME}>
              <Table className="min-w-[760px] text-sm">
                <TableHeader>
                  <TableRow className={UI_TABLE_HEADER_ROW_CLASS_NAME}>
                    <TableHead className="h-auto py-3 pl-5">Date</TableHead>
                    <TableHead className="h-auto py-3">Amount</TableHead>
                    <TableHead className="h-auto py-3">Note</TableHead>
                    <TableHead className="h-auto py-3">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiptRows.map((row) => (
                    <TableRow className={UI_TABLE_ROW_HOVER_CLASS_NAME} key={row.collectionId}>
                      <TableCell className="py-3 pl-5">{row.collectionDate}</TableCell>
                      <TableCell className="py-3">{formatMoney(row.amount)}</TableCell>
                      <TableCell className="py-3">{row.note || "-"}</TableCell>
                      <TableCell className="py-3">
                        <GenerateOperationalDocumentButton
                          className="h-11 rounded-md px-4"
                          disabled={!canGenerateOperationalDocuments}
                          disabledReason={
                            canGenerateOperationalDocuments
                              ? undefined
                              : "Only Admin, Auditor, Branch Manager, and Secretary can generate receipts."
                          }
                          label="Generate Receipt"
                          size="default"
                          sourceEntityId={Number(row.collectionId)}
                          successBehavior="stay"
                          templateKey="collection_receipt"
                          variant="outline"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
