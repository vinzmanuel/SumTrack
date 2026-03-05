"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  ImageIcon,
  Loader2,
  Music2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DOC_INPUT_ACCEPT,
  MAX_DOC_FILE_SIZE_BYTES,
  fileKindFromMimeType,
  isAllowedDocMimeType,
} from "@/app/dashboard/documents/config";
import { openDocFancybox } from "@/app/dashboard/documents/fancybox-client";

export type DocumentsActionResult = {
  status: "success" | "error";
  message: string;
  warning?: string;
  signedUrl?: string;
  mimeType?: string;
  originalFilename?: string;
};

export type DocumentRow = {
  id: number;
  documentType: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string | null;
  uploadedByName: string;
};

type DocumentsSectionProps = {
  recordId: string;
  recordLabel: "borrower" | "loan";
  parentFieldName: string;
  docIdFieldName: string;
  docs: DocumentRow[];
  documentTypes: readonly string[];
  canManage: boolean;
  canView: boolean;
  hasMore: boolean;
  currentPage: number;
  uploadAction: (formData: FormData) => Promise<DocumentsActionResult>;
  deleteAction: (formData: FormData) => Promise<DocumentsActionResult>;
  getSignedUrlAction: (formData: FormData) => Promise<DocumentsActionResult>;
};

type CachedSignedUrl = {
  signedUrl: string;
  expiresAt: number;
  mimeType: string;
  originalFilename: string;
};

function formatTimestamp(value: string | null) {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const converted = value / 1024 ** exponent;
  return `${converted.toFixed(converted >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function kindIcon(mimeType: string) {
  const kind = fileKindFromMimeType(mimeType);
  if (kind === "IMAGE") return <ImageIcon className="h-5 w-5" />;
  if (kind === "AUDIO") return <Music2 className="h-5 w-5" />;
  if (kind === "VIDEO") return <Video className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

function toFriendlyMessage(message: string, fallback: string) {
  if (!message) {
    return fallback;
  }

  if (message.toLowerCase().includes("failed")) {
    return message.replace(/^.+failed:\s*/i, "").trim() || fallback;
  }

  return message;
}

function buildFormData(
  parentFieldName: string,
  docIdFieldName: string,
  recordId: string,
  intent: "view" | "download",
  docId?: number,
  documentType?: string,
  file?: File,
) {
  const formData = new FormData();
  formData.set(parentFieldName, recordId);
  formData.set("intent", intent);
  if (docId) {
    formData.set(docIdFieldName, String(docId));
  }
  if (documentType) {
    formData.set("document_type", documentType);
  }
  if (file) {
    formData.set("file", file);
  }
  return formData;
}

function ImagePreview({
  doc,
  getSignedUrl,
}: {
  doc: DocumentRow;
  getSignedUrl: (doc: DocumentRow) => Promise<CachedSignedUrl | null>;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const requestedRef = useRef(false);

  const isImage = fileKindFromMimeType(doc.mimeType) === "IMAGE";

  useEffect(() => {
    if (!isImage || requestedRef.current) {
      return;
    }

    const node = wrapperRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || requestedRef.current) {
          return;
        }
        requestedRef.current = true;
        setLoading(true);
        const signed = await getSignedUrl(doc);
        setSrc(signed?.signedUrl ?? null);
        setLoading(false);
      },
      { rootMargin: "150px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [doc, getSignedUrl, isImage]);

  if (!isImage) {
    return (
      <div className="text-muted-foreground flex h-14 w-14 items-center justify-center rounded-md border bg-muted/20">
        {kindIcon(doc.mimeType)}
      </div>
    );
  }

  return (
    <div
      className="relative h-14 w-14 overflow-hidden rounded-md border bg-muted/20"
      ref={wrapperRef}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={doc.originalFilename} className="h-full w-full object-cover" src={src} />
      ) : (
        <div className="text-muted-foreground flex h-full w-full items-center justify-center">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
        </div>
      )}
    </div>
  );
}

export function DocumentsSection({
  recordId,
  recordLabel,
  parentFieldName,
  docIdFieldName,
  docs,
  documentTypes,
  canManage,
  canView,
  hasMore,
  currentPage,
  uploadAction,
  deleteAction,
  getSignedUrlAction,
}: DocumentsSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadType, setUploadType] = useState<string>(documentTypes[0] ?? "OTHER");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [replaceTarget, setReplaceTarget] = useState<DocumentRow | null>(null);
  const [openingViewerDocId, setOpeningViewerDocId] = useState<number | null>(null);

  const signedUrlCacheRef = useRef<Map<string, CachedSignedUrl>>(new Map());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sortedDocs = useMemo(
    () => [...docs].sort((a, b) => String(b.uploadedAt ?? "").localeCompare(String(a.uploadedAt ?? ""))),
    [docs],
  );

  const nextLoadMoreHref = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("docsPage", String(currentPage + 1));
    return `${pathname}?${params.toString()}`;
  }, [searchParams, currentPage, pathname]);

  function openUploadDialog(nextType?: string) {
    const safeType =
      nextType && documentTypes.includes(nextType)
        ? nextType
        : (documentTypes[0] ?? "OTHER");
    setUploadType(safeType);
    setUploadFile(null);
    setUploadOpen(true);
  }

  const getSignedUrl = useCallback(async (doc: DocumentRow, intent: "view" | "download" = "view") => {
    const cacheKey = `${doc.id}:${intent}`;
    const cached = signedUrlCacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const result = await getSignedUrlAction(
      buildFormData(parentFieldName, docIdFieldName, recordId, intent, doc.id),
    );

    if (result.status === "error" || !result.signedUrl) {
      toast.error(toFriendlyMessage(result.message, "Unable to open the document right now."));
      return null;
    }

    const cachedValue: CachedSignedUrl = {
      signedUrl: result.signedUrl,
      // Cache slightly shorter than signed URL expiry to avoid stale links while browsing.
      expiresAt: Date.now() + 70_000,
      mimeType: result.mimeType || doc.mimeType,
      originalFilename: result.originalFilename || doc.originalFilename,
    };
    signedUrlCacheRef.current.set(cacheKey, cachedValue);
    return cachedValue;
  }, [docIdFieldName, getSignedUrlAction, parentFieldName, recordId]);

  async function handleUpload() {
    if (!uploadFile) {
      toast.error("Select a file before uploading.");
      return;
    }
    if (uploadFile.size <= 0) {
      toast.error("The selected file is empty.");
      return;
    }
    if (uploadFile.size > MAX_DOC_FILE_SIZE_BYTES) {
      toast.error("File exceeds the 15 MB size limit.");
      return;
    }
    if (!isAllowedDocMimeType(uploadFile.type)) {
      toast.error("Unsupported file type. Please upload PDF, JPG, PNG, WEBP, MP3, or MP4.");
      return;
    }

    setUploading(true);
    try {
      const result = await uploadAction(
        buildFormData(
          parentFieldName,
          docIdFieldName,
          recordId,
          "view",
          undefined,
          uploadType,
          uploadFile,
        ),
      );
      if (result.status === "error") {
        toast.error(toFriendlyMessage(result.message, "Upload failed. Please try again."));
        return;
      }

      if (result.warning) {
        toast.warning(toFriendlyMessage(result.warning, "Uploaded with warning."));
      } else {
        toast.success(result.message);
      }
      setUploadOpen(false);
      setUploadFile(null);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    try {
      const result = await deleteAction(
        buildFormData(parentFieldName, docIdFieldName, recordId, "view", deleteTarget.id),
      );
      if (result.status === "error") {
        toast.error(toFriendlyMessage(result.message, "Delete failed. Please try again."));
        return;
      }

      toast.success(result.message);
      setDeleteTarget(null);
      signedUrlCacheRef.current.delete(`${deleteTarget.id}:view`);
      signedUrlCacheRef.current.delete(`${deleteTarget.id}:download`);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownload(doc: DocumentRow) {
    const signed = await getSignedUrl(doc, "download");
    if (!signed) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = signed.signedUrl;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.download = signed.originalFilename || doc.originalFilename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  }

  async function openViewer(currentDoc: DocumentRow) {
    const startingIndex = sortedDocs.findIndex((item) => item.id === currentDoc.id);
    if (startingIndex < 0) {
      return;
    }

    setOpeningViewerDocId(currentDoc.id);
    try {
      const signedRows = await Promise.all(
        sortedDocs.map(async (doc) => {
          const signed = await getSignedUrl(doc);
          return signed
            ? {
                src: signed.signedUrl,
                mimeType: signed.mimeType,
                caption: `${doc.originalFilename} (${doc.documentType})`,
              }
            : null;
        }),
      );

      const fancyboxItems = signedRows.filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (fancyboxItems.length === 0) {
        toast.error("Unable to open document preview right now.");
        return;
      }

      const currentSigned = await getSignedUrl(currentDoc);
      const mappedStartIndex = currentSigned
        ? Math.max(0, fancyboxItems.findIndex((item) => item.src === currentSigned.signedUrl))
        : 0;

      openDocFancybox(fancyboxItems, mappedStartIndex);
    } finally {
      setOpeningViewerDocId(null);
    }
  }

  function onFileSelect(file: File | null) {
    if (!file) {
      setUploadFile(null);
      return;
    }
    setUploadFile(file);
  }

  function existingTypeLabel() {
    return sortedDocs.some((doc) => doc.documentType === uploadType)
      ? "This upload will replace the existing file for this document type."
      : null;
  }

  if (!canView) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">You are not authorized to view {recordLabel} documents.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Documents</CardTitle>
        <Button disabled={!canManage || uploading} onClick={() => openUploadDialog()} size="sm" type="button">
          Upload Document
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedDocs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No documents uploaded yet.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-250 text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-2 py-2 font-medium">Preview</th>
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Filename</th>
                  <th className="px-2 py-2 font-medium">Size</th>
                  <th className="px-2 py-2 font-medium">Uploaded By</th>
                  <th className="px-2 py-2 font-medium">Uploaded At</th>
                  <th className="px-2 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedDocs.map((doc) => (
                  <tr className="border-b" key={doc.id}>
                    <td className="px-2 py-2">
                      <ImagePreview doc={doc} getSignedUrl={getSignedUrl} />
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-col gap-1">
                        <Badge variant="secondary">{fileKindFromMimeType(doc.mimeType)}</Badge>
                        <span className="text-muted-foreground text-xs">{doc.documentType}</span>
                      </div>
                    </td>
                    <td className="max-w-52 truncate px-2 py-2" title={doc.originalFilename}>
                      {doc.originalFilename}
                    </td>
                    <td className="px-2 py-2">{formatBytes(doc.fileSize)}</td>
                    <td className="px-2 py-2">{doc.uploadedByName}</td>
                    <td className="px-2 py-2">{formatTimestamp(doc.uploadedAt)}</td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          disabled={openingViewerDocId === doc.id}
                          onClick={() => openViewer(doc)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {openingViewerDocId === doc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "View"}
                        </Button>
                        <Button onClick={() => handleDownload(doc)} size="sm" type="button" variant="secondary">
                          Download
                        </Button>
                        {canManage ? (
                          <Button
                            onClick={() => setReplaceTarget(doc)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            Replace
                          </Button>
                        ) : null}
                        {canManage ? (
                          <Button
                            onClick={() => setDeleteTarget(doc)}
                            size="sm"
                            type="button"
                            variant="destructive"
                          >
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasMore ? (
          <div className="pt-2">
            <Link href={nextLoadMoreHref}>
              <Button type="button" variant="outline">
                Load More
              </Button>
            </Link>
          </div>
        ) : null}
      </CardContent>

      <Dialog onOpenChange={setUploadOpen} open={uploadOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>
              Select a file and document type. Existing files of the same type will be overwritten.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div
              className={`rounded-lg border border-dashed p-6 text-center transition ${
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"
              }`}
              onDragLeave={() => setDragOver(false)}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                onFileSelect(event.dataTransfer.files?.[0] ?? null);
              }}
            >
              <div className="mb-2 flex justify-center">
                <Upload className="text-muted-foreground h-6 w-6" />
              </div>
              <p className="text-sm font-medium">Drag and drop your file here</p>
              <p className="text-muted-foreground mt-1 text-xs">or</p>
              <div className="mt-3">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Browse files
                </Button>
                <input
                  accept={DOC_INPUT_ACCEPT}
                  className="hidden"
                  onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
                  ref={fileInputRef}
                  type="file"
                />
              </div>
              <div className="text-muted-foreground mt-4 flex items-center justify-between text-xs">
                <span>Supported: PDF, JPG, PNG, WEBP, MP3, MP4</span>
                <span>Max size: 15 MB</span>
              </div>
            </div>

            {uploadFile ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{uploadFile.name}</p>
                  <p className="text-muted-foreground text-xs">{formatBytes(uploadFile.size)}</p>
                </div>
                <Button
                  aria-label="Remove selected file"
                  onClick={() => setUploadFile(null)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor={`${recordLabel}_doc_type`}>
                Document Type
              </label>
              <select
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                id={`${recordLabel}_doc_type`}
                onChange={(event) => setUploadType(event.target.value)}
                value={uploadType}
              >
                {documentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {existingTypeLabel() ? (
                <p className="text-amber-700 text-xs dark:text-amber-400">{existingTypeLabel()}</p>
              ) : null}
            </div>

            {uploading ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading document...
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button onClick={() => setUploadOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={uploading} onClick={handleUpload} type="button">
              {sortedDocs.some((doc) => doc.documentType === uploadType) ? "Replace Document" : "Upload Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={(open) => (!open ? setReplaceTarget(null) : null)} open={Boolean(replaceTarget)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace document file?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite the existing file and metadata for{" "}
              <span className="font-medium">{replaceTarget?.originalFilename ?? "this document"}</span>. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const nextType = replaceTarget?.documentType;
                setReplaceTarget(null);
                openUploadDialog(nextType);
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)} open={Boolean(deleteTarget)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the storage file and database record for{" "}
              <span className="font-medium">{deleteTarget?.originalFilename ?? "this document"}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
