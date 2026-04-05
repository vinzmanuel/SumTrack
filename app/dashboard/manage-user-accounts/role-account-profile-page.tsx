import { notFound } from "next/navigation";
import { DashboardBackLink } from "@/app/dashboard/_components/dashboard-back-link";
import { firstSearchValue, resolveBackNavigation } from "@/app/dashboard/back-navigation";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  parseManageUserAccountsFilters,
  resolveManageUserAccountsAccess,
} from "@/app/dashboard/manage-user-accounts/filters";
import { loadManagedUserDetailByCompanyId } from "@/app/dashboard/manage-user-accounts/queries";
import { ManagedUserSummaryCard } from "@/app/dashboard/manage-user-accounts/managed-user-summary-card";

export async function renderRoleAccountProfilePage(params: {
  expectedRoleName: string;
  companyId: string;
  title: string;
  searchParams?: Promise<{
    source?: string;
    returnTo?: string;
  }>;
}) {
  const auth = await getDashboardAuthContext();
  const accessState = resolveManageUserAccountsAccess(auth, parseManageUserAccountsFilters({}));

  if (accessState.view !== "staff") {
    return notFound();
  }

  const detail = await loadManagedUserDetailByCompanyId(
    accessState,
    params.companyId,
    params.expectedRoleName,
  );

  if (!detail) {
    return notFound();
  }

  const resolvedSearchParams = (await params.searchParams) ?? {};
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
    <div className="mx-auto max-w-6xl space-y-5">
      <DashboardBackLink href={backNavigation.href} label={backNavigation.label} />

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
        ].filter(Boolean) as Array<{ label: string; value: string | null | undefined }>}
        eyebrow="Account Overview"
        roleName={detail.roleName}
        status={detail.status}
        subtitle={
          detail.status === "inactive"
            ? "Read-only inactive account details, including the last held assignment context."
            : "Read-only account details for this user within your allowed scope."
        }
        title={detail.fullName}
      />
    </div>
  );
}
