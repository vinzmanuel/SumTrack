import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
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
      <div className="flex justify-end">
        <Link href="/dashboard/manage-user-accounts">
          <Button type="button" variant="outline">
            Back to User Accounts
          </Button>
        </Link>
      </div>

      <ManagedUserSummaryCard
        companyId={detail.companyId}
        details={[
          { label: "Full Name", value: detail.fullName },
          { label: "Status", value: detail.status === "active" ? "Active" : "Inactive" },
          { label: "Branch / Scope", value: detail.scopeLabel },
          { label: "Contact No.", value: detail.contactNo || "N/A" },
          { label: "Email", value: detail.email || "N/A" },
          { label: "Account Category", value: detail.accountCategory },
          { label: "Date Created", value: detail.dateCreated || "N/A" },
        ]}
        eyebrow="Account Overview"
        roleName={detail.roleName}
        status={detail.status}
        subtitle="Read-only account details for this user within your allowed scope."
        title={detail.fullName}
      />
    </div>
  );
}
