import { notFound } from "next/navigation";
import { User } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  parseManageUserAccountsFilters,
  resolveManageUserAccountsAccess,
} from "@/app/dashboard/manage-user-accounts/filters";
import { ManagedUserSummaryCard } from "@/app/dashboard/manage-user-accounts/managed-user-summary-card";
import { loadManagedUserDetail } from "@/app/dashboard/manage-user-accounts/queries";

function formatDisplayName(firstName: string, middleName: string, lastName: string) {
  const first = firstName.trim();
  const middle = middleName.trim();
  const last = lastName.trim();
  const middleInitial = middle ? `${middle.charAt(0)}.` : "";

  return [first, middleInitial, last].filter(Boolean).join(" ").trim() || "N/A";
}

export default async function ManagedUserDetailPage({
  params,
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

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <DashboardHeaderConfigurator
        config={{
          breadcrumbTitle: `${detail.fullName} (${detail.companyId})`,
          description: "Review read-only employee account details, role context, and branch or area scope assignment.",
          icon: <User className="size-9 text-sidebar-foreground/65" />,
          title: "Employee Details",
        }}
      />

      <ManagedUserSummaryCard
        companyId={detail.companyId}
        details={[
          { label: "Full Name", value: detail.fullName },
          { label: "Status", value: detail.status === "active" ? "Active" : "Inactive" },
          {
            label: detail.status === "active" ? "Current Branch / Scope" : "Last Held Branch / Scope",
            value: detail.scopeLabel,
          },
          detail.status === "active" && detail.scopeLabel === "Unassigned" && detail.lastHeldBranchAssignments.length > 0
            ? {
                label: "Last Held Branch / Scope",
                value: detail.lastHeldBranchAssignments.map((item) => item.branchCode || item.branchName).join(", "),
              }
            : null,
          detail.status === "inactive" && detail.lastHeldAreaCode
            ? { label: "Last Held Area", value: detail.lastHeldAreaCode }
            : detail.status === "active" && detail.currentAreaCode
              ? { label: "Current Area", value: detail.currentAreaCode }
              : detail.status === "active" && detail.lastHeldAreaCode
                ? { label: "Last Held Area", value: detail.lastHeldAreaCode }
              : null,
          { label: "Contact No.", value: detail.contactNo || "N/A" },
          { label: "Email", value: detail.email || "N/A" },
          { label: "Account Category", value: detail.accountCategory },
          { label: "Date Created", value: detail.dateCreated || "N/A" },
          detail.accountCategory === "Borrower" ? { label: "Address", value: detail.address || "N/A" } : null,
        ].filter(Boolean) as Array<{ label: string; value: string | null | undefined }>}
        eyebrow="Account Overview"
        roleName={detail.roleName}
        status={detail.status}
        subtitle={
          detail.status === "inactive"
            ? "Read-only inactive account details, including the last held assignment context."
            : "Read-only account details for this user within your allowed scope."
        }
        headingName={formatDisplayName(detail.firstName, detail.middleName, detail.lastName)}
        title={detail.fullName}
      />

      <Card className="hidden">
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
