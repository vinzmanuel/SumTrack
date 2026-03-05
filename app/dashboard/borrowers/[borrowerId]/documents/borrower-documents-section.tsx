"use client";

import { BORROWER_DOCUMENT_TYPES } from "@/app/dashboard/documents/config";
import {
  type DocumentRow,
  DocumentsSection,
} from "@/app/dashboard/documents/documents-section";
import {
  deleteBorrowerDocAction,
  getBorrowerDocSignedUrlAction,
  uploadBorrowerDocAction,
} from "@/app/dashboard/borrowers/[borrowerId]/documents/actions";

type BorrowerDocRow = {
  borrower_doc_id: number;
  borrower_id: string;
  document_type: string;
  file_path: string;
  uploaded_by: string | null;
  uploaded_by_name: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string | null;
};

type BorrowerDocumentsSectionProps = {
  borrowerId: string;
  docs: BorrowerDocRow[];
  canManage: boolean;
  canView: boolean;
  hasMore: boolean;
  currentPage: number;
};

function normalizeDocs(docs: BorrowerDocRow[]): DocumentRow[] {
  return docs.map((doc) => ({
    id: doc.borrower_doc_id,
    documentType: doc.document_type,
    originalFilename: doc.original_filename,
    mimeType: doc.mime_type,
    fileSize: doc.file_size,
    uploadedAt: doc.uploaded_at,
    uploadedByName: doc.uploaded_by_name,
  }));
}

export function BorrowerDocumentsSection({
  borrowerId,
  docs,
  canManage,
  canView,
  hasMore,
  currentPage,
}: BorrowerDocumentsSectionProps) {
  return (
    <DocumentsSection
      canManage={canManage}
      canView={canView}
      currentPage={currentPage}
      docIdFieldName="borrower_doc_id"
      docs={normalizeDocs(docs)}
      documentTypes={BORROWER_DOCUMENT_TYPES}
      getSignedUrlAction={getBorrowerDocSignedUrlAction}
      hasMore={hasMore}
      parentFieldName="borrower_id"
      recordId={borrowerId}
      recordLabel="borrower"
      deleteAction={deleteBorrowerDocAction}
      uploadAction={uploadBorrowerDocAction}
    />
  );
}

