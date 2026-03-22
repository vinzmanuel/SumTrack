import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { LoanDocumentsSection } from "@/app/dashboard/loans/[loanId]/documents/loan-documents-section";
import { LoanDetailForm } from "@/app/dashboard/loans/[loanId]/loan-digital-passbook";
import { LoanReportsAndReceiptsTab } from "@/app/dashboard/loans/[loanId]/loan-reports-and-receipts-tab";
import { LoanArchiveButton } from "@/app/dashboard/loans/loan-archive-button";
import { LoanVisibleStatusBadge } from "@/app/dashboard/loans/loan-visible-status-badge";
import {
  buildLoanComputedState,
  canRecordCollectionForLoan,
  getManilaTodayDateString,
  resolveArchiveTargetStatus,
} from "@/app/dashboard/loans/loan-state";
import type { CollectionHistoryRow } from "@/app/dashboard/loans/[loanId]/state";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  branch,
  collections,
  employee_info,
  loan_docs,
  loan_records,
  users,
} from "@/db/schema";

type LoanDetailTabKey = "details" | "reports" | "documents";

type PageProps = {
  params: Promise<{ loanId: string }>;
  searchParams: Promise<{
    tab?: string;
    docsPage?: string;
  }>;
};

const DOCS_PAGE_SIZE = 10;

function parseLoanDetailTab(value: string | undefined): LoanDetailTabKey {
  if (value === "reports" || value === "documents") {
    return value;
  }

  return "details";
}

function buildTabHref(params: {
  loanId: string;
  tab: LoanDetailTabKey;
  docsPage: number;
}) {
  const search = new URLSearchParams();

  if (params.tab !== "details") {
    search.set("tab", params.tab);
  }

  if (params.docsPage > 1) {
    search.set("docsPage", String(params.docsPage));
  }

  const query = search.toString();
  return query ? `/dashboard/loans/${params.loanId}?${query}` : `/dashboard/loans/${params.loanId}`;
}

function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatBorrowerName(firstName: string | null, lastName: string | null, fallback: string) {
  return [firstName, lastName].filter(Boolean).join(" ").trim() || fallback;
}

function renderMessageCard(message: string, tone: "default" | "destructive" = "default") {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Loan Details</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-sm ${tone === "destructive" ? "text-destructive" : "text-muted-foreground"}`}>
          {message}
        </p>
      </CardContent>
    </Card>
  );
}

export default async function LoanDetailPage({ params, searchParams }: PageProps) {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return renderMessageCard(auth.message);
  }

  const { loanId } = await params;
  const { docsPage: docsPageParam, tab: tabParam } = await searchParams;
  const activeTab = parseLoanDetailTab(tabParam);
  const docsPage = Math.max(1, Number.parseInt(docsPageParam ?? "1", 10) || 1);
  const docsOffset = (docsPage - 1) * DOCS_PAGE_SIZE;
  const loanIdDb = /^\d+$/.test(loanId) ? Number(loanId) : null;

  const loan = loanIdDb
    ? await db
        .select({
          loan_id: loan_records.loan_id,
          loan_code: loan_records.loan_code,
          borrower_id: loan_records.borrower_id,
          principal: loan_records.principal,
          interest: loan_records.interest,
          start_date: loan_records.start_date,
          due_date: loan_records.due_date,
          collector_id: loan_records.collector_id,
          branch_id: loan_records.branch_id,
          status: loan_records.status,
        })
        .from(loan_records)
        .where(eq(loan_records.loan_id, loanIdDb))
        .limit(1)
        .then((rows) => rows[0] ?? null)
        .catch(() => null)
    : null;

  if (!loan) {
    return renderMessageCard("Loan not found.");
  }

  const role = auth.roleName;
  const isAdmin = role === "Admin";
  const isBranchManager = role === "Branch Manager";
  const isSecretary = role === "Secretary";
  const isAuditor = role === "Auditor";
  const isCollector = role === "Collector";
  const isBorrower = role === "Borrower";

  let canAccess = false;
  if (isAdmin) {
    canAccess = true;
  } else if (isBranchManager || isSecretary) {
    canAccess = auth.activeBranchId !== null && auth.activeBranchId === loan.branch_id;
  } else if (isAuditor) {
    canAccess = auth.assignedBranchIds.includes(loan.branch_id);
  } else if (isCollector) {
    canAccess = loan.collector_id === auth.userId;
  } else if (isBorrower) {
    canAccess = loan.borrower_id === auth.userId;
  }

  if (!canAccess) {
    return renderMessageCard("You are not authorized to access this loan.", "destructive");
  }

  const canManageDocs = isAdmin || isBranchManager || isSecretary;
  const canViewDocs = canManageDocs || isAuditor || isBorrower;
  const canManageLoan = isAdmin || isBranchManager || isSecretary;
  const canGenerateOperationalDocuments = canManageDocs;

  const [borrowerInfo, borrowerUser, branchRow, collectionRows, loanDocRows, assignedCollector] = await Promise.all([
    db
      .select({
        user_id: borrower_info.user_id,
        area_id: borrower_info.area_id,
        first_name: borrower_info.first_name,
        last_name: borrower_info.last_name,
        contact_number: users.contact_no,
        address: borrower_info.address,
      })
      .from(borrower_info)
      .innerJoin(users, eq(users.user_id, borrower_info.user_id))
      .where(eq(borrower_info.user_id, loan.borrower_id))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
    db
      .select({
        user_id: users.user_id,
        company_id: users.company_id,
        username: users.username,
      })
      .from(users)
      .where(eq(users.user_id, loan.borrower_id))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
    db
      .select({
        branch_id: branch.branch_id,
        branch_name: branch.branch_name,
        branch_address: branch.branch_address,
      })
      .from(branch)
      .where(eq(branch.branch_id, loan.branch_id))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
    db
      .select({
        collection_id: collections.collection_id,
        collection_code: collections.collection_code,
        amount: collections.amount,
        note: collections.note,
        collection_date: collections.collection_date,
        encoded_by: collections.encoded_by,
        collector_user_id: users.user_id,
        collector_username: users.username,
        collector_first_name: employee_info.first_name,
        collector_last_name: employee_info.last_name,
      })
      .from(collections)
      .leftJoin(users, eq(users.user_id, collections.collector_id))
      .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
      .where(eq(collections.loan_id, loan.loan_id))
      .orderBy(asc(collections.collection_date), asc(collections.collection_id))
      .catch(() => []),
    db
      .select({
        loan_doc_id: loan_docs.loan_doc_id,
        loan_id: loan_docs.loan_id,
        document_type: loan_docs.document_type,
        file_path: loan_docs.file_path,
        uploaded_by: loan_docs.uploaded_by,
        original_filename: loan_docs.original_filename,
        mime_type: loan_docs.mime_type,
        file_size: loan_docs.file_size,
        uploaded_at: loan_docs.uploaded_at,
        uploader_company_id: users.company_id,
        uploader_username: users.username,
        uploader_first_name: employee_info.first_name,
        uploader_last_name: employee_info.last_name,
      })
      .from(loan_docs)
      .leftJoin(users, eq(users.user_id, loan_docs.uploaded_by))
      .leftJoin(employee_info, eq(employee_info.user_id, loan_docs.uploaded_by))
      .where(eq(loan_docs.loan_id, loan.loan_id))
      .orderBy(desc(loan_docs.uploaded_at), desc(loan_docs.loan_doc_id))
      .limit(DOCS_PAGE_SIZE + 1)
      .offset(docsOffset)
      .catch(() => []),
    loan.collector_id
      ? db
          .select({
            user_id: users.user_id,
            username: users.username,
            first_name: employee_info.first_name,
            last_name: employee_info.last_name,
          })
          .from(users)
          .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
          .where(eq(users.user_id, loan.collector_id))
          .limit(1)
          .then((rows) => rows[0] ?? null)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const borrowerArea = borrowerInfo?.area_id
    ? await db
        .select({ area_code: areas.area_code })
        .from(areas)
        .where(eq(areas.area_id, borrowerInfo.area_id))
        .limit(1)
        .then((rows) => rows[0] ?? null)
        .catch(() => null)
    : null;

  const encoderIds = Array.from(new Set(collectionRows.map((row) => row.encoded_by).filter(Boolean)));
  const encoderRows =
    encoderIds.length > 0
      ? await db
          .select({
            user_id: users.user_id,
            username: users.username,
            company_id: users.company_id,
            first_name: employee_info.first_name,
            last_name: employee_info.last_name,
          })
          .from(users)
          .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
          .where(inArray(users.user_id, encoderIds))
          .catch(() => [])
      : [];

  const encoderById = new Map(
    encoderRows.map((row) => [
      row.user_id,
      [row.first_name, row.last_name].filter(Boolean).join(" ") || row.company_id || row.username || row.user_id,
    ]),
  );

  const principal = Number(loan.principal) || 0;
  const interest = Number(loan.interest) || 0;
  const totalCollected = collectionRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const computedState = buildLoanComputedState({
    principal,
    interest,
    totalCollected,
    dueDate: loan.due_date,
    storedStatus: loan.status,
    currentDate: getManilaTodayDateString(),
  });

  const assignedCollectorLabel = assignedCollector
    ? [assignedCollector.first_name, assignedCollector.last_name].filter(Boolean).join(" ") ||
      assignedCollector.username ||
      assignedCollector.user_id
    : "N/A";

  const initialCollectionRows: CollectionHistoryRow[] = collectionRows.map((collection) => ({
    collectionId: String(collection.collection_id),
    collectionCode: collection.collection_code,
    collectionDate: collection.collection_date,
    amount: Number(collection.amount) || 0,
    note: collection.note,
    collectorName:
      [collection.collector_first_name, collection.collector_last_name].filter(Boolean).join(" ") ||
      collection.collector_username ||
      collection.collector_user_id ||
      assignedCollectorLabel,
    encodedByName: encoderById.get(collection.encoded_by) || "Unknown",
  }));

  const customerName = formatBorrowerName(
    borrowerInfo?.first_name ?? null,
    borrowerInfo?.last_name ?? null,
    borrowerUser?.username || loan.borrower_id,
  );
  const borrowerCompanyId = borrowerUser?.company_id || borrowerUser?.username || loan.borrower_id;
  const borrowerAddress = borrowerInfo?.address || "N/A";

  const hasMoreDocs = loanDocRows.length > DOCS_PAGE_SIZE;
  const pagedDocs = loanDocRows.slice(0, DOCS_PAGE_SIZE).map((doc) => {
    const uploaderName =
      [doc.uploader_first_name, doc.uploader_last_name].filter(Boolean).join(" ") ||
      doc.uploader_company_id ||
      doc.uploader_username ||
      "Unknown";

    return {
      ...doc,
      file_size: Number(doc.file_size ?? 0),
      uploaded_by_name: uploaderName,
    };
  });

  const canArchive =
    canManageLoan &&
    resolveArchiveTargetStatus({
      storedStatus: computedState.storedStatus,
      visibleStatus: computedState.visibleStatus,
    }) !== null;

  const canRecordCollections =
    canManageLoan &&
    canRecordCollectionForLoan({
      storedStatus: computedState.storedStatus,
      remainingBalance: computedState.remainingBalance,
    });

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card text-card-foreground shadow-sm">
        <div className="bg-gradient-to-r from-slate-50 via-white to-emerald-50/60 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="space-y-1">
                <Link className="inline-flex text-sm text-muted-foreground underline underline-offset-4" href="/dashboard/loans">
                  Back to Loans
                </Link>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">{loan.loan_code}</h1>
                <p className="text-sm text-muted-foreground">
                  Borrower: <span className="font-medium text-foreground">{customerName}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                <LoanVisibleStatusBadge status={computedState.visibleStatus} />
                <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-foreground">
                  Branch: {branchRow?.branch_name || "N/A"}
                </span>
                <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-foreground">
                  Release Date: {loan.start_date}
                </span>
                <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-foreground">
                  Due Date: {loan.due_date}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
                  Remaining Balance: {formatMoney(computedState.remainingBalance)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {canArchive ? (
                <LoanArchiveButton
                  loanCode={loan.loan_code}
                  loanId={loan.loan_id}
                  triggerLabel={computedState.visibleStatus === "Overdue" ? "Mark as Abandoned" : "Archive"}
                  visibleStatus={computedState.visibleStatus}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 p-6">
          <div className="inline-flex flex-wrap gap-2 rounded-xl border border-border/70 bg-muted/30 p-1">
            <Link href={buildTabHref({ docsPage, loanId, tab: "details" })}>
              <TabButton active={activeTab === "details"} label="Loan Details" />
            </Link>
            <Link href={buildTabHref({ docsPage, loanId, tab: "reports" })}>
              <TabButton active={activeTab === "reports"} label="Reports & Receipts" />
            </Link>
            <Link href={buildTabHref({ docsPage, loanId, tab: "documents" })}>
              <TabButton active={activeTab === "documents"} label="Documents" />
            </Link>
          </div>
        </div>
      </div>

      {activeTab === "details" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Loan Summary</CardTitle>
              <CardDescription>Compact operational overview for this individual loan record.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
              <p><span className="font-medium">Borrower:</span> {customerName}</p>
              <p><span className="font-medium">Borrower Company ID:</span> {borrowerCompanyId}</p>
              <p><span className="font-medium">Address:</span> {borrowerAddress}</p>
              <p><span className="font-medium">Branch:</span> {branchRow?.branch_name || "N/A"}</p>
              <p><span className="font-medium">Area:</span> {borrowerArea?.area_code || "N/A"}</p>
              <p><span className="font-medium">Collector:</span> {assignedCollectorLabel}</p>
              <p><span className="font-medium">Principal:</span> {formatMoney(principal)}</p>
              <p><span className="font-medium">Interest:</span> {interest}%</p>
              <p><span className="font-medium">Total Payable:</span> {formatMoney(computedState.totalPayable)}</p>
              <p><span className="font-medium">Collected to Date:</span> {formatMoney(computedState.totalCollected)}</p>
              <p><span className="font-medium">Remaining Balance:</span> {formatMoney(computedState.remainingBalance)}</p>
              <p><span className="font-medium">Visible Status:</span> {computedState.visibleStatus}</p>
            </CardContent>
          </Card>

          <LoanDetailForm
            assignedCollectorLabel={assignedCollectorLabel}
            canRecordCollections={canRecordCollections}
            initialCollections={initialCollectionRows}
            loanId={String(loan.loan_id)}
            totalPayable={computedState.totalPayable}
          />
        </div>
      ) : activeTab === "reports" ? (
        <LoanReportsAndReceiptsTab
          canGenerateOperationalDocuments={canGenerateOperationalDocuments}
          loanId={loan.loan_id}
          receiptRows={initialCollectionRows.map((row) => ({
            collectionId: row.collectionId,
            collectionDate: row.collectionDate,
            amount: row.amount,
            note: row.note,
          }))}
          visibleStatus={computedState.visibleStatus}
        />
      ) : (
        <LoanDocumentsSection
          canManage={canManageDocs}
          canView={canViewDocs}
          currentPage={docsPage}
          docs={pagedDocs}
          hasMore={hasMoreDocs}
          loanId={loan.loan_id}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span
      className={`inline-flex rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </span>
  );
}
