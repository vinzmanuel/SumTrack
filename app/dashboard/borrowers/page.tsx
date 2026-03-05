import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { areas, borrower_info, branch, employee_branch_assignment, roles, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<{
    branchId?: string;
    areaId?: string;
  }>;
};

function formatNameList(lastName: string | null, firstName: string | null, middleName: string | null) {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  const middle = (middleName ?? "").trim();
  const middleInitial = middle ? `${middle[0].toUpperCase()}.` : "";
  const right = [first, middleInitial].filter(Boolean).join(" ");

  if (last && right) {
    return `${last}, ${right}`;
  }
  return last || right || "N/A";
}

function toPositiveInt(value: string) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

export default async function BorrowersPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const requestedBranchId = String(params.branchId ?? "").trim();
  const requestedAreaId = String(params.areaId ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Borrowers</CardTitle>
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

  if (!isAdmin && !isBranchManager && !isSecretary) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Borrowers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are logged in, but only Admin, Branch Manager, and Secretary can access borrowers.
            </p>
            <Link className="text-sm underline" href="/dashboard">
              Back to dashboard
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  let allowedBranchId: number | null = null;
  let scopeMessage = "";

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

    if (activeAssignments.length === 0) {
      return (
        <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>Borrowers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                No active branch assignment found for your account.
              </p>
              <Link className="text-sm underline" href="/dashboard">
                Back to dashboard
              </Link>
            </CardContent>
          </Card>
        </main>
      );
    }

    const uniqueBranchIds = Array.from(new Set(activeAssignments.map((item) => item.branch_id)));
    if (uniqueBranchIds.length !== 1) {
      return (
        <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
          <Card>
            <CardHeader>
              <CardTitle>Borrowers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Multiple active branch assignments detected. Please contact Admin.
              </p>
              <Link className="text-sm underline" href="/dashboard">
                Back to dashboard
              </Link>
            </CardContent>
          </Card>
        </main>
      );
    }

    allowedBranchId = uniqueBranchIds[0];
    scopeMessage = "Branch scope is enforced from your active assignment.";
  }

  const allBranches = await db
    .select({
      branch_id: branch.branch_id,
      branch_name: branch.branch_name,
      branch_code: branch.branch_code,
    })
    .from(branch)
    .orderBy(asc(branch.branch_name))
    .catch(() => []);

  const selectableBranches = isAdmin
    ? allBranches
    : allBranches.filter((item) => item.branch_id === allowedBranchId);

  const selectedBranchId = isAdmin
    ? toPositiveInt(requestedBranchId)
    : allowedBranchId;

  const branchScopedAreas = await db
    .select({
      area_id: areas.area_id,
      branch_id: areas.branch_id,
      area_code: areas.area_code,
    })
    .from(areas)
    .where(selectedBranchId ? eq(areas.branch_id, selectedBranchId) : undefined)
    .orderBy(asc(areas.area_code))
    .catch(() => []);

  const selectedAreaCandidate = toPositiveInt(requestedAreaId);
  const selectedAreaId = selectedAreaCandidate && branchScopedAreas.some((a) => a.area_id === selectedAreaCandidate)
    ? selectedAreaCandidate
    : null;

  const whereParts = [] as Array<ReturnType<typeof eq>>;
  if (selectedBranchId) {
    whereParts.push(eq(areas.branch_id, selectedBranchId));
  }
  if (selectedAreaId) {
    whereParts.push(eq(areas.area_id, selectedAreaId));
  }

  const borrowerRows = await db
    .select({
      user_id: borrower_info.user_id,
      first_name: borrower_info.first_name,
      middle_name: borrower_info.middle_name,
      last_name: borrower_info.last_name,
      contact_number: borrower_info.contact_number,
      company_id: users.company_id,
      area_code: areas.area_code,
      branch_name: branch.branch_name,
      branch_code: branch.branch_code,
    })
    .from(borrower_info)
    .innerJoin(users, eq(users.user_id, borrower_info.user_id))
    .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
    .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
    .where(whereParts.length ? and(...whereParts) : undefined)
    .orderBy(asc(users.company_id))
    .catch(() => []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Borrowers</CardTitle>
          <CardDescription>Browse borrower accounts and view profiles</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/dashboard">
            <Button type="button" variant="outline">
              Back to dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          {scopeMessage ? <CardDescription>{scopeMessage}</CardDescription> : null}
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-3" method="get">
            {isAdmin ? (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="branchId">
                  Branch
                </label>
                <select
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                  defaultValue={selectedBranchId ? String(selectedBranchId) : ""}
                  id="branchId"
                  name="branchId"
                >
                  <option value="">All branches</option>
                  {selectableBranches.map((item) => (
                    <option key={item.branch_id} value={String(item.branch_id)}>
                      {item.branch_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="areaId">
                Area
              </label>
              <select
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                defaultValue={selectedAreaId ? String(selectedAreaId) : ""}
                id="areaId"
                name="areaId"
              >
                <option value="">All areas</option>
                {branchScopedAreas.map((item) => (
                  <option key={item.area_id} value={String(item.area_id)}>
                    {item.area_code}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2 md:col-span-3">
              <Button type="submit">Apply Filters</Button>
              <Link href="/dashboard/borrowers">
                <Button type="button" variant="outline">
                  Clear
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Borrower Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {borrowerRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No borrowers found for the selected filter.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-260 text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-2 py-2 font-medium">Company ID</th>
                    <th className="px-2 py-2 font-medium">Name</th>
                    <th className="px-2 py-2 font-medium">Area</th>
                    <th className="px-2 py-2 font-medium">Branch</th>
                    <th className="px-2 py-2 font-medium">Contact</th>
                    <th className="px-2 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {borrowerRows.map((row) => (
                    <tr className="border-b" key={row.user_id}>
                      <td className="px-2 py-2">{row.company_id}</td>
                      <td className="px-2 py-2">
                        {formatNameList(row.last_name, row.first_name, row.middle_name)}
                      </td>
                      <td className="px-2 py-2">{row.area_code}</td>
                      <td className="px-2 py-2">{row.branch_code || row.branch_name}</td>
                      <td className="px-2 py-2">{row.contact_number || "N/A"}</td>
                      <td className="px-2 py-2">
                        <Link href={`/dashboard/borrowers/${row.user_id}`}>
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
    </main>
  );
}
