import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  parseManageUserAccountsFilters,
  resolveManageUserAccountsAccess,
} from "@/app/dashboard/manage-user-accounts/filters";
import { loadManagedUserDetail } from "@/app/dashboard/manage-user-accounts/queries";

export default async function ManagedUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const auth = await getDashboardAuthContext();
  const accessState = resolveManageUserAccountsAccess(auth, parseManageUserAccountsFilters({}));

  if (accessState.view !== "staff") {
    return notFound();
  }

  const { userId } = await params;
  const detail = await loadManagedUserDetail(accessState, userId);

  if (!detail) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge className="border-zinc-200 bg-zinc-50 text-zinc-700" variant="outline">
              {detail.companyId}
            </Badge>
            <CardTitle>{detail.fullName}</CardTitle>
            <p className="text-sm text-muted-foreground">{detail.scopeLabel}</p>
          </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/manage-user-accounts">
            <Button type="button" variant="outline">
              Back to User Accounts
            </Button>
          </Link>
        </div>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="font-medium">Role</dt><dd>{detail.roleName}</dd></div>
              <div><dt className="font-medium">Category</dt><dd>{detail.accountCategory}</dd></div>
              <div><dt className="font-medium">Company ID</dt><dd>{detail.companyId}</dd></div>
            </dl>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="font-medium">Full Name</dt><dd>{detail.fullName}</dd></div>
              <div><dt className="font-medium">Branch / Scope</dt><dd>{detail.scopeLabel}</dd></div>
              <div><dt className="font-medium">Contact</dt><dd>{detail.contactLabel}</dd></div>
              {detail.accountCategory === "Borrower" ? (
                <div><dt className="font-medium">Address</dt><dd>{detail.address || "N/A"}</dd></div>
              ) : null}
            </dl>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
