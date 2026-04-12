import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/app/dashboard/_components/dashboard-shell";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { loadBranchCodeById } from "@/app/dashboard/branches/queries";

type NavItem = {
  href: string;
  label: string;
  section: "main" | "finance" | "system";
  icon:
    | "layout-dashboard"
    | "hand-coins"
    | "gift"
    | "bar-chart-3"
    | "user-star"
    | "building-2"
    | "users"
    | "user-cog"
    | "receipt-text"
    | "banknote-arrow-down"
    | "wallet"
    | "logs"
    | "user-plus"
    | "user-round"
    | "settings";
};

function buildSharedOperationalNavItems(options?: {
  branchLabel?: string;
  branchHref?: string;
  includeAuditLog?: boolean;
}): NavItem[] {
  const auditLogItems: NavItem[] = options?.includeAuditLog
    ? [{ href: "/dashboard/audit-log", label: "Audit Log", section: "system", icon: "logs" }]
    : [];

  return [
    { href: "/dashboard", label: "Overview", section: "main", icon: "layout-dashboard" },
    { href: "/dashboard/loans", label: "Loans", section: "main", icon: "receipt-text" },
    {
      href: options?.branchHref ?? "/dashboard/branches",
      label: options?.branchLabel ?? "Branches",
      section: "main",
      icon: "building-2",
    },
    { href: "/dashboard/borrowers", label: "Borrowers", section: "main", icon: "users" },
    { href: "/dashboard/collectors", label: "Collectors", section: "main", icon: "user-star" },
    { href: "/dashboard/collections", label: "Collections", section: "finance", icon: "hand-coins" },
    { href: "/dashboard/incentives", label: "Incentives", section: "finance", icon: "gift" },
    { href: "/dashboard/expenses", label: "Expenses", section: "finance", icon: "banknote-arrow-down" },
    { href: "/dashboard/reports", label: "Reports", section: "system", icon: "bar-chart-3" },
    ...auditLogItems,
    { href: "/dashboard/manage-user-accounts", label: "Manage User Accounts", section: "system", icon: "user-cog" },
    { href: "/dashboard/my-profile", label: "My Profile", section: "system", icon: "user-round" },
  ];
}

function navItemsForRole(roleName: string, options?: { branchManagerBranchHref?: string | null }): NavItem[] {
  if (roleName === "Admin") {
    return buildSharedOperationalNavItems({ includeAuditLog: true });
  }

  if (roleName === "Branch Manager") {
    return buildSharedOperationalNavItems({
      branchHref: options?.branchManagerBranchHref ?? "/dashboard/branches",
      branchLabel: "Manage Branch",
      includeAuditLog: true,
    });
  }

  if (roleName === "Secretary") {
    return [
      { href: "/dashboard", label: "Overview", section: "main", icon: "layout-dashboard" },
      { href: "/dashboard/loans", label: "Loans", section: "main", icon: "receipt-text" },
      { href: "/dashboard/borrowers", label: "Borrowers", section: "main", icon: "users" },
      { href: "/dashboard/reports", label: "Reports", section: "system", icon: "bar-chart-3" },
      { href: "/dashboard/create-account", label: "Manage Borrower Accounts", section: "system", icon: "users" },
      { href: "/dashboard/my-profile", label: "My Profile", section: "system", icon: "user-round" },
    ];
  }

  if (roleName === "Auditor") {
    return buildSharedOperationalNavItems({ includeAuditLog: true });
  }

  if (roleName === "Collector") {
    return [
      { href: "/dashboard", label: "Overview", section: "main", icon: "layout-dashboard" },
      { href: "/dashboard/my-performance", label: "My Performance", section: "main", icon: "bar-chart-3" },
      { href: "/dashboard/assigned-loans", label: "Assigned Loans", section: "main", icon: "receipt-text" },
      { href: "/dashboard/my-profile", label: "My Profile", section: "system", icon: "user-round" },
    ];
  }

  if (roleName === "Borrower") {
    return [
      { href: "/dashboard", label: "Overview", section: "main", icon: "layout-dashboard" },
      { href: "/dashboard/my-loans", label: "My Loans", section: "main", icon: "receipt-text" },
      { href: "/dashboard/my-profile", label: "My Profile", section: "system", icon: "user-round" },
    ];
  }

  return [{ href: "/dashboard", label: "Overview", section: "main", icon: "layout-dashboard" }];
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireDashboardAuth();

  if (!auth.ok) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center p-6">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{auth.message}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  let branchManagerBranchHref: string | null = null;
  if (auth.roleName === "Branch Manager" && auth.activeBranchId) {
    const branchCode = await loadBranchCodeById(auth.activeBranchId);
    if (branchCode) {
      branchManagerBranchHref = `/dashboard/branches/${encodeURIComponent(branchCode)}`;
    }
  }

  return (
    <DashboardShell
      companyId={auth.companyId}
      displayName={auth.displayName}
      navItems={navItemsForRole(auth.roleName, { branchManagerBranchHref })}
      roleName={auth.roleName}
    >
      {children}
    </DashboardShell>
  );
}
