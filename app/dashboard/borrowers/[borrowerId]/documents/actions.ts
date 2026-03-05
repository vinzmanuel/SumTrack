"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { borrower_docs } from "@/db/schema";
import {
  BORROWER_DOCUMENT_TYPES,
  MAX_DOC_FILE_SIZE_BYTES,
  buildBorrowerDocPath,
  extensionForMimeType,
  isAllowedDocMimeType,
} from "@/app/dashboard/documents/config";
import { checkBorrowerDocAccess } from "@/app/dashboard/documents/access";
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

function isBorrowerDocType(value: string): value is (typeof BORROWER_DOCUMENT_TYPES)[number] {
  return (BORROWER_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export async function uploadBorrowerDocAction(formData: FormData): Promise<ActionResult> {
  const borrowerId = String(formData.get("borrower_id") ?? "").trim();
  const documentType = String(formData.get("document_type") ?? "").trim();
  const fileValue = formData.get("file");

  if (!borrowerId) {
    return { status: "error", message: "Borrower is required." };
  }
  if (!isBorrowerDocType(documentType)) {
    return { status: "error", message: "Invalid borrower document type." };
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

  const access = await checkBorrowerDocAccess(borrowerId, { requireManage: true });
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const adminClient = createAdminClient();
  const bucket = adminClient.storage.from("borrower-docs");

  const existingDoc = await db
    .select({
      borrower_doc_id: borrower_docs.borrower_doc_id,
      file_path: borrower_docs.file_path,
    })
    .from(borrower_docs)
    .where(
      and(
        eq(borrower_docs.borrower_id, borrowerId),
        eq(borrower_docs.document_type, documentType),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const path = buildBorrowerDocPath(borrowerId, documentType, extensionForMimeType(fileValue.type));
  const uploadResult = await bucket.upload(path, fileValue, {
    contentType: fileValue.type,
    upsert: false,
  });

  if (uploadResult.error) {
    return { status: "error", message: `Upload failed: ${uploadResult.error.message}` };
  }

  if (existingDoc) {
    const updatedDoc = await db
      .update(borrower_docs)
      .set({
        file_path: path,
        uploaded_by: access.userId,
        uploaded_at: new Date().toISOString(),
        original_filename: fileValue.name || "unnamed",
        mime_type: fileValue.type,
        file_size: fileValue.size,
      })
      .where(eq(borrower_docs.borrower_doc_id, existingDoc.borrower_doc_id))
      .returning({ borrower_doc_id: borrower_docs.borrower_doc_id })
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

    return { status: "success", message: "Borrower document replaced." };
  }

  const insertedDoc = await db
    .insert(borrower_docs)
    .values({
      borrower_id: borrowerId,
      document_type: documentType,
      file_path: path,
      uploaded_by: access.userId,
      original_filename: fileValue.name || "unnamed",
      mime_type: fileValue.type,
      file_size: fileValue.size,
    })
    .returning({ borrower_doc_id: borrower_docs.borrower_doc_id })
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!insertedDoc) {
    await bucket.remove([path]);
    return { status: "error", message: "File uploaded but DB insert failed." };
  }

  return { status: "success", message: "Borrower document uploaded." };
}

export async function deleteBorrowerDocAction(formData: FormData): Promise<ActionResult> {
  const borrowerId = String(formData.get("borrower_id") ?? "").trim();
  const borrowerDocId = parsePositiveInt(String(formData.get("borrower_doc_id") ?? "").trim());

  if (!borrowerId || !borrowerDocId) {
    return { status: "error", message: "Invalid borrower document payload." };
  }

  const access = await checkBorrowerDocAccess(borrowerId, { requireManage: true });
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const doc = await db
    .select({
      borrower_doc_id: borrower_docs.borrower_doc_id,
      file_path: borrower_docs.file_path,
    })
    .from(borrower_docs)
    .where(
      and(
        eq(borrower_docs.borrower_doc_id, borrowerDocId),
        eq(borrower_docs.borrower_id, borrowerId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!doc) {
    return { status: "error", message: "Borrower document not found." };
  }

  const adminClient = createAdminClient();
  const bucket = adminClient.storage.from("borrower-docs");

  const removeResult = await bucket.remove([doc.file_path]);
  if (removeResult.error) {
    return { status: "error", message: `Failed to remove file from storage: ${removeResult.error.message}` };
  }

  const deleted = await db
    .delete(borrower_docs)
    .where(eq(borrower_docs.borrower_doc_id, doc.borrower_doc_id))
    .returning({ borrower_doc_id: borrower_docs.borrower_doc_id })
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!deleted) {
    return { status: "error", message: "Storage file removed but DB delete failed." };
  }

  return { status: "success", message: "Borrower document deleted." };
}

export async function getBorrowerDocSignedUrlAction(formData: FormData): Promise<ActionResult> {
  const borrowerId = String(formData.get("borrower_id") ?? "").trim();
  const borrowerDocId = parsePositiveInt(String(formData.get("borrower_doc_id") ?? "").trim());
  const intent = String(formData.get("intent") ?? "view").trim().toLowerCase();
  const isDownload = intent === "download";

  if (!borrowerId || !borrowerDocId) {
    return { status: "error", message: "Invalid borrower document payload." };
  }

  const access = await checkBorrowerDocAccess(borrowerId, { requireManage: false });
  if (!access.ok) {
    return { status: "error", message: access.message };
  }

  const doc = await db
    .select({
      file_path: borrower_docs.file_path,
      mime_type: borrower_docs.mime_type,
      original_filename: borrower_docs.original_filename,
    })
    .from(borrower_docs)
    .where(
      and(
        eq(borrower_docs.borrower_doc_id, borrowerDocId),
        eq(borrower_docs.borrower_id, borrowerId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!doc) {
    return { status: "error", message: "Borrower document not found." };
  }

  const adminClient = createAdminClient();
  const signedUrl = await adminClient.storage.from("borrower-docs").createSignedUrl(doc.file_path, 90, {
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
