import { Suspense } from "react";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { FileChartColumn, Plus, ReceiptText, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardBackLink } from "@/app/dashboard/_components/dashboard-back-link";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import {
  UI_TAB_ICON_ACTIVE_CLASS_NAME,
  UI_TAB_LIST_CLASS_NAME,
  UI_TAB_SEPARATOR_CLASS_NAME,
  getUiTabTriggerClassName,
} from "@/app/dashboard/_components/ui-patterns";
import {
  getDashboardAuthContext,
  getSingleAssignedBranchId,
  getUniqueAssignedBranchIds,
} from "@/app/dashboard/auth";
import { appendBackNavigationToHref, buildReturnTo, resolveBackNavigation } from "@/app/dashboard/back-navigation";
import { BorrowerDocumentsSection } from "@/app/dashboard/borrowers/[borrowerId]/documents/borrower-documents-section";
import { BorrowerLoanHistoryTab } from "@/app/dashboard/borrowers/borrower-loan-history-tab";
import { parseBorrowerDetailTab } from "@/app/dashboard/borrowers/detail-filters";
import { BorrowerProfileSummaryTab } from "@/app/dashboard/borrowers/borrower-profile-summary-tab";
import type { BorrowerDetailTabKey } from "@/app/dashboard/borrowers/types";
import { db } from "@/db";
import {
  areas,
  borrower_docs,
  borrower_info,
  branch,
  employee_info,
  loan_records,
  users,
} from "@/db/schema";
import { getVisibleLoanStatusFromStoredStatus } from "@/app/dashboard/loans/loan-state";

type PageProps = {
  params: Promise<{
    borrowerId: string;
  }>;
  searchParams: Promise<{
    tab?: string;
    source?: string;
    returnTo?: string;
    docsPage?: string;
  }>;
};

const DOCS_PAGE_SIZE = 10;

function formatDisplayName(firstName: string | null, middleName: string | null, lastName: string | null) {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  const middle = (middleName ?? "").trim();
  const middleInitial = middle ? `${middle[0].toUpperCase()}.` : "";
  return [first, middleInitial, last].filter(Boolean).join(" ") || "N/A";
}

function formatFullName(firstName: string | null, middleName: string | null, lastName: string | null) {
  const first = (firstName ?? "").trim();
  const middle = (middleName ?? "").trim();
  const last = (lastName ?? "").trim();
  return [first, middle, last].filter(Boolean).join(" ") || "N/A";
}

function renderMessageCard(props: {
  href: string;
  label: string;
  message: string;
}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Borrower&apos;s Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{props.message}</p>
          <DashboardBackLink href={props.href} label={props.label} />
        </CardContent>
      </Card>
    </main>
  );
}

function buildTabHref(params: {
  borrowerId: string;
  tab: BorrowerDetailTabKey;
  docsPage: number;
  source: "borrowers" | "manage-users";
  returnTo: string;
}) {
  const search = new URLSearchParams();

  if (params.tab !== "profile") {
    search.set("tab", params.tab);
  }
  if (params.docsPage > 1) {
    search.set("docsPage", String(params.docsPage));
  }
  search.set("source", params.source);
  search.set("returnTo", params.returnTo);

  const query = search.toString();
  return query
    ? `/dashboard/borrowers/${params.borrowerId}?${query}`
    : `/dashboard/borrowers/${params.borrowerId}`;
}

async function BorrowerLoanHistoryLoader({ borrowerId, returnTo }: { borrowerId: string; returnTo: string }) {
  const loans = await db
    .select({
      loan_id: loan_records.loan_id,
      loan_code: loan_records.loan_code,
      principal: loan_records.principal,
      interest: loan_records.interest,
      start_date: loan_records.start_date,
      due_date: loan_records.due_date,
      status: loan_records.status,
      collector_first_name: employee_info.first_name,
      collector_last_name: employee_info.last_name,
      paid_amount: sql<number>`COALESCE((SELECT SUM(amount) FROM collections WHERE collections.loan_id = loan_records.loan_id), 0)`,
    })
    .from(loan_records)
    .leftJoin(employee_info, eq(employee_info.user_id, loan_records.collector_id))
    .where(eq(loan_records.borrower_id, borrowerId))
    .orderBy(desc(loan_records.loan_id))
    .catch(() => []);

  return (
    <BorrowerLoanHistoryTab
      loans={loans.map((loan) => {
        const principal = Number(loan.principal) || 0;
        const interest = Number(loan.interest) || 0;
        const totalPayable = principal + (principal * interest) / 100;
        const paid = Number(loan.paid_amount) || 0;
        const remainingBalance = Math.max(0, totalPayable - paid);

        return {
          loanId: loan.loan_id,
          loanCode: loan.loan_code,
          principal,
          interest,
          startDate: loan.start_date,
          dueDate: loan.due_date,
          visibleStatus: getVisibleLoanStatusFromStoredStatus(loan.status),
          collectorName: [loan.collector_first_name, loan.collector_last_name].filter(Boolean).join(" ").trim() || null,
          remainingBalance,
        };
      })}
      returnTo={returnTo}
    />
  );
}

async function BorrowerDocumentsLoader({
  borrowerId,
  docsOffset,
  docsPage,
  canManageDocs,
  canViewDocs,
}: {
  borrowerId: string;
  docsOffset: number;
  docsPage: number;
  canManageDocs: boolean;
  canViewDocs: boolean;
}) {
  const docs = await db
    .select({
      borrower_doc_id: borrower_docs.borrower_doc_id,
      borrower_id: borrower_docs.borrower_id,
      document_type: borrower_docs.document_type,
      file_path: borrower_docs.file_path,
      uploaded_by: borrower_docs.uploaded_by,
      original_filename: borrower_docs.original_filename,
      mime_type: borrower_docs.mime_type,
      file_size: borrower_docs.file_size,
      uploaded_at: borrower_docs.uploaded_at,
      uploader_company_id: users.company_id,
      uploader_username: users.username,
      uploader_first_name: employee_info.first_name,
      uploader_last_name: employee_info.last_name,
    })
    .from(borrower_docs)
    .leftJoin(users, eq(users.user_id, borrower_docs.uploaded_by))
    .leftJoin(employee_info, eq(employee_info.user_id, borrower_docs.uploaded_by))
    .where(eq(borrower_docs.borrower_id, borrowerId))
    .orderBy(desc(borrower_docs.uploaded_at), desc(borrower_docs.borrower_doc_id))
    .limit(DOCS_PAGE_SIZE + 1)
    .offset(docsOffset)
    .catch(() => []);

  const hasMoreDocs = docs.length > DOCS_PAGE_SIZE;
  const pagedDocs = docs.slice(0, DOCS_PAGE_SIZE).map((doc) => {
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

  return (
    <BorrowerDocumentsSection
      borrowerId={borrowerId}
      canManage={canManageDocs}
      canView={canViewDocs}
      currentPage={docsPage}
      docs={pagedDocs}
      hasMore={hasMoreDocs}
    />
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md border border-border/70 bg-card shadow-sm">
        <div className="p-5 md:p-6 space-y-4">
          <Skeleton className="h-10 w-full mb-6" />
          <div className="space-y-2">
             <Skeleton className="h-6 w-full" />
             <Skeleton className="h-6 w-5/6" />
             <Skeleton className="h-6 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function BorrowerProfilePage({ params, searchParams }: PageProps) {
  const { borrowerId } = await params;
  const {
    docsPage: docsPageParam,
    source: sourceParam,
    returnTo: returnToParam,
    tab: tabParam,
  } = await searchParams;
  const docsPage = Math.max(1, Number.parseInt(docsPageParam ?? "1", 10) || 1);
  const docsOffset = (docsPage - 1) * DOCS_PAGE_SIZE;
  const activeTab = parseBorrowerDetailTab(tabParam);
  const source = sourceParam === "manage-users" ? "manage-users" : "borrowers";

  const auth = await getDashboardAuthContext();

  if (!auth.ok) {
    return renderMessageCard({
      href: "/login",
      label: "Go to login",
      message: "Not logged in",
    });
  }

  const isAdmin = auth.roleName === "Admin";
  const isBranchManager = auth.roleName === "Branch Manager";
  const isSecretary = auth.roleName === "Secretary";
  const isAuditor = auth.roleName === "Auditor";
  const isCollector = auth.roleName === "Collector";
  const canManageDocs = isAdmin || isBranchManager || isSecretary;
  const canViewDocs = isAdmin || isBranchManager || isSecretary || isAuditor;
  const canCreateLoan = isAdmin || isBranchManager || isSecretary;

  if (isCollector) {
    return renderMessageCard({
      href: "/dashboard",
      label: "Back to dashboard",
      message: "Collectors cannot access borrower pages or borrower documents.",
    });
  }

  if (!isAdmin && !isBranchManager && !isSecretary && !isAuditor) {
    return renderMessageCard({
      href: "/dashboard",
      label: "Back to dashboard",
      message:
        "You are logged in, but only Admin, Branch Manager, Secretary, and Auditor can access borrower profiles.",
    });
  }

  let allowedBranchIds: number[] = [];
  if (!isAdmin) {
    if (isAuditor) {
      const uniqueBranchIds = getUniqueAssignedBranchIds(auth);
      if (uniqueBranchIds.length === 0) {
        return renderMessageCard({
          href: "/dashboard/borrowers",
          label: "Back to borrowers",
          message: "Unable to resolve your assigned branches.",
        });
      }
      allowedBranchIds = uniqueBranchIds;
    } else {
      const fixedBranchId = getSingleAssignedBranchId(auth);
      if (fixedBranchId === null) {
        return renderMessageCard({
          href: "/dashboard/borrowers",
          label: "Back to borrowers",
          message: "Unable to resolve your active branch assignment.",
        });
      }

      allowedBranchIds = [fixedBranchId];
    }
  }

  const borrower = await db
    .select({
      user_id: borrower_info.user_id,
      first_name: borrower_info.first_name,
      middle_name: borrower_info.middle_name,
      last_name: borrower_info.last_name,
      contact_number: users.contact_no,
      email: users.email,
      status: users.status,
      date_created: users.date_created,
      address: borrower_info.address,
      company_id: users.company_id,
      area_id: areas.area_id,
      area_code: areas.area_code,
      area_no: areas.area_no,
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
      branch_code: branch.branch_code,
    })
    .from(borrower_info)
    .innerJoin(users, eq(users.user_id, borrower_info.user_id))
    .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
    .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
    .where(eq(borrower_info.user_id, borrowerId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!borrower) {
    return renderMessageCard({
      href: "/dashboard/borrowers",
      label: "Back to borrowers",
      message: "Borrower not found.",
    });
  }

  if (!isAdmin && !allowedBranchIds.includes(borrower.branch_id)) {
    return renderMessageCard({
      href: "/dashboard/borrowers",
      label: "Back to borrowers",
      message: "You are not authorized to access this borrower profile.",
    });
  }

  const fullName = formatDisplayName(borrower.first_name, borrower.middle_name, borrower.last_name);
  const fullNameWithMiddle = formatFullName(borrower.first_name, borrower.middle_name, borrower.last_name);
  const branchLabel = borrower.branch_name || borrower.branch_code;
  const areaLabel = borrower.area_no ? `Area ${borrower.area_no} (${borrower.area_code})` : borrower.area_code;
  const headerBadgeBaseClassName = "inline-flex items-center rounded-md border px-3 py-1 text-xs font-medium leading-none shadow-xs";
  const backNavigation = resolveBackNavigation({
    source,
    returnTo: returnToParam,
    fallbackHref: "/dashboard/borrowers",
    fallbackLabel: "Back to Borrowers",
    allowedPrefixes: ["/dashboard/borrowers", "/dashboard/manage-user-accounts"],
    sourceMap: {
      borrowers: {
        href: "/dashboard/borrowers",
        label: "Back to Borrowers",
        allowedPrefixes: ["/dashboard/borrowers"],
      },
      "manage-users": {
        href: "/dashboard/manage-user-accounts",
        label: "Back to Manage Users",
        allowedPrefixes: ["/dashboard/manage-user-accounts"],
      },
    },
  });
  const currentBorrowerHref = buildReturnTo(`/dashboard/borrowers/${borrowerId}`, new URLSearchParams({
    ...(activeTab !== "profile" ? { tab: activeTab } : {}),
    ...(docsPage > 1 ? { docsPage: String(docsPage) } : {}),
    source,
    returnTo: backNavigation.href,
  }));

  return (
    <div className="space-y-4">
      <DashboardHeaderConfigurator
        config={{
          breadcrumbTitle: `${fullName} (${borrower.company_id})`,
          description: "Review borrower account details, loan history, and operational documents within your allowed scope.",
          icon: <User className="size-9 text-sidebar-foreground/65" />,
          title: "Borrower Details",
        }}
      />

      <div className="overflow-hidden rounded-md border border-border/70 bg-card text-card-foreground shadow-sm">
        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">{fullName}</h1>
                  <span
                    className={
                      borrower.status === "active"
                        ? `${headerBadgeBaseClassName} border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300`
                        : `${headerBadgeBaseClassName} border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-500/30 dark:bg-zinc-500/10 dark:text-zinc-300`
                    }
                  >
                    {borrower.status === "active" ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                  <p>{borrower.company_id}</p>
                  <p>Borrower</p>
                  <p>{`${branchLabel} / ${areaLabel}`}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {canCreateLoan ? (
                <Link href={appendBackNavigationToHref(`/dashboard/create-loan?borrowerId=${borrower.user_id}`, {
                  source: "borrowers",
                  returnTo: currentBorrowerHref,
                })}>
                  <Button
                    className="h-11 rounded-md bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700 hover:text-white"
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    Create Loan
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className={UI_TAB_SEPARATOR_CLASS_NAME}>
        <div className={UI_TAB_LIST_CLASS_NAME}>
          <Link
            className={getUiTabTriggerClassName(activeTab === "profile")}
            href={buildTabHref({ borrowerId, tab: "profile", docsPage, source, returnTo: backNavigation.href })}
          >
            <User className={activeTab === "profile" ? UI_TAB_ICON_ACTIVE_CLASS_NAME : undefined} />
            Profile
          </Link>
          <Link
            className={getUiTabTriggerClassName(activeTab === "loan-history")}
            href={buildTabHref({ borrowerId, tab: "loan-history", docsPage, source, returnTo: backNavigation.href })}
          >
            <FileChartColumn className={activeTab === "loan-history" ? UI_TAB_ICON_ACTIVE_CLASS_NAME : undefined} />
            Loan History
          </Link>
          <Link
            className={getUiTabTriggerClassName(activeTab === "documents")}
            href={buildTabHref({ borrowerId, tab: "documents", docsPage, source, returnTo: backNavigation.href })}
          >
            <ReceiptText className={activeTab === "documents" ? UI_TAB_ICON_ACTIVE_CLASS_NAME : undefined} />
            Documents
          </Link>
        </div>
      </div>

      {activeTab === "profile" ? (
        <BorrowerProfileSummaryTab
          borrower={{
            fullName,
            fullNameWithMiddle,
            companyId: borrower.company_id,
            status: borrower.status,
            contactNumber: borrower.contact_number,
            email: borrower.email,
            branchLabel,
            areaCode: borrower.area_code,
            address: borrower.address,
            dateCreated: borrower.date_created,
          }}
          borrowerId={borrower.user_id}
        />
      ) : activeTab === "loan-history" ? (
        <Suspense fallback={<TabSkeleton />}>
          <BorrowerLoanHistoryLoader borrowerId={borrower.user_id} returnTo={currentBorrowerHref} />
        </Suspense>
      ) : (
        <Suspense fallback={<TabSkeleton />}>
          <BorrowerDocumentsLoader
            borrowerId={borrower.user_id}
            canManageDocs={canManageDocs}
            canViewDocs={canViewDocs}
            docsOffset={docsOffset}
            docsPage={docsPage}
          />
        </Suspense>
      )}
    </div>
  );
}
