import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { db } from "@/db";
import { borrower_info, loan_records, users } from "@/db/schema";

export default async function AssignedLoansPage() {
  const auth = await requireDashboardAuth(["Collector"]);
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assigned Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const rows = await db
    .select({
      loan_id: loan_records.loan_id,
      loan_code: loan_records.loan_code,
      due_date: loan_records.due_date,
      status: loan_records.status,
      borrower_id: loan_records.borrower_id,
      company_id: users.company_id,
      first_name: borrower_info.first_name,
      last_name: borrower_info.last_name,
    })
    .from(loan_records)
    .innerJoin(users, eq(users.user_id, loan_records.borrower_id))
    .leftJoin(borrower_info, eq(borrower_info.user_id, loan_records.borrower_id))
    .where(eq(loan_records.collector_id, auth.userId))
    .orderBy(desc(loan_records.loan_id))
    .catch(() => []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Assigned Loans</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No assigned loans.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-2 py-2 font-medium">Loan Code</th>
                    <th className="px-2 py-2 font-medium">Borrower</th>
                    <th className="px-2 py-2 font-medium">Company ID</th>
                    <th className="px-2 py-2 font-medium">Due Date</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr className="border-b" key={row.loan_id}>
                      <td className="px-2 py-2">{row.loan_code}</td>
                      <td className="px-2 py-2">
                        {[row.first_name, row.last_name].filter(Boolean).join(" ") || row.borrower_id}
                      </td>
                      <td className="px-2 py-2">{row.company_id}</td>
                      <td className="px-2 py-2">{row.due_date}</td>
                      <td className="px-2 py-2">{row.status}</td>
                      <td className="px-2 py-2">
                        <Link href={`/dashboard/loans/${row.loan_id}`}>
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
