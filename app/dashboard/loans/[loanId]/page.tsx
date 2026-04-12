import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { FileChartColumn, ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { resolveBackNavigation } from "@/app/dashboard/back-navigation";
import { LoanDocumentsSection } from "@/app/dashboard/loans/[loanId]/documents/loan-documents-section";
import { LoanDetailForm } from "@/app/dashboard/loans/[loanId]/loan-digital-passbook";
import { LoanReportsAndReceiptsTab } from "@/app/dashboard/loans/[loanId]/loan-reports-and-receipts-tab";
import { LoanArchiveButton } from "@/app/dashboard/loans/loan-archive-button";
import { LoanVisibleStatusBadge } from "@/app/dashboard/loans/loan-visible-status-badge";
import {
  UI_TAB_ICON_ACTIVE_CLASS_NAME,
  UI_TAB_LIST_CLASS_NAME,
  UI_TAB_SEPARATOR_CLASS_NAME,
  getUiTabTriggerClassName,
} from "@/app/dashboard/_components/ui-patterns";
import {
  buildLoanComputedState,
  canRecordCollectionForLoan,
  getManilaTodayDateString,
  resolveArchiveTargetStatus,
} from "@/app/dashboard/loans/loan-state";
import type { CollectionHistoryRow } from "@/app/dashboard/loans/[loanId]/state";
import { db } from "@/db";
import {
  borrower_info,
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
    source?: string;
    returnTo?: string;
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
  source?: string;
  returnTo?: string;
}) {
  const search = new URLSearchParams();

  if (params.tab !== "details") {
    search.set("tab", params.tab);
  }

  if (params.docsPage > 1) {
    search.set("docsPage", String(params.docsPage));
  }
  if (params.source) {
    search.set("source", params.source);
  }
  if (params.returnTo) {
    search.set("returnTo", params.returnTo);
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

function parseIsoDateParts(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return { year, month, day };
}

function formatDateKeyFromUtc(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getEasterSundayUtc(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
}

function getExcludedHolidayKeysForYear(year: number) {
  const easterSunday = getEasterSundayUtc(year);
  const goodFriday = new Date(easterSunday);
  goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);

  return new Set<string>([
    `${year}-01-01`, // New Year's Day
    `${year}-11-01`, // All Saints' Day
    `${year}-12-25`, // Christmas Day
    formatDateKeyFromUtc(goodFriday), // Good Friday
  ]);
}

function countEstimatedCollectionDays(startDate: string, dueDate: string) {
  const parsedStart = parseIsoDateParts(startDate);
  const parsedDue = parseIsoDateParts(dueDate);

  if (!parsedStart || !parsedDue) {
    return 0;
  }

  const cursor = new Date(Date.UTC(parsedStart.year, parsedStart.month - 1, parsedStart.day));
  const end = new Date(Date.UTC(parsedDue.year, parsedDue.month - 1, parsedDue.day));

  if (cursor.getTime() > end.getTime()) {
    return 0;
  }

  let count = 0;
  const holidayKeysByYear = new Map<number, Set<string>>();

  while (cursor.getTime() <= end.getTime()) {
    const year = cursor.getUTCFullYear();
    const holidayKeys =
      holidayKeysByYear.get(year) ?? getExcludedHolidayKeysForYear(year);
    if (!holidayKeysByYear.has(year)) {
      holidayKeysByYear.set(year, holidayKeys);
    }

    const dayOfWeek = cursor.getUTCDay();
    const key = formatDateKeyFromUtc(cursor);
    const isSunday = dayOfWeek === 0;
    const isExcludedHoliday = holidayKeys.has(key);

    if (!isSunday && !isExcludedHoliday) {
      count += 1;
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
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
  const {
    docsPage: docsPageParam,
    source: sourceParam,
    returnTo: returnToParam,
    tab: tabParam,
  } = await searchParams;
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
  const canViewDocs = canManageDocs || isAuditor;
  const canManageLoan = isAdmin || isBranchManager || isSecretary;
  const canGenerateOperationalDocuments = canManageDocs;
  const isDetailsOnlyViewer = isBorrower || isCollector;
  const showTabNavigation = !isDetailsOnlyViewer;
  const resolvedActiveTab = isDetailsOnlyViewer
    ? "details"
    : activeTab === "documents" && !canViewDocs
      ? "details"
      : activeTab;
  const backNavigation = resolveBackNavigation({
    source: sourceParam,
    returnTo: returnToParam,
    fallbackHref: isBorrower ? "/dashboard/my-loans" : "/dashboard/loans",
    fallbackLabel: isBorrower ? "Back to My Loans" : "Back to Loans",
    allowedPrefixes: [
      "/dashboard/loans",
      "/dashboard/my-loans",
      "/dashboard/borrowers",
      "/dashboard/collectors",
      "/dashboard/assigned-loans",
    ],
    sourceMap: {
      loans: {
        href: "/dashboard/loans",
        label: "Back to Loans",
        allowedPrefixes: ["/dashboard/loans"],
      },
      "my-loans": {
        href: "/dashboard/my-loans",
        label: "Back to My Loans",
        allowedPrefixes: ["/dashboard/my-loans"],
      },
      borrowers: {
        href: "/dashboard/borrowers",
        label: "Back to Borrower",
        allowedPrefixes: ["/dashboard/borrowers"],
      },
      collectors: {
        href: "/dashboard/collectors",
        label: "Back to Collector",
        allowedPrefixes: ["/dashboard/collectors"],
      },
      "assigned-loans": {
        href: "/dashboard/assigned-loans",
        label: "Back to Assigned Loans",
        allowedPrefixes: ["/dashboard/assigned-loans"],
      },
    },
  });
  const [borrowerInfo, borrowerUser, collectionRows, loanDocRows, assignedCollector] = await Promise.all([
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
  const estimatedCollectionDays = countEstimatedCollectionDays(loan.start_date, loan.due_date);
  const estimatedDailyPayment =
    estimatedCollectionDays > 0 ? computedState.totalPayable / estimatedCollectionDays : null;

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

  const isOperationalLoanTab = resolvedActiveTab === "reports" || resolvedActiveTab === "documents";
  const headerIcon = isOperationalLoanTab
    ? <ReceiptText className="size-9 text-sidebar-foreground/65" />
    : <FileChartColumn className="size-9 text-sidebar-foreground/65" />;
  const headerDescription = isOperationalLoanTab
    ? "Review operational receipts, schedules, and loan documents for this record."
    : "Review loan summary, passbook entries, and repayment progression.";

  return (
    <div className="space-y-4">
      <DashboardHeaderConfigurator
        config={{
          action: null,
          breadcrumbTitle: loan.loan_code,
          description: headerDescription,
          icon: headerIcon,
          title: "Loan View",
        }}
      />

      <div className="overflow-hidden rounded-md border border-border/70 bg-card text-card-foreground shadow-sm">
        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">{loan.loan_code}</h1>
                <p className="text-sm text-muted-foreground">
                  Borrower:{" "}
                  <span className="font-medium text-foreground">
                    {customerName} ({borrowerCompanyId})
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                <LoanVisibleStatusBadge status={computedState.visibleStatus} />
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
      </div>

      {showTabNavigation ? (
        <div className={UI_TAB_SEPARATOR_CLASS_NAME}>
          <div className={UI_TAB_LIST_CLASS_NAME}>
            <Link
              className={getUiTabTriggerClassName(resolvedActiveTab === "details")}
              href={buildTabHref({
                docsPage,
                loanId,
                returnTo: backNavigation.href,
                source: sourceParam,
                tab: "details",
              })}
            >
              <FileChartColumn className={resolvedActiveTab === "details" ? UI_TAB_ICON_ACTIVE_CLASS_NAME : undefined} />
              Loan Details
            </Link>
            <Link
              className={getUiTabTriggerClassName(resolvedActiveTab === "reports")}
              href={buildTabHref({
                docsPage,
                loanId,
                returnTo: backNavigation.href,
                source: sourceParam,
                tab: "reports",
              })}
            >
              <ReceiptText className={resolvedActiveTab === "reports" ? UI_TAB_ICON_ACTIVE_CLASS_NAME : undefined} />
              Reports & Receipts
            </Link>
            {canViewDocs ? (
              <Link
                className={getUiTabTriggerClassName(resolvedActiveTab === "documents")}
                href={buildTabHref({
                  docsPage,
                  loanId,
                  returnTo: backNavigation.href,
                  source: sourceParam,
                  tab: "documents",
                })}
              >
                <ReceiptText className={resolvedActiveTab === "documents" ? UI_TAB_ICON_ACTIVE_CLASS_NAME : undefined} />
                Documents
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {resolvedActiveTab === "details" ? (
        <div className="space-y-4">
          <Card className="rounded-md border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle>Loan Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Borrower:</span> {customerName} ({borrowerCompanyId})
                  </p>
                  <p>
                    <span className="font-medium">Address:</span> {borrowerAddress}
                  </p>
                  <p>
                    <span className="font-medium">Loan Code:</span> {loan.loan_code}
                  </p>
                </div>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Principal:</span> {formatMoney(principal)}
                  </p>
                  <p>
                    <span className="font-medium">Interest:</span> {interest}%
                  </p>
                  <p>
                    <span className="font-medium">Total Payable:</span> {formatMoney(computedState.totalPayable)}
                  </p>
                </div>
                <div className="space-y-2">
                  <p>
                    <span className="font-medium">Start Date:</span> {loan.start_date}
                  </p>
                  <p>
                    <span className="font-medium">Due Date:</span> {loan.due_date}
                  </p>
                  <p>
                    <span className="font-medium">Assigned Collector:</span> {assignedCollectorLabel}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div className="rounded-md border border-border/70 bg-muted/20 px-4 py-3">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Total Collected So Far</p>
                  <p className="mt-1 font-medium">{formatMoney(computedState.totalCollected)}</p>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/20 px-4 py-3">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Remaining Balance</p>
                  <p className="mt-1 font-medium">{formatMoney(computedState.remainingBalance)}</p>
                </div>
                <div className="rounded-md border border-border/70 bg-muted/20 px-4 py-3">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Estimated Daily Payment</p>
                  <p className="mt-1 font-medium">
                    {estimatedDailyPayment === null ? "N/A" : formatMoney(estimatedDailyPayment)}
                  </p>
                </div>
              </div>
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
      ) : resolvedActiveTab === "reports" ? (
        <LoanReportsAndReceiptsTab
          canGenerateOperationalDocuments={canGenerateOperationalDocuments}
          loanId={loan.loan_id}
          receiptRows={initialCollectionRows.map((row) => ({
            collectionId: row.collectionId,
            collectionDate: row.collectionDate,
            amount: row.amount,
            note: row.note,
          }))}
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
