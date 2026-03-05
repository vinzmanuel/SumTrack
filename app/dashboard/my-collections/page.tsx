import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { db } from "@/db";
import { collections, loan_records } from "@/db/schema";

function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function MyCollectionsPage() {
  const auth = await requireDashboardAuth(["Collector"]);
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Collections</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const rows = await db
    .select({
      collection_id: collections.collection_id,
      collection_code: collections.collection_code,
      amount: collections.amount,
      note: collections.note,
      collection_date: collections.collection_date,
      loan_code: loan_records.loan_code,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(eq(loan_records.collector_id, auth.userId))
    .orderBy(desc(collections.collection_date), desc(collections.collection_id))
    .catch(() => []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Collections</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No collections found.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-2 py-2 font-medium">Collection Code</th>
                  <th className="px-2 py-2 font-medium">Loan Code</th>
                  <th className="px-2 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 font-medium">Amount</th>
                  <th className="px-2 py-2 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr className="border-b" key={row.collection_id}>
                    <td className="px-2 py-2">{row.collection_code}</td>
                    <td className="px-2 py-2">{row.loan_code}</td>
                    <td className="px-2 py-2">{row.collection_date}</td>
                    <td className="px-2 py-2">{formatMoney(Number(row.amount) || 0)}</td>
                    <td className="px-2 py-2">{row.note || "-"}</td>
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

