import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/app/dashboard/_components/dashboard-shell";
import { requireDashboardAuth } from "@/app/dashboard/auth";

type NavItem = {
  href: string;
  label: string;
};

function navItemsForRole(roleName: string): NavItem[] {
  if (roleName === "Admin") {
    return [
      { href: "/dashboard", label: "Dashboard Home" },
      { href: "/dashboard/create-account", label: "Create Account" },
      { href: "/dashboard/borrowers", label: "Borrowers" },
      { href: "/dashboard/loans", label: "Loans" },
      { href: "/dashboard/expenses", label: "Expenses" },
      { href: "/dashboard/incentives", label: "Incentives" },
    ];
  }

  if (roleName === "Branch Manager") {
    return [
      { href: "/dashboard", label: "Dashboard Home" },
      { href: "/dashboard/create-account", label: "Create Account" },
      { href: "/dashboard/create-loan", label: "Create Loan" },
      { href: "/dashboard/borrowers", label: "Borrowers" },
      { href: "/dashboard/loans", label: "Loans" },
      { href: "/dashboard/expenses", label: "Expenses" },
      { href: "/dashboard/incentives", label: "Incentives" },
    ];
  }

  if (roleName === "Secretary") {
    return [
      { href: "/dashboard", label: "Dashboard Home" },
      { href: "/dashboard/create-account", label: "Create Borrower" },
      { href: "/dashboard/create-loan", label: "Create Loan" },
      { href: "/dashboard/borrowers", label: "Borrowers" },
      { href: "/dashboard/loans", label: "Loans" },
    ];
  }

  if (roleName === "Auditor") {
    return [
      { href: "/dashboard", label: "Dashboard Home" },
      { href: "/dashboard/borrowers", label: "Borrowers" },
      { href: "/dashboard/loans", label: "Loans" },
      { href: "/dashboard/expenses", label: "Expenses" },
      { href: "/dashboard/incentives", label: "Incentives" },
    ];
  }

  if (roleName === "Collector") {
    return [
      { href: "/dashboard", label: "My Performance" },
      { href: "/dashboard/assigned-loans", label: "Assigned Loans" },
      { href: "/dashboard/my-collections", label: "My Collections" },
    ];
  }

  if (roleName === "Borrower") {
    return [
      { href: "/dashboard", label: "Dashboard Home" },
      { href: "/dashboard/my-loans", label: "My Loans" },
      { href: "/dashboard/my-documents", label: "My Documents" },
    ];
  }

  return [{ href: "/dashboard", label: "Dashboard Home" }];
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
