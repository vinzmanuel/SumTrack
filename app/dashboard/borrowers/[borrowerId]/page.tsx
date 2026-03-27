import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { DashboardBackLink } from "@/app/dashboard/_components/dashboard-back-link";
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

function formatSummaryName(firstName: string | null, middleName: string | null, lastName: string | null) {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  const middle = (middleName ?? "").trim();
  const middleInitial = middle ? `${middle[0].toUpperCase()}.` : "";
  return [first, middleInitial, last].filter(Boolean).join(" ") || "N/A";
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

  const loans = await db
    .select({
      loan_id: loan_records.loan_id,
      loan_code: loan_records.loan_code,
      principal: loan_records.principal,
      interest: loan_records.interest,
      start_date: loan_records.start_date,
      due_date: loan_records.due_date,
      status: loan_records.status,
    })
    .from(loan_records)
    .where(eq(loan_records.borrower_id, borrower.user_id))
    .orderBy(desc(loan_records.loan_id))
    .catch(() => []);

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
    .where(eq(borrower_docs.borrower_id, borrower.user_id))
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

  const fullName = formatSummaryName(
    borrower.first_name,
    borrower.middle_name,
    borrower.last_name,
  );
  const branchLabel = borrower.branch_code || borrower.branch_name;
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
    <div className="space-y-6">
      <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />

      <TremorCard className="overflow-hidden p-0">
        <div className="bg-gradient-to-r from-slate-50 via-white to-emerald-50/60 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">{fullName}</h1>
                <TremorDescription>{`${branchLabel} / ${borrower.area_code}`}</TremorDescription>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-foreground">
                  Company ID: {borrower.company_id}
                </span>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
                  Role: Borrower
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
                  Status: {borrower.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {canCreateLoan ? (
                <Link href={appendBackNavigationToHref(`/dashboard/create-loan?borrowerId=${borrower.user_id}`, {
                  source: "borrowers",
                  returnTo: currentBorrowerHref,
                })}>
                  <Button type="button">Create Loan</Button>
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 p-6">
          <div className="inline-flex flex-wrap gap-2 rounded-xl border border-border/70 bg-muted/30 p-1">
            <Link href={buildTabHref({ borrowerId, tab: "profile", docsPage, source, returnTo: backNavigation.href })}>
              <TabButton active={activeTab === "profile"} label="Profile" />
            </Link>
            <Link href={buildTabHref({ borrowerId, tab: "loan-history", docsPage, source, returnTo: backNavigation.href })}>
              <TabButton active={activeTab === "loan-history"} label="Loan History" />
            </Link>
            <Link href={buildTabHref({ borrowerId, tab: "documents", docsPage, source, returnTo: backNavigation.href })}>
              <TabButton active={activeTab === "documents"} label="Documents" />
            </Link>
          </div>
        </div>
      </TremorCard>

      {activeTab === "profile" ? (
        <BorrowerProfileSummaryTab
          borrower={{
            fullName,
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
        <BorrowerLoanHistoryTab
          loans={loans.map((loan) => ({
            loanId: loan.loan_id,
            loanCode: loan.loan_code,
            principal: Number(loan.principal) || 0,
            interest: Number(loan.interest) || 0,
            startDate: loan.start_date,
            dueDate: loan.due_date,
            visibleStatus: getVisibleLoanStatusFromStoredStatus(loan.status),
          }))}
          returnTo={currentBorrowerHref}
        />
      ) : (
        <BorrowerDocumentsSection
          borrowerId={borrower.user_id}
          canManage={canManageDocs}
          canView={canViewDocs}
          currentPage={docsPage}
          docs={pagedDocs}
          hasMore={hasMoreDocs}
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
