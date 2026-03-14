"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CircleUserRound,
  ChevronLeft,
  FileText,
  HandCoins,
  LayoutDashboard,
  Menu,
  ReceiptText,
  Settings,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardPageHeader } from "@/app/dashboard/_components/dashboard-page-header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    | "user-round"
    | "settings";
};

type DashboardShellProps = {
  roleName: string;
  companyId: string;
  navItems: NavItem[];
  children: React.ReactNode;
};

function isActiveNav(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavContent({
  roleName,
  companyId,
  navItems,
  closeDrawer,
  isCollapsed = false,
}: {
  roleName: string;
  companyId: string;
  navItems: NavItem[];
  closeDrawer?: () => void;
  isCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const activeItem = navItems.find((item) => isActiveNav(pathname, item.href));
  const sectionOrder: Array<NavItem["section"]> = ["main", "finance", "system"];
  const sectionTitles: Record<NavItem["section"], string> = {
    main: "Main",
    finance: "Finance",
    system: "System",
  };

  const Icon = ({ icon }: { icon: NavItem["icon"] }) => {
    if (icon === "layout-dashboard") return <LayoutDashboard className="h-4 w-4 shrink-0" />;
    if (icon === "hand-coins") return <HandCoins className="h-4 w-4 shrink-0" />;
    if (icon === "bar-chart-3") return <BarChart3 className="h-4 w-4 shrink-0" />;
    if (icon === "users") return <Users className="h-4 w-4 shrink-0" />;
    if (icon === "receipt-text") return <ReceiptText className="h-4 w-4 shrink-0" />;
    if (icon === "wallet") return <Wallet className="h-4 w-4 shrink-0" />;
    if (icon === "file-text") return <FileText className="h-4 w-4 shrink-0" />;
    if (icon === "user-plus") return <UserPlus className="h-4 w-4 shrink-0" />;
    if (icon === "user-round") return <CircleUserRound className="h-4 w-4 shrink-0" />;
    return <Settings className="h-4 w-4 shrink-0" />;
  };

  return (
    <div className="flex h-full flex-col bg-[#0f0707] text-zinc-100">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-4">
        {!isCollapsed ? (
          <div>
            <p className="text-lg font-semibold">
              <span className="text-red-500">$um</span>
              <span className="text-amber-400">track</span>
            </p>
            <p className="text-xs text-zinc-400">{roleName}</p>
            <p className="text-xs text-zinc-500">ID: {companyId}</p>
          </div>
        ) : (
          <p className="text-lg font-semibold text-red-500">$</p>
        )}
      </div>

      <nav className="flex-1 space-y-4 px-2 py-3">
        {sectionOrder.map((section) => {
          const sectionItems = navItems.filter((item) => item.section === section);
          if (sectionItems.length === 0) return null;
          return (
            <div key={section}>
              {!isCollapsed ? (
                <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {sectionTitles[section]}
                </p>
              ) : null}
              <div className="space-y-1">
                {sectionItems.map((item, index) => {
                  const key = `${item.href}-${item.label}-${index}`;
                  const active = activeItem === item;
                  return (
                    <Button
                      asChild
                      className={`w-full active:scale-[0.98] ${
                        isCollapsed ? "justify-center px-0" : "justify-start"
                      } ${
                        active
                          ? "bg-[oklch(0.29_0.02_25)] text-[oklch(0.99_0_0)] hover:bg-[oklch(0.29_0.02_25)] hover:text-[oklch(0.99_0_0)]"
                          : "text-[oklch(0.92_0_0)] hover:bg-[oklch(0.25_0.02_25)] hover:text-[oklch(0.95_0_0)]"
                      }`}
                      key={key}
                      onClick={closeDrawer}
                      variant="ghost"
                    >
                      <Link
                        aria-label={item.label}
                        className={`focus-visible:ring-ring inline-flex w-full items-center rounded-md px-2 py-2 text-sm focus-visible:ring-[3px] ${
                          isCollapsed ? "justify-center" : "gap-2"
                        }`}
                        href={item.href}
                      >
                        <Icon icon={item.icon} />
                        {!isCollapsed ? <span>{item.label}</span> : null}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 px-2 py-3">
        <form action="/auth/signout" method="post">
          <Button
            className={`w-full justify-center bg-red-950 text-zinc-200 hover:bg-red-900 hover:text-white active:scale-[0.98] focus-visible:ring-zinc-400 ${
              isCollapsed ? "px-0" : ""
            }`}
            title="Sign out"
            type="submit"
            variant="ghost"
          >
            {!isCollapsed ? "Sign out" : <ChevronLeft className="h-4 w-4 rotate-180" />}
          </Button>
        </form>
      </div>
    </div>
  );
}

export function DashboardShell({ roleName, companyId, navItems, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const normalizedItems = useMemo(() => navItems, [navItems]);
  const pathname = usePathname();
  const currentPageLabel = useMemo(() => {
    if (/^\/dashboard\/collectors\/[^/]+$/.test(pathname)) {
      return "Collector Details";
    }

    if (/^\/dashboard\/borrowers\/[^/]+$/.test(pathname)) {
      return "Borrower's Details";
    }

    return normalizedItems.find((item) => isActiveNav(pathname, item.href))?.label ?? "Overview";
  }, [normalizedItems, pathname]);

  return (
    <div className="min-h-screen bg-background md:h-screen md:overflow-hidden">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <p className="text-sm font-semibold">SumTrack</p>
        <Button onClick={() => setMobileOpen(true)} size="icon" type="button" variant="outline">
          <Menu className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex w-full md:h-screen">
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 border-r border-zinc-800 md:block ${
            isCollapsed ? "w-14" : "w-64"
          }`}
        >
          <div className="h-full overflow-y-auto">
            <NavContent
              companyId={companyId}
              isCollapsed={isCollapsed}
              navItems={normalizedItems}
              roleName={roleName}
            />
          </div>
        </aside>
        <main className="min-w-0 flex-1 bg-zinc-50/60 md:h-screen md:overflow-y-auto">
          <DashboardPageHeader
            isCollapsed={isCollapsed}
            onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
            title={currentPageLabel}
          />
          <div className="px-3 pb-4 pt-4 md:px-6 md:pb-6 md:pt-6">
            {children}
          </div>
        </main>
      </div>

      <Dialog onOpenChange={setMobileOpen} open={mobileOpen}>
        <DialogContent className="left-0 top-0 h-screen max-w-[86vw] translate-x-0 translate-y-0 rounded-none border-r p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Navigation</DialogTitle>
            <DialogDescription>Dashboard menu</DialogDescription>
          </DialogHeader>
          <NavContent
            closeDrawer={() => setMobileOpen(false)}
            companyId={companyId}
            isCollapsed={false}
            navItems={normalizedItems}
            roleName={roleName}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
