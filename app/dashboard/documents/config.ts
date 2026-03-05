export const MAX_DOC_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export const ALLOWED_DOC_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/mp3",
  "video/mp4",
] as const;

export const DOC_INPUT_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.webp,.mp3,.mp4,application/pdf,image/jpeg,image/png,image/webp,audio/mp3,video/mp4";

export const BORROWER_DOCUMENT_TYPES = [
  "ID_FRONT",
  "ID_BACK",
  "BUSINESS_PERMIT",
  "PROOF_OF_ADDRESS",
  "OTHER",
] as const;

export const LOAN_DOCUMENT_TYPES = [
  "PROMISSORY_NOTE",
  "LOAN_AGREEMENT",
  "COLLATERAL_PHOTO",
  "OTHER",
] as const;

type AllowedMimeType = (typeof ALLOWED_DOC_MIME_TYPES)[number];

const EXTENSION_BY_MIME_TYPE: Record<AllowedMimeType, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/mp3": "mp3",
  "video/mp4": "mp4",
};

export function isAllowedDocMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_DOC_MIME_TYPES as readonly string[]).includes(value);
}

export function extensionForMimeType(mimeType: AllowedMimeType) {
  return EXTENSION_BY_MIME_TYPE[mimeType];
}

export function buildBorrowerDocPath(borrowerId: string, documentType: string, extension: string) {
  const timestamp = Date.now();
  const randomPart = crypto.randomUUID().slice(0, 8);
  return `borrowers/${borrowerId}/${documentType}/${timestamp}-${randomPart}.${extension}`;
}

export function buildLoanDocPath(loanId: number, documentType: string, extension: string) {
  const timestamp = Date.now();
  const randomPart = crypto.randomUUID().slice(0, 8);
  return `loans/${loanId}/${documentType}/${timestamp}-${randomPart}.${extension}`;
}

export type DocFileKind = "PDF" | "IMAGE" | "AUDIO" | "VIDEO" | "FILE";

export function fileKindFromMimeType(mimeType: string): DocFileKind {
  if (mimeType === "application/pdf") {
    return "PDF";
  }
  if (mimeType.startsWith("image/")) {
    return "IMAGE";
  }
  if (mimeType.startsWith("audio/")) {
    return "AUDIO";
  }
  if (mimeType.startsWith("video/")) {
    return "VIDEO";
  }
  return "FILE";
}
