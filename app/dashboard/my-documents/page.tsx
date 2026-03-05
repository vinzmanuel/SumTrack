import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { BorrowerDocumentsSection } from "@/app/dashboard/borrowers/[borrowerId]/documents/borrower-documents-section";
import { db } from "@/db";
import { borrower_docs, employee_info, loan_records, users } from "@/db/schema";

type PageProps = {
  searchParams: Promise<{
    docsPage?: string;
  }>;
};

const DOCS_PAGE_SIZE = 10;

export default async function MyDocumentsPage({ searchParams }: PageProps) {
  const auth = await requireDashboardAuth(["Borrower"]);
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const { docsPage: docsPageParam } = await searchParams;
  const docsPage = Math.max(1, Number.parseInt(docsPageParam ?? "1", 10) || 1);
  const docsOffset = (docsPage - 1) * DOCS_PAGE_SIZE;

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
    .where(eq(borrower_docs.borrower_id, auth.userId))
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

  const myLoans = await db
    .select({
      loan_id: loan_records.loan_id,
      loan_code: loan_records.loan_code,
    })
    .from(loan_records)
    .where(eq(loan_records.borrower_id, auth.userId))
    .orderBy(desc(loan_records.loan_id))
    .limit(20)
    .catch(() => []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>My Documents</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/dashboard/my-loans">
            <Button type="button" variant="outline">
              My Loans
            </Button>
          </Link>
        </CardContent>
      </Card>

      <BorrowerDocumentsSection
        borrowerId={auth.userId}
        canManage={false}
        canView
        currentPage={docsPage}
        docs={pagedDocs}
        hasMore={hasMoreDocs}
      />

      <Card>
        <CardHeader>
          <CardTitle>Loan Document Access</CardTitle>
        </CardHeader>
        <CardContent>
          {myLoans.length === 0 ? (
            <p className="text-muted-foreground text-sm">No loans available.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {myLoans.map((loan) => (
                <Link href={`/dashboard/loans/${loan.loan_id}`} key={loan.loan_id}>
                  <Button type="button" variant="secondary">
                    {loan.loan_code}
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

