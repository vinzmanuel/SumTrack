"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { loan_docs } from "@/db/schema";
import {
  LOAN_DOCUMENT_TYPES,
  MAX_DOC_FILE_SIZE_BYTES,
  buildLoanDocPath,
  extensionForMimeType,
  isAllowedDocMimeType,
} from "@/app/dashboard/documents/config";
import { checkLoanDocAccess } from "@/app/dashboard/documents/access";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = {
  status: "success" | "error";
  message: string;
  signedUrl?: string;
  mimeType?: string;
  originalFilename?: string;
  warning?: string;
};

function parsePositiveInt(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

function isLoanDocType(value: string): value is (typeof LOAN_DOCUMENT_TYPES)[number] {
  return (LOAN_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export async function uploadLoanDocAction(formData: FormData): Promise<ActionResult> {
  const loanId = parsePositiveInt(String(formData.get("loan_id") ?? "").trim());
  const documentType = String(formData.get("document_type") ?? "").trim();
  const fileValue = formData.get("file");

  if (!loanId) {
    return { status: "error", message: "Loan is required." };
  }
  if (!isLoanDocType(documentType)) {
    return { status: "error", message: "Invalid loan document type." };
  }
  if (!(fileValue instanceof File)) {
    return { status: "error", message: "File is required." };
  }
  if (fileValue.size <= 0) {
    return { status: "error", message: "File is empty." };
  }
  if (fileValue.size > MAX_DOC_FILE_SIZE_BYTES) {
    return { status: "error", message: "File exceeds 15MB limit." };
  }
  if (!isAllowedDocMimeType(fileValue.type)) {
    return { status: "error", message: "Unsupported file type." };
  }

  const access = await checkLoanDocAccess(loanId, { requireManage: true });
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const adminClient = createAdminClient();
  const bucket = adminClient.storage.from("loan-docs");

  const existingDoc = await db
    .select({
      loan_doc_id: loan_docs.loan_doc_id,
      file_path: loan_docs.file_path,
    })
    .from(loan_docs)
    .where(
      and(
        eq(loan_docs.loan_id, loanId),
        eq(loan_docs.document_type, documentType),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const path = buildLoanDocPath(loanId, documentType, extensionForMimeType(fileValue.type));
  const uploadResult = await bucket.upload(path, fileValue, {
    contentType: fileValue.type,
    upsert: false,
  });

  if (uploadResult.error) {
    return { status: "error", message: `Upload failed: ${uploadResult.error.message}` };
  }

  if (existingDoc) {
    const updatedDoc = await db
      .update(loan_docs)
      .set({
        file_path: path,
        uploaded_by: access.userId,
        uploaded_at: new Date().toISOString(),
        original_filename: fileValue.name || "unnamed",
        mime_type: fileValue.type,
        file_size: fileValue.size,
      })
      .where(eq(loan_docs.loan_doc_id, existingDoc.loan_doc_id))
      .returning({ loan_doc_id: loan_docs.loan_doc_id })
      .then((rows) => rows[0] ?? null)
      .catch(() => null);

    if (!updatedDoc) {
      await bucket.remove([path]);
      return { status: "error", message: "File uploaded but DB replace failed." };
    }

    const removeOld = await bucket.remove([existingDoc.file_path]);
    if (removeOld.error) {
      return {
        status: "success",
        message: "Document replaced, but old file cleanup failed.",
        warning: removeOld.error.message,
      };
    }

    return { status: "success", message: "Loan document replaced." };
  }

  const insertedDoc = await db
    .insert(loan_docs)
    .values({
      loan_id: loanId,
      document_type: documentType,
      file_path: path,
      uploaded_by: access.userId,
      original_filename: fileValue.name || "unnamed",
      mime_type: fileValue.type,
      file_size: fileValue.size,
    })
    .returning({ loan_doc_id: loan_docs.loan_doc_id })
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!insertedDoc) {
    await bucket.remove([path]);
    return { status: "error", message: "File uploaded but DB insert failed." };
  }

  return { status: "success", message: "Loan document uploaded." };
}

export async function deleteLoanDocAction(formData: FormData): Promise<ActionResult> {
  const loanId = parsePositiveInt(String(formData.get("loan_id") ?? "").trim());
  const loanDocId = parsePositiveInt(String(formData.get("loan_doc_id") ?? "").trim());

  if (!loanId || !loanDocId) {
    return { status: "error", message: "Invalid loan document payload." };
  }

  const access = await checkLoanDocAccess(loanId, { requireManage: true });
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const doc = await db
    .select({
      loan_doc_id: loan_docs.loan_doc_id,
      file_path: loan_docs.file_path,
    })
    .from(loan_docs)
    .where(
      and(
        eq(loan_docs.loan_doc_id, loanDocId),
        eq(loan_docs.loan_id, loanId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!doc) {
    return { status: "error", message: "Loan document not found." };
  }

  const adminClient = createAdminClient();
  const bucket = adminClient.storage.from("loan-docs");

  const removeResult = await bucket.remove([doc.file_path]);
  if (removeResult.error) {
    return { status: "error", message: `Failed to remove file from storage: ${removeResult.error.message}` };
  }

  const deleted = await db
    .delete(loan_docs)
    .where(eq(loan_docs.loan_doc_id, doc.loan_doc_id))
    .returning({ loan_doc_id: loan_docs.loan_doc_id })
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!deleted) {
    return { status: "error", message: "Storage file removed but DB delete failed." };
  }

  return { status: "success", message: "Loan document deleted." };
}

export async function getLoanDocSignedUrlAction(formData: FormData): Promise<ActionResult> {
  const loanId = parsePositiveInt(String(formData.get("loan_id") ?? "").trim());
  const loanDocId = parsePositiveInt(String(formData.get("loan_doc_id") ?? "").trim());
  const intent = String(formData.get("intent") ?? "view").trim().toLowerCase();
  const isDownload = intent === "download";

  if (!loanId || !loanDocId) {
    return { status: "error", message: "Invalid loan document payload." };
  }

  const access = await checkLoanDocAccess(loanId, { requireManage: false });
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const doc = await db
    .select({
      file_path: loan_docs.file_path,
      mime_type: loan_docs.mime_type,
      original_filename: loan_docs.original_filename,
    })
    .from(loan_docs)
    .where(
      and(
        eq(loan_docs.loan_doc_id, loanDocId),
        eq(loan_docs.loan_id, loanId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!doc) {
    return { status: "error", message: "Loan document not found." };
  }

  const adminClient = createAdminClient();
  const signedUrl = await adminClient.storage.from("loan-docs").createSignedUrl(doc.file_path, 90, {
    download: isDownload ? doc.original_filename : undefined,
  });
  if (signedUrl.error || !signedUrl.data?.signedUrl) {
    return { status: "error", message: "Failed to generate signed download URL." };
  }

  return {
    status: "success",
    message: "Signed URL generated.",
    signedUrl: signedUrl.data.signedUrl,
    mimeType: doc.mime_type,
    originalFilename: doc.original_filename,
  };
}
