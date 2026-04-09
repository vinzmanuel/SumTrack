import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DashboardBackLink } from "@/app/dashboard/_components/dashboard-back-link";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { firstSearchValue, resolveBackNavigation } from "@/app/dashboard/back-navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  parseManageUserAccountsFilters,
  resolveManageUserAccountsAccess,
} from "@/app/dashboard/manage-user-accounts/filters";
import { loadManagedUserDetail } from "@/app/dashboard/manage-user-accounts/queries";

export default async function ManagedUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<{ source?: string; returnTo?: string | string[] }>;
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

  const resolvedSearchParams = (await searchParams) ?? {};
  const backNavigation = resolveBackNavigation({
    source: firstSearchValue(resolvedSearchParams.source),
    returnTo: firstSearchValue(resolvedSearchParams.returnTo),
    fallbackHref: "/dashboard/manage-user-accounts",
    fallbackLabel: "Back to User Accounts",
    allowedPrefixes: ["/dashboard/manage-user-accounts", "/dashboard/branches"],
    sourceMap: {
      "manage-users": {
        href: "/dashboard/manage-user-accounts",
        label: "Back to User Accounts",
        allowedPrefixes: ["/dashboard/manage-user-accounts"],
      },
      branches: {
        href: "/dashboard/branches",
        label: "Back to Branches",
        allowedPrefixes: ["/dashboard/branches"],
      },
    },
  });

  return (
    <div className="space-y-6">
      <DashboardHeaderConfigurator
        config={{
          title: `${detail.fullName} (${detail.companyId})`,
        }}
      />
      <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge className="border-zinc-200 bg-zinc-50 text-zinc-700" variant="outline">
              {detail.companyId}
            </Badge>
            <CardTitle>{detail.fullName}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {detail.scopeLabel}
              {detail.scopeContextLabel ? ` • ${detail.scopeContextLabel}` : ""}
            </p>
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
              <div>
                <dt className="font-medium">
                  {detail.status === "active" ? "Current Branch / Scope" : "Last Held Branch / Scope"}
                </dt>
                <dd>{detail.scopeLabel}</dd>
              </div>
              {detail.status === "active" && detail.scopeLabel === "Unassigned" && detail.lastHeldBranchAssignments.length > 0 ? (
                <div>
                  <dt className="font-medium">Last Held Branch / Scope</dt>
                  <dd>{detail.lastHeldBranchAssignments.map((item) => item.branchCode || item.branchName).join(", ")}</dd>
                </div>
              ) : null}
              {detail.status === "inactive" && detail.lastHeldAreaCode ? (
                <div><dt className="font-medium">Last Held Area</dt><dd>{detail.lastHeldAreaCode}</dd></div>
              ) : null}
              {detail.status === "active" && detail.currentAreaCode ? (
                <div><dt className="font-medium">Current Area</dt><dd>{detail.currentAreaCode}</dd></div>
              ) : null}
              {detail.status === "active" && !detail.currentAreaCode && detail.lastHeldAreaCode ? (
                <div><dt className="font-medium">Last Held Area</dt><dd>{detail.lastHeldAreaCode}</dd></div>
              ) : null}
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
