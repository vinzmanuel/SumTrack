import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/app/dashboard/_components/dashboard-shell";
import { requireDashboardAuth } from "@/app/dashboard/auth";

type NavItem = {
  href: string;
  label: string;
  section: "main" | "finance" | "system";
  icon:
    | "layout-dashboard"
    | "hand-coins"
    | "bar-chart-3"
    | "users"
    | "receipt-text"
    | "wallet"
    | "file-text"
    | "user-plus"
    | "settings";
};

function navItemsForRole(roleName: string): NavItem[] {
  if (roleName === "Admin") {
    return [
      { href: "/dashboard", label: "Overview", section: "main", icon: "layout-dashboard" },
      { href: "/dashboard/loans", label: "Loans", section: "main", icon: "hand-coins" },
      { href: "/dashboard/borrowers", label: "Borrowers", section: "main", icon: "users" },
      { href: "/dashboard/collectors", label: "Collectors", section: "main", icon: "bar-chart-3" },
      { href: "/dashboard/collections", label: "Collections", section: "finance", icon: "receipt-text" },
      { href: "/dashboard/incentives", label: "Incentives", section: "finance", icon: "wallet" },
      { href: "/dashboard/expenses", label: "Expenses", section: "finance", icon: "receipt-text" },
      { href: "/dashboard/my-documents", label: "Documents", section: "system", icon: "file-text" },
      { href: "/dashboard/create-account", label: "Create Account", section: "system", icon: "user-plus" },
      { href: "/dashboard", label: "Settings", section: "system", icon: "settings" },
    ];
  }

  if (roleName === "Branch Manager") {
    return [
      { href: "/dashboard", label: "Overview", section: "main", icon: "layout-dashboard" },
      { href: "/dashboard/loans", label: "Loans", section: "main", icon: "hand-coins" },
      { href: "/dashboard/borrowers", label: "Borrowers", section: "main", icon: "users" },
      { href: "/dashboard/collectors", label: "Collectors", section: "main", icon: "bar-chart-3" },
      { href: "/dashboard/collections", label: "Collections", section: "finance", icon: "receipt-text" },
      { href: "/dashboard/incentives", label: "Incentives", section: "finance", icon: "wallet" },
      { href: "/dashboard/expenses", label: "Expenses", section: "finance", icon: "receipt-text" },
      { href: "/dashboard/my-documents", label: "Documents", section: "system", icon: "file-text" },
      { href: "/dashboard/create-account", label: "Create Account", section: "system", icon: "user-plus" },
      { href: "/dashboard", label: "Settings", section: "system", icon: "settings" },
    ];
  }

  if (roleName === "Secretary") {
    return [
      { href: "/dashboard", label: "Overview", section: "main", icon: "layout-dashboard" },
      { href: "/dashboard/loans", label: "Loans", section: "main", icon: "hand-coins" },
      { href: "/dashboard/borrowers", label: "Borrowers", section: "main", icon: "users" },
      { href: "/dashboard/loans", label: "Collections", section: "main", icon: "receipt-text" },
      { href: "/dashboard/my-documents", label: "Documents", section: "system", icon: "file-text" },
      { href: "/dashboard/create-account", label: "Create Account", section: "system", icon: "user-plus" },
      { href: "/dashboard", label: "Settings", section: "system", icon: "settings" },
    ];
  }

  if (roleName === "Auditor") {
    return [
      { href: "/dashboard", label: "Overview", section: "main", icon: "layout-dashboard" },
      { href: "/dashboard/loans", label: "Loans", section: "main", icon: "hand-coins" },
      { href: "/dashboard/borrowers", label: "Borrowers", section: "main", icon: "users" },
      { href: "/dashboard/collectors", label: "Collectors", section: "main", icon: "bar-chart-3" },
      { href: "/dashboard/collections", label: "Collections", section: "finance", icon: "receipt-text" },
      { href: "/dashboard/incentives", label: "Incentives", section: "finance", icon: "wallet" },
      { href: "/dashboard/expenses", label: "Expenses", section: "finance", icon: "receipt-text" },
      { href: "/dashboard/my-documents", label: "Documents", section: "system", icon: "file-text" },
      { href: "/dashboard", label: "Settings", section: "system", icon: "settings" },
    ];
  }

  if (roleName === "Collector") {
    return [
      { href: "/dashboard", label: "Overview", section: "main", icon: "layout-dashboard" },
      { href: "/dashboard/my-performance", label: "My Performance", section: "main", icon: "bar-chart-3" },
      { href: "/dashboard/assigned-loans", label: "Assigned Loans", section: "main", icon: "hand-coins" },
      { href: "/dashboard/my-collections", label: "My Collections", section: "main", icon: "receipt-text" },
      { href: "/dashboard", label: "Settings", section: "system", icon: "settings" },
    ];
  }

  if (roleName === "Borrower") {
    return [
      { href: "/dashboard", label: "Overview", section: "main", icon: "layout-dashboard" },
      { href: "/dashboard/my-loans", label: "Loans", section: "main", icon: "hand-coins" },
      { href: "/dashboard/my-documents", label: "Documents", section: "system", icon: "file-text" },
      { href: "/dashboard", label: "Settings", section: "system", icon: "settings" },
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

  return (
    <DashboardShell
      companyId={auth.companyId}
      navItems={navItemsForRole(auth.roleName)}
      roleName={auth.roleName}
    >
      {children}
    </DashboardShell>
  );
}
