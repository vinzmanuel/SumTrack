import { notFound } from "next/navigation";
import { User } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { getDashboardAuthContext } from "@/app/dashboard/auth";
import {
  parseManageUserAccountsFilters,
  resolveManageUserAccountsAccess,
} from "@/app/dashboard/manage-user-accounts/filters";
import { loadManagedUserDetailByCompanyId } from "@/app/dashboard/manage-user-accounts/queries";
import { ManagedUserSummaryCard } from "@/app/dashboard/manage-user-accounts/managed-user-summary-card";

function formatDisplayName(firstName: string, middleName: string, lastName: string) {
  const first = firstName.trim();
  const middle = middleName.trim();
  const last = lastName.trim();
  const middleInitial = middle ? `${middle.charAt(0)}.` : "";

  return [first, middleInitial, last].filter(Boolean).join(" ").trim() || "N/A";
}

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
    </div>
  );
}
