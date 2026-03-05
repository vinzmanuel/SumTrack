import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { LoansFilters } from "@/app/dashboard/loans/loans-filters";
import { db } from "@/db";
import { borrower_info, branch, employee_info, loan_records, users } from "@/db/schema";

type PageProps = {
  searchParams?: Promise<{
    branchId?: string;
  }>;
};

function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function LoansPage({ searchParams }: PageProps) {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const role = auth.roleName;
  const canViewStaffLoans = role === "Admin" || role === "Branch Manager" || role === "Secretary" || role === "Auditor";
  const isCollector = role === "Collector";
  const isBorrower = role === "Borrower";

  if (isCollector) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Use Assigned Loans to view your loan portfolio.</p>
          <Link href="/dashboard/assigned-loans">
            <Button size="sm" type="button">Go to Assigned Loans</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (isBorrower) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">Use My Loans to view your account.</p>
          <Link href="/dashboard/my-loans">
            <Button size="sm" type="button">Go to My Loans</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (!canViewStaffLoans) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">You are not authorized to view loans.</p>
        </CardContent>
      </Card>
    );
  }

  const params = (await searchParams) ?? {};
  const requestedBranchId = /^\d+$/.test(String(params.branchId ?? "")) ? Number(params.branchId) : null;
  const isAdmin = role === "Admin";
  const isAuditor = role === "Auditor";
  const isBranchScoped = role === "Branch Manager" || role === "Secretary";

  let allowedBranchIds: number[] = [];
  if (isAdmin) {
    allowedBranchIds = [];
  } else if (isBranchScoped) {
    allowedBranchIds = auth.activeBranchId ? [auth.activeBranchId] : [];
  } else if (isAuditor) {
    allowedBranchIds = auth.assignedBranchIds;
  }

  const selectedBranchId = isAdmin ? requestedBranchId : isAuditor ? (requestedBranchId && allowedBranchIds.includes(requestedBranchId) ? requestedBranchId : null) : allowedBranchIds[0] ?? null;

  const whereCondition = isAdmin
    ? (selectedBranchId ? eq(loan_records.branch_id, selectedBranchId) : undefined)
    : selectedBranchId
      ? eq(loan_records.branch_id, selectedBranchId)
      : allowedBranchIds.length > 0
        ? inArray(loan_records.branch_id, allowedBranchIds)
        : eq(loan_records.loan_id, -1);

  const loans = await db
    .select({
      loan_id: loan_records.loan_id,
      loan_code: loan_records.loan_code,
      borrower_id: loan_records.borrower_id,
      branch_id: loan_records.branch_id,
      collector_id: loan_records.collector_id,
      principal: loan_records.principal,
      interest: loan_records.interest,
      start_date: loan_records.start_date,
      due_date: loan_records.due_date,
      status: loan_records.status,
    })
    .from(loan_records)
    .where(whereCondition)
    .orderBy(desc(loan_records.loan_id))
    .catch(() => []);

  const borrowerIds = Array.from(new Set(loans.map((loan) => loan.borrower_id)));
  const collectorIds = Array.from(
    new Set(loans.map((loan) => loan.collector_id).filter((value): value is string => Boolean(value))),
  );

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
          company_id: users.company_id,
        })
        .from(users)
        .where(inArray(users.user_id, borrowerIds))
        .catch(() => [])
    : [];

  const branches = await db
    .select({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
    })
    .from(branch)
    .orderBy(asc(branch.branch_name))
    .catch(() => []);

  const collectorUsers = collectorIds.length
    ? await db
        .select({
          user_id: users.user_id,
          username: users.username,
        })
        .from(users)
        .where(inArray(users.user_id, collectorIds))
        .catch(() => [])
    : [];

  const collectorInfos = collectorIds.length
    ? await db
        .select({
          user_id: employee_info.user_id,
          first_name: employee_info.first_name,
          last_name: employee_info.last_name,
        })
        .from(employee_info)
        .where(inArray(employee_info.user_id, collectorIds))
        .catch(() => [])
    : [];

  const borrowerInfoMap = new Map(borrowerInfos.map((item) => [item.user_id, item]));
  const borrowerUserMap = new Map(borrowerUsers.map((item) => [item.user_id, item]));
  const branchMap = new Map(branches.map((item) => [String(item.branch_id), item]));
  const collectorUserMap = new Map(collectorUsers.map((item) => [item.user_id, item]));
  const collectorInfoMap = new Map(collectorInfos.map((item) => [item.user_id, item]));

  const branchOptions = isAdmin
    ? branches
    : branches.filter((item) => allowedBranchIds.includes(item.branch_id));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isAdmin || isAuditor ? (
            <LoansFilters
              branches={branchOptions.map((item) => ({
                branch_id: item.branch_id,
                branch_name: item.branch_name,
              }))}
              selectedBranchId={selectedBranchId}
            />
          ) : null}

          {(role === "Admin" || role === "Branch Manager" || role === "Secretary") ? (
            <Link href="/dashboard/create-loan">
              <Button size="sm" type="button" variant="secondary">Create loan</Button>
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Loan Records</CardTitle>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <p className="text-muted-foreground text-sm">No loans found for your scope.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-2 py-2 font-medium">Loan Code</th>
                    <th className="px-2 py-2 font-medium">Borrower</th>
                    <th className="px-2 py-2 font-medium">Branch</th>
                    <th className="px-2 py-2 font-medium">Collector</th>
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
                      [borrowerInfo?.first_name, borrowerInfo?.last_name].filter(Boolean).join(" ") ||
                      borrowerUser?.company_id ||
                      borrowerUser?.username ||
                      loan.borrower_id;
                    const branchName = branchMap.get(String(loan.branch_id))?.branch_name || "N/A";
                    const collectorId = loan.collector_id;
                    const collectorInfo = collectorId ? collectorInfoMap.get(collectorId) : null;
                    const collectorUser = collectorId ? collectorUserMap.get(collectorId) : null;
                    const collectorName = collectorId
                      ? [collectorInfo?.first_name, collectorInfo?.last_name].filter(Boolean).join(" ") ||
                        collectorUser?.username ||
                        collectorId
                      : "N/A";

                    return (
                      <tr className="border-b" key={String(loan.loan_id)}>
                        <td className="px-2 py-2">{loan.loan_code}</td>
                        <td className="px-2 py-2">{borrowerName}</td>
                        <td className="px-2 py-2">{branchName}</td>
                        <td className="px-2 py-2">{collectorName}</td>
                        <td className="px-2 py-2">{formatMoney(Number(loan.principal) || 0)}</td>
                        <td className="px-2 py-2">{Number(loan.interest) || 0}%</td>
                        <td className="px-2 py-2">{loan.start_date}</td>
                        <td className="px-2 py-2">{loan.due_date}</td>
                        <td className="px-2 py-2">{loan.status}</td>
                        <td className="px-2 py-2">
                          <Link href={`/dashboard/loans/${loan.loan_id}`}>
                            <Button size="sm" type="button" variant="outline">View</Button>
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
    </div>
  );
}
