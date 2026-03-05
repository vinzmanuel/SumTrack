"use client";

import { LOAN_DOCUMENT_TYPES } from "@/app/dashboard/documents/config";
import {
  type DocumentRow,
  DocumentsSection,
} from "@/app/dashboard/documents/documents-section";
import {
  deleteLoanDocAction,
  getLoanDocSignedUrlAction,
  uploadLoanDocAction,
} from "@/app/dashboard/loans/[loanId]/documents/actions";

type LoanDocRow = {
  loan_doc_id: number;
  loan_id: number;
  document_type: string;
  file_path: string;
  uploaded_by: string | null;
  uploaded_by_name: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string | null;
};

type LoanDocumentsSectionProps = {
  loanId: number;
  docs: LoanDocRow[];
  canManage: boolean;
  canView: boolean;
  hasMore: boolean;
  currentPage: number;
};

function normalizeDocs(docs: LoanDocRow[]): DocumentRow[] {
  return docs.map((doc) => ({
    id: doc.loan_doc_id,
    documentType: doc.document_type,
    originalFilename: doc.original_filename,
    mimeType: doc.mime_type,
    fileSize: doc.file_size,
    uploadedAt: doc.uploaded_at,
    uploadedByName: doc.uploaded_by_name,
  }));
}

export function LoanDocumentsSection({
  loanId,
  docs,
  canManage,
  canView,
  hasMore,
  currentPage,
}: LoanDocumentsSectionProps) {
  return (
    <DocumentsSection
      canManage={canManage}
      canView={canView}
      currentPage={currentPage}
      docIdFieldName="loan_doc_id"
      docs={normalizeDocs(docs)}
      documentTypes={LOAN_DOCUMENT_TYPES}
      getSignedUrlAction={getLoanDocSignedUrlAction}
      hasMore={hasMore}
      parentFieldName="loan_id"
      recordId={String(loanId)}
      recordLabel="loan"
      deleteAction={deleteLoanDocAction}
      uploadAction={uploadLoanDocAction}
    />
  );
}

