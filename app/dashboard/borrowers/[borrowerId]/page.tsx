import Link from "next/link";
import { and, desc, eq, isNull } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import {
  areas,
  borrower_docs,
  borrower_info,
  branch,
  employee_branch_assignment,
  employee_info,
  loan_records,
  roles,
  users,
} from "@/db/schema";
import { BorrowerDocumentsSection } from "@/app/dashboard/borrowers/[borrowerId]/documents/borrower-documents-section";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    borrowerId: string;
  }>;
  searchParams: Promise<{
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

function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function BorrowerProfilePage({ params, searchParams }: PageProps) {
  const { borrowerId } = await params;
  const { docsPage: docsPageParam } = await searchParams;
  const docsPage = Math.max(1, Number.parseInt(docsPageParam ?? "1", 10) || 1);
  const docsOffset = (docsPage - 1) * DOCS_PAGE_SIZE;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Borrower Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Not logged in</p>
            <Link className="mt-3 inline-block text-sm underline" href="/login">
              Go to login
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const currentAppUser = await db
    .select({ role_id: users.role_id })
    .from(users)
    .where(eq(users.user_id, user.id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const currentRole = currentAppUser?.role_id
    ? await db
        .select({ role_name: roles.role_name })
        .from(roles)
        .where(eq(roles.role_id, currentAppUser.role_id))
        .limit(1)
        .then((rows) => rows[0] ?? null)
        .catch(() => null)
    : null;

  const isAdmin = currentRole?.role_name === "Admin";
  const isBranchManager = currentRole?.role_name === "Branch Manager";
  const isSecretary = currentRole?.role_name === "Secretary";
  const isAuditor = currentRole?.role_name === "Auditor";
  const isCollector = currentRole?.role_name === "Collector";
  const canManageDocs = isAdmin || isBranchManager || isSecretary;
  const canViewDocs = isAdmin || isBranchManager || isSecretary || isAuditor;

  if (isCollector) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Borrower Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Collectors cannot access borrower pages or borrower documents.
            </p>
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!isAdmin && !isBranchManager && !isSecretary && !isAuditor) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Borrower Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are logged in, but only Admin, Branch Manager, Secretary, and Auditor can access borrower profiles.
            </p>
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  let allowedBranchIds: number[] = [];
  if (!isAdmin) {
    const activeAssignments = await db
      .select({
        branch_id: employee_branch_assignment.branch_id,
      })
      .from(employee_branch_assignment)
      .where(
        and(
          eq(employee_branch_assignment.employee_user_id, user.id),
          isNull(employee_branch_assignment.end_date),
        ),
      )
      .catch(() => []);

    const uniqueBranchIds = Array.from(new Set(activeAssignments.map((item) => item.branch_id)));
    if (isAuditor) {
      if (uniqueBranchIds.length === 0) {
        return (
          <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
            <Card>
              <CardHeader>
                <CardTitle>Borrower Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Unable to resolve your assigned branches.
                </p>
                <Link className="text-sm underline" href="/dashboard/borrowers">
                  Back to borrowers
                </Link>
              </CardContent>
            </Card>
          </main>
        );
      }
      allowedBranchIds = uniqueBranchIds;
    } else if (uniqueBranchIds.length !== 1) {
      return (
        <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>Borrower Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Unable to resolve your active branch assignment.
              </p>
              <Link className="text-sm underline" href="/dashboard/borrowers">
                Back to borrowers
              </Link>
            </CardContent>
          </Card>
        </main>
      );
    } else {
      allowedBranchIds = [uniqueBranchIds[0]];
    }
  }

  const borrower = await db
    .select({
      user_id: borrower_info.user_id,
      first_name: borrower_info.first_name,
      middle_name: borrower_info.middle_name,
      last_name: borrower_info.last_name,
      contact_number: borrower_info.contact_number,
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
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Borrower Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Borrower not found.</p>
            <Link className="text-sm underline" href="/dashboard/borrowers">
              Back to borrowers
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!isAdmin && !allowedBranchIds.includes(borrower.branch_id)) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Borrower Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-destructive">
              You are not authorized to access this borrower profile.
            </p>
            <Link className="text-sm underline" href="/dashboard/borrowers">
              Back to borrowers
            </Link>
          </CardContent>
        </Card>
      </main>
    );
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Borrower Profile</CardTitle>
          <CardDescription>Borrower details and loan history</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/dashboard/borrowers">
            <Button type="button" variant="outline">
              Back to borrowers
            </Button>
          </Link>
          {isAdmin || isBranchManager || isSecretary ? (
            <Link href={`/dashboard/create-loan?borrowerId=${borrower.user_id}`}>
              <Button type="button">Create Loan</Button>
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Borrower Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <p>
            <span className="font-medium">Company ID:</span> {borrower.company_id}
          </p>
          <p>
            <span className="font-medium">Name:</span>{" "}
            {formatSummaryName(borrower.first_name, borrower.middle_name, borrower.last_name)}
          </p>
          <p>
            <span className="font-medium">Contact Number:</span> {borrower.contact_number || "N/A"}
          </p>
          <p>
            <span className="font-medium">Address:</span> {borrower.address || "N/A"}
          </p>
          <p>
            <span className="font-medium">Branch:</span> {borrower.branch_name || borrower.branch_code}
          </p>
          <p>
            <span className="font-medium">Area:</span> {borrower.area_code}
          </p>
          <p className="text-muted-foreground md:col-span-2">
            <span className="font-medium">Borrower UUID:</span> {borrower.user_id}
          </p>
        </CardContent>
      </Card>

        <BorrowerDocumentsSection
          borrowerId={borrower.user_id}
          canManage={canManageDocs}
        canView={canViewDocs}
        currentPage={docsPage}
        docs={pagedDocs}
        hasMore={hasMoreDocs}
      />

      <Card>
        <CardHeader>
          <CardTitle>Loan History</CardTitle>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <p className="text-muted-foreground text-sm">No loan records for this borrower.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-250 text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-2 py-2 font-medium">Loan Code</th>
                    <th className="px-2 py-2 font-medium">Principal</th>
                    <th className="px-2 py-2 font-medium">Interest</th>
                    <th className="px-2 py-2 font-medium">Start Date</th>
                    <th className="px-2 py-2 font-medium">Due Date</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan) => (
                    <tr className="border-b" key={String(loan.loan_id)}>
                      <td className="px-2 py-2">{loan.loan_code}</td>
                      <td className="px-2 py-2">{formatMoney(Number(loan.principal) || 0)}</td>
                      <td className="px-2 py-2">{Number(loan.interest) || 0}%</td>
                      <td className="px-2 py-2">{loan.start_date}</td>
                      <td className="px-2 py-2">{loan.due_date}</td>
                      <td className="px-2 py-2">{loan.status}</td>
                      <td className="px-2 py-2">
                        <Link href={`/dashboard/loans/${loan.loan_id}`}>
                          <Button size="sm" type="button" variant="outline">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
