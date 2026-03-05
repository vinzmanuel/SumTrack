import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { db } from "@/db";
import { loan_records } from "@/db/schema";

type PageProps = {
  params: Promise<{ loanId: string }>;
};

export default async function BorrowerLoanDetailRedirectPage({ params }: PageProps) {
  const { loanId } = await params;
  const auth = await requireDashboardAuth(["Borrower"]);
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const parsedLoanId = /^\d+$/.test(loanId) ? Number(loanId) : null;
  if (!parsedLoanId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Invalid loan ID.</p>
        </CardContent>
      </Card>
    );
  }

  const ownedLoan = await db
    .select({ loan_id: loan_records.loan_id })
    .from(loan_records)
    .where(and(eq(loan_records.loan_id, parsedLoanId), eq(loan_records.borrower_id, auth.userId)))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!ownedLoan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loan not found.</p>
        </CardContent>
      </Card>
    );
  }

  redirect(`/dashboard/loans/${ownedLoan.loan_id}`);
}
