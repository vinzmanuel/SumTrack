import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { borrower_info, branch, loan_records, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

type AppUserRow = {
  role_id: string | null;
};

type RoleRow = {
  role_id: string;
  role_name: string;
};

function formatMoney(value: number) {
  return value.toFixed(2);
}

export default async function LoansPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loans</CardTitle>
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

  const { data: currentAppUser } = await supabase
    .from("users")
    .select("role_id")
    .eq("user_id", user.id)
    .maybeSingle<AppUserRow>();

  const { data: currentRole } = currentAppUser?.role_id
    ? await supabase
        .from("roles")
        .select("role_id, role_name")
        .eq("role_id", currentAppUser.role_id)
        .maybeSingle<RoleRow>()
    : { data: null };

  if (currentRole?.role_name !== "Admin") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are logged in, but only Admin users can view loans.
            </p>
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const loans = await db
    .select({
      loan_id: loan_records.loan_id,
      borrower_id: loan_records.borrower_id,
      branch_id: loan_records.branch_id,
      principal: loan_records.principal,
      interest: loan_records.interest,
      start_date: loan_records.start_date,
      due_date: loan_records.due_date,
      status: loan_records.status,
    })
    .from(loan_records)
    .orderBy(desc(loan_records.loan_id))
    .catch(() => []);

  const borrowerIds = Array.from(new Set(loans.map((loan) => loan.borrower_id)));
  const branchIds = Array.from(new Set(loans.map((loan) => loan.branch_id)));

  const borrowerInfos = borrowerIds.length
    ? await db
        .select({
          user_id: borrower_info.user_id,
          first_name: borrower_info.first_name,
          last_name: borrower_info.last_name,
        })
        .from(borrower_info)
        .where(inArray(borrower_info.user_id, borrowerIds))
        .catch(() => [])
    : [];

  const borrowerUsers = borrowerIds.length
    ? await db
        .select({
          user_id: users.user_id,
          username: users.username,
        })
        .from(users)
        .where(inArray(users.user_id, borrowerIds))
        .catch(() => [])
    : [];

  const branches = branchIds.length
    ? await db
        .select({
          branch_id: branch.branch_id,
          branch_name: branch.branch_name,
        })
        .from(branch)
        .where(inArray(branch.branch_id, branchIds))
        .catch(() => [])
    : [];

  const borrowerInfoMap = new Map(borrowerInfos.map((item) => [item.user_id, item]));
  const borrowerUserMap = new Map(borrowerUsers.map((item) => [item.user_id, item]));
  const branchMap = new Map(branches.map((item) => [String(item.branch_id), item]));

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Loans</CardTitle>
          <CardDescription>Browse and open loan records</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/dashboard">
            <Button type="button" variant="outline">
              Back to dashboard
            </Button>
          </Link>
          <Link href="/dashboard/create-loan">
            <Button type="button">Create loan</Button>
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loan Records</CardTitle>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <p className="text-muted-foreground text-sm">No loans found.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-250 text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-2 py-2 font-medium">Loan ID</th>
                    <th className="px-2 py-2 font-medium">Borrower</th>
                    <th className="px-2 py-2 font-medium">Branch</th>
                    <th className="px-2 py-2 font-medium">Principal</th>
                    <th className="px-2 py-2 font-medium">Interest</th>
                    <th className="px-2 py-2 font-medium">Start Date</th>
                    <th className="px-2 py-2 font-medium">Due Date</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.map((loan) => {
                    const borrowerInfo = borrowerInfoMap.get(loan.borrower_id);
                    const borrowerUser = borrowerUserMap.get(loan.borrower_id);
                    const borrowerName =
                      [borrowerInfo?.first_name, borrowerInfo?.last_name]
                        .filter(Boolean)
                        .join(" ") ||
                      borrowerUser?.username ||
                      loan.borrower_id;
                    const branchName =
                      branchMap.get(String(loan.branch_id))?.branch_name || "N/A";

                    return (
                      <tr className="border-b" key={String(loan.loan_id)}>
                        <td className="px-2 py-2">{String(loan.loan_id)}</td>
                        <td className="px-2 py-2">{borrowerName}</td>
                        <td className="px-2 py-2">{branchName}</td>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
