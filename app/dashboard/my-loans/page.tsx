import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { db } from "@/db";
import { loan_records } from "@/db/schema";

function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function MyLoansPage() {
  const auth = await requireDashboardAuth(["Borrower"]);
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const loans = await db
    .select({
      loan_id: loan_records.loan_id,
      loan_code: loan_records.loan_code,
      principal: loan_records.principal,
      interest: loan_records.interest,
      due_date: loan_records.due_date,
      status: loan_records.status,
    })
    .from(loan_records)
    .where(eq(loan_records.borrower_id, auth.userId))
    .orderBy(desc(loan_records.loan_id))
    .catch(() => []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Loans</CardTitle>
      </CardHeader>
      <CardContent>
        {loans.length === 0 ? (
          <p className="text-muted-foreground text-sm">No loan records found.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-2 py-2 font-medium">Loan Code</th>
                  <th className="px-2 py-2 font-medium">Principal</th>
                  <th className="px-2 py-2 font-medium">Interest</th>
                  <th className="px-2 py-2 font-medium">Due Date</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr className="border-b" key={loan.loan_id}>
                    <td className="px-2 py-2">{loan.loan_code}</td>
                    <td className="px-2 py-2">{formatMoney(Number(loan.principal) || 0)}</td>
                    <td className="px-2 py-2">{Number(loan.interest) || 0}%</td>
                    <td className="px-2 py-2">{loan.due_date}</td>
                    <td className="px-2 py-2">{loan.status}</td>
                    <td className="px-2 py-2">
                      <Link href={`/dashboard/my-loans/${loan.loan_id}`}>
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
  );
}
