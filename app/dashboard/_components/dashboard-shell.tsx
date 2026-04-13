"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BarChart3,
  BanknoteArrowDown,
  Building2,
  ChartColumn,
  FileChartColumn,
  FileStack,
  CircleUserRound,
  ChevronLeft,
  EllipsisVertical,
  Gift,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Logs,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  ReceiptText,
  Settings,
  UserCog,
  UserPlus,
  UserStar,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DashboardHeaderConfigProvider,
  type DashboardHeaderConfig,
} from "@/app/dashboard/_components/dashboard-header-config";
import { DashboardPageHeader } from "@/app/dashboard/_components/dashboard-page-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/app/dashboard/_components/theme-toggle";
import { buildReturnTo, sanitizeReturnTo } from "@/app/dashboard/back-navigation";

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

type DashboardShellProps = {
  roleName: string;
  companyId: string;
  displayName: string;
  navItems: NavItem[];
  children: React.ReactNode;
};

const BRAND_FULL_SRC = "/Logo/SUMTRACK%20LOGO%20AND%20TEXT.png";
const ACTIVE_NAV_COLOR = "#e73c31";
const EXPANDED_SIDEBAR_WIDTH = 296;
const EXPANDED_SIDEBAR_X_PADDING = 20;
const EXPANDED_LOGO_WIDTH = EXPANDED_SIDEBAR_WIDTH - EXPANDED_SIDEBAR_X_PADDING * 2;
const EXPANDED_LOGO_HEIGHT = (EXPANDED_LOGO_WIDTH * 900) / 6550;
const SIDEBAR_BRAND_Y_PADDING = 20;
const DESKTOP_HEADER_HEIGHT = EXPANDED_LOGO_HEIGHT + SIDEBAR_BRAND_Y_PADDING * 2 + 9;
const sectionOrder: Array<NavItem["section"]> = ["main", "finance", "system"];
const sectionTitles: Record<NavItem["section"], string> = {
  main: "Main",
  finance: "Finance",
  system: "System",
};
const breadcrumbActionLabels: Record<string, string> = {
  archive: "Archive",
  create: "Create",
  delete: "Delete",
  edit: "Edit",
  "reassign-loans": "Reassign Loans",
  "risk-assessment": "Risk Assessment",
  rules: "Rules",
  status: "Status",
  "status-reconciliation": "Status Reconciliation",
  "system-monthly": "System Monthly",
  update: "Update",
};
const breadcrumbDetailLabels: Partial<Record<string, string>> = {
  "/dashboard/assigned-loans": "Loan Details",
  "/dashboard/borrowers": "Borrower Details",
  "/dashboard/branches": "Branch Details",
  "/dashboard/collectors": "Collector Details",
  "/dashboard/loans": "Loan Details",
  "/dashboard/manage-user-accounts": "User Details",
  "/dashboard/my-loans": "Loan Details",
  "/dashboard/reports": "Report Details",
};

function isActiveNav(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatBreadcrumbLabel(segment: string) {
  return decodeURIComponent(segment)
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

type DashboardBreadcrumbItem = {
  label: string;
  href?: string;
  current?: true;
};

function parseDashboardRouteHref(href: string) {
  const url = new URL(href, "http://sumtrack.local");
  return {
    pathname: url.pathname,
    searchParams: url.searchParams,
  };
}

function resolveDashboardRouteLabel(params: {
  pathname: string;
  searchParams: URLSearchParams;
  navItems: NavItem[];
  fallbackLabel: string;
}) {
  const tab = params.searchParams.get("tab");

  if (/^\/dashboard\/branches\/[^/]+$/.test(params.pathname)) {
    if (tab === "employees") {
      return "Employees";
    }

    if (tab === "areas") {
      return "Areas";
    }
  }

  if (/^\/dashboard\/borrowers\/[^/]+$/.test(params.pathname)) {
    if (tab === "loan-history") {
      return "Loan History";
    }

    if (tab === "documents") {
      return "Documents";
    }
  }

  if (/^\/dashboard\/collectors\/[^/]+$/.test(params.pathname)) {
    if (tab === "assigned-loans") {
      return "Assigned Loans";
    }

    if (tab === "performance") {
      return "Collector Performance";
    }
  }

  const directNav = params.navItems.find((item) => item.href === params.pathname);
  if (directNav) {
    return directNav.label;
  }

  return params.fallbackLabel;
}

function buildDashboardBreadcrumbs({
  currentPageLabel,
  navItems,
  pathname,
}: {
  currentPageLabel: string;
  navItems: NavItem[];
  pathname: string;
}) {
  if (pathname === "/dashboard") {
    return [{ label: "Dashboard", current: true as const }];
  }

  const items: Array<{ label: string; href?: string; current?: true }> = [
    { href: "/dashboard", label: "Dashboard" },
  ];
  const activeNav = [...navItems]
    .filter((item) => item.href !== "/dashboard" && isActiveNav(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length)[0];

  if (!activeNav) {
    items.push({ label: currentPageLabel, current: true });
    return items;
  }

  const remainder = pathname.slice(activeNav.href.length).split("/").filter(Boolean);

  if (remainder.length === 0) {
    items.push({ label: activeNav.label, current: true });
    return items;
  }

  items.push({ href: activeNav.href, label: activeNav.label });

  let detailConsumed = false;

  remainder.forEach((segment, index) => {
    const isLast = index === remainder.length - 1;
    const actionLabel = breadcrumbActionLabels[segment];

    if (actionLabel) {
      items.push({ label: actionLabel, current: isLast ? true : undefined });
      return;
    }

    if (!detailConsumed && breadcrumbDetailLabels[activeNav.href]) {
      items.push({
        label: breadcrumbDetailLabels[activeNav.href] ?? currentPageLabel,
        current: isLast ? true : undefined,
      });
      detailConsumed = true;
      return;
    }

    items.push({
      label: isLast ? currentPageLabel : formatBreadcrumbLabel(segment),
      current: isLast ? true : undefined,
    });
  });

  return items;
}

function buildRouteAwareBreadcrumbs(params: {
  pathname: string;
  searchParams: URLSearchParams;
  currentPageLabel: string;
  navItems: NavItem[];
  seenHrefs?: Set<string>;
}): DashboardBreadcrumbItem[] {
  const currentHref = buildReturnTo(params.pathname, params.searchParams);
  const safeReturnTo = sanitizeReturnTo(params.searchParams.get("returnTo"), ["/dashboard"]);
  const seenHrefs = params.seenHrefs ?? new Set<string>();

  if (safeReturnTo && safeReturnTo !== currentHref && !seenHrefs.has(currentHref)) {
    const nextSeen = new Set(seenHrefs);
    nextSeen.add(currentHref);

    const parentRoute = parseDashboardRouteHref(safeReturnTo);
    const parentLabel = resolveDashboardRouteLabel({
      pathname: parentRoute.pathname,
      searchParams: parentRoute.searchParams,
      navItems: params.navItems,
      fallbackLabel: formatBreadcrumbLabel(
        parentRoute.pathname.split("/").filter(Boolean).at(-1) ?? "Overview",
      ),
    });
    const parentItems = buildRouteAwareBreadcrumbs({
      pathname: parentRoute.pathname,
      searchParams: parentRoute.searchParams,
      currentPageLabel: parentLabel,
      navItems: params.navItems,
      seenHrefs: nextSeen,
    }).map((item, index, items) =>
      index === items.length - 1 && item.current
        ? {
            label: item.label,
            href: safeReturnTo,
          }
        : item,
    );

    return [...parentItems, { label: params.currentPageLabel, current: true }];
  }

  return buildDashboardBreadcrumbs({
    currentPageLabel: params.currentPageLabel,
    navItems: params.navItems,
    pathname: params.pathname,
  });
}

function buildDefaultDashboardHeaderConfig(
  pathname: string,
  roleName: string,
): DashboardHeaderConfig | null {
  if (pathname === "/dashboard") {
    return {
      action: null,
      description: "Monitor performance, operational health, and priorities in your current scope.",
      icon: <LayoutDashboard className="size-9 text-sidebar-foreground/65" />,
      title: "Overview",
      breadcrumbTitle: "Overview",
    };
  }

  if (pathname === "/dashboard/audit-log") {
    return {
      action: null,
      description: "Review security and operational event logs that happen across the system based on your scope",
      icon: <Logs className="size-9 text-sidebar-foreground/65" />,
      title: "Audit Log",
    };
  }

  if (pathname === "/dashboard/manage-user-accounts") {
    return {
      action: null,
      description: "Review, filter, and manage user accounts within your current scope.",
      icon: <UserCog className="size-9 text-sidebar-foreground/65" />,
      title: "Manage User Accounts",
    };
  }

  if (pathname === "/dashboard/reports") {
    return {
      action: null,
      description:
        "Review saved analytics reports and operational documents available inside your current reporting scope.",
      icon: <ChartColumn className="size-9 text-sidebar-foreground/65" />,
      title: "Reports",
    };
  }

  if (pathname === "/dashboard/expenses") {
    return {
      action: null,
      description: "Track branch expense records and analytics inside your current expense scope.",
      icon: <BanknoteArrowDown className="size-9 text-sidebar-foreground/65" />,
      title: "Expenses",
    };
  }

  if (pathname === "/dashboard/expenses/create") {
    return {
      action: null,
      description: "Record a branch operating expense inside your allowed assignment scope.",
      icon: <BanknoteArrowDown className="size-9 text-sidebar-foreground/65" />,
      title: "Record Expense",
    };
  }

  if (pathname === "/dashboard/reports/create") {
    return {
      action: null,
      description: "Generate and save a new report or document inside your current reporting scope.",
      icon: <FileStack className="size-9 text-sidebar-foreground/65" />,
      title: "Generate Report",
    };
  }

  if (pathname === "/dashboard/loans") {
    return {
      action: null,
      description: "Track, filter, and manage loan records across your current visible scope.",
      icon: <ReceiptText className="size-9 text-sidebar-foreground/65" />,
      title: "Loans",
    };
  }

  if (pathname === "/dashboard/my-loans") {
    return {
      action: null,
      description: "Review and track your own loan records and repayment progress.",
      icon: <ReceiptText className="size-9 text-sidebar-foreground/65" />,
      title: "My Loans",
    };
  }

  if (pathname === "/dashboard/create-loan") {
    return {
      action: null,
      description: "Create a new loan record with borrower, collector, and term details.",
      icon: <ReceiptText className="size-9 text-sidebar-foreground/65" />,
      title: "Create Loan",
    };
  }

  if (/^\/dashboard\/loans\/\d+$/.test(pathname)) {
    return {
      action: null,
      description: "Review loan summary, passbook entries, and repayment progression.",
      icon: <FileChartColumn className="size-9 text-sidebar-foreground/65" />,
      title: "Loan View",
    };
  }

  if (/^\/dashboard\/reports\/\d+$/.test(pathname)) {
    return {
      action: null,
      description: "Review and export the saved report snapshot using the viewer.",
      icon: <FileChartColumn className="size-9 text-sidebar-foreground/65" />,
      title: "Report Snapshot Viewer",
    };
  }

  if (pathname === "/dashboard/create-account") {
    const description =
      roleName === "Admin"
        ? "Provision employee and borrower accounts with role-aware branch and area assignments."
        : roleName === "Branch Manager"
          ? "Create secretary, collector, and borrower accounts within your assigned branch."
          : "Create borrower accounts within your assigned branch.";

    return {
      action: null,
      description,
      icon: <UserPlus className="size-9 text-sidebar-foreground/65" />,
      title: "Create User",
    };
  }

  return null;
}

function SidebarIcon({
  icon,
  className,
}: {
  icon: NavItem["icon"];
  className?: string;
}) {
  if (icon === "layout-dashboard") return <LayoutDashboard className={cn("size-4 shrink-0", className)} />;
  if (icon === "hand-coins") return <HandCoins className={cn("size-4 shrink-0", className)} />;
  if (icon === "gift") return <Gift className={cn("size-4 shrink-0", className)} />;
  if (icon === "bar-chart-3") return <BarChart3 className={cn("size-4 shrink-0", className)} />;
  if (icon === "user-star") return <UserStar className={cn("size-4 shrink-0", className)} />;
  if (icon === "building-2") return <Building2 className={cn("size-4 shrink-0", className)} />;
  if (icon === "users") return <Users className={cn("size-4 shrink-0", className)} />;
  if (icon === "user-cog") return <UserCog className={cn("size-4 shrink-0", className)} />;
  if (icon === "receipt-text") return <ReceiptText className={cn("size-4 shrink-0", className)} />;
  if (icon === "banknote-arrow-down") {
    return <BanknoteArrowDown className={cn("size-4 shrink-0", className)} />;
  }
  if (icon === "wallet") return <Wallet className={cn("size-4 shrink-0", className)} />;
  if (icon === "logs") return <Logs className={cn("size-4 shrink-0", className)} />;
  if (icon === "user-plus") return <UserPlus className={cn("size-4 shrink-0", className)} />;
  if (icon === "user-round") return <CircleUserRound className={cn("size-4 shrink-0", className)} />;
  return <Settings className={cn("size-4 shrink-0", className)} />;
}

function SidebarBrand({ isCollapsed }: { isCollapsed: boolean }) {
  const collapsedRevealWidth = Math.ceil((697 / 900) * EXPANDED_LOGO_HEIGHT);

  return (
    <Link
      aria-label="SumTrack"
      className={cn(
        "flex w-full items-center justify-center overflow-hidden transition-opacity hover:opacity-90",
        isCollapsed ? "justify-center" : "justify-start",
      )}
      href="/dashboard"
    >
      <div
        className="overflow-hidden transition-[width] duration-200 ease-in-out"
        style={{ width: `${isCollapsed ? collapsedRevealWidth : EXPANDED_LOGO_WIDTH}px` }}
      >
        <Image
          alt="SumTrack"
          className="block h-auto max-w-none object-contain object-left"
          height={900}
          priority
          sizes={`${EXPANDED_LOGO_WIDTH}px`}
          src={BRAND_FULL_SRC}
          style={{ width: `${EXPANDED_LOGO_WIDTH}px` }}
          width={6550}
        />
      </div>
    </Link>
  );
}

function SidebarProfileStrip({
  roleName,
  companyId,
  displayName,
  isCollapsed,
  menuTriggerId,
}: {
  roleName: string;
  companyId: string;
  displayName: string;
  isCollapsed: boolean;
  menuTriggerId: string;
}) {
  if (isCollapsed) {
    return (
      <div className="flex items-center justify-center">
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  className="size-9 rounded-xl text-muted-foreground shadow-none hover:bg-sidebar-accent/60 hover:text-foreground"
                  id={menuTriggerId}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <EllipsisVertical className="size-4 rotate-90" />
                  <span className="sr-only">Open profile menu</span>
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">More</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="center" className="w-40" side="right">
            <form action="/auth/signout" method="post">
              <DropdownMenuItem asChild variant="destructive">
                <button className="w-full" type="submit">
                  <LogOut className="size-4" />
                  Logout
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1 rounded-xl py-1.5">
        <p className="truncate text-sm font-semibold text-foreground">
          {displayName}
        </p>
        <p className="truncate text-[13px] text-muted-foreground/85">{companyId}</p>
        <p className="truncate text-[13px] text-muted-foreground/85">{roleName}</p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="size-9 rounded-xl text-muted-foreground shadow-none hover:bg-sidebar-accent/60 hover:text-foreground"
            id={menuTriggerId}
            size="icon"
            type="button"
            variant="ghost"
          >
            <EllipsisVertical className="size-4" />
            <span className="sr-only">Open profile menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44" side="top">
          <form action="/auth/signout" method="post">
            <DropdownMenuItem asChild variant="destructive">
              <button className="w-full" type="submit">
                <LogOut className="size-4" />
                Logout
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SidebarControlButton({
  isCollapsed,
  onToggleCollapsed,
}: {
  isCollapsed: boolean;
  onToggleCollapsed: (value: boolean) => void;
}) {
  const button = (
    <Button
      aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      className={cn(
        "h-9 w-full rounded-lg text-sm font-medium text-sidebar-foreground/65 shadow-none hover:bg-sidebar-accent/55 hover:text-sidebar-foreground",
        isCollapsed ? "justify-center px-0" : "justify-start gap-3 px-2.5",
      )}
      onClick={() => onToggleCollapsed(!isCollapsed)}
      size="sm"
      type="button"
      variant="ghost"
    >
      {isCollapsed ? (
        <PanelRightClose className="size-4 shrink-0" />
      ) : (
        <>
          <PanelRightOpen className="size-4 shrink-0" />
          <span className="truncate">Collapse sidebar</span>
        </>
      )}
    </Button>
  );

  if (!isCollapsed) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">Expand sidebar</TooltipContent>
    </Tooltip>
  );
}

function SidebarNavItem({
  item,
  active,
  isCollapsed,
  closeDrawer,
}: {
  item: NavItem;
  active: boolean;
  isCollapsed: boolean;
  closeDrawer?: () => void;
}) {
  const row = (
    <div className={cn("relative", isCollapsed ? "-ml-3 pl-3" : "-ml-5 pl-5")}>
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-0 top-1/2 z-10 h-6 w-[4px] -translate-y-1/2 rounded-r-md transition-opacity duration-200",
            active ? "opacity-100" : "opacity-0",
          )}
          style={{ backgroundColor: ACTIVE_NAV_COLOR }}
        />
      <Link
        aria-current={active ? "page" : undefined}
        aria-label={item.label}
        className={cn(
          "group relative flex h-9 w-full items-center rounded-lg px-2.5 text-sm transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
          isCollapsed ? "justify-center px-0" : "gap-3",
          active
            ? "bg-[color:color-mix(in_oklab,var(--app-background)_70%,white_30%)] text-foreground dark:bg-white/[0.04]"
            : "text-sidebar-foreground/65 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground",
        )}
        href={item.href}
        onClick={closeDrawer}
      >
        <SidebarIcon
          className={cn(
            "transition-colors",
            active ? "text-[#e73c31]" : "text-current",
          )}
          icon={item.icon}
        />
        {!isCollapsed ? <span className="truncate font-medium">{item.label}</span> : null}
      </Link>
    </div>
  );

  if (!isCollapsed) {
    return row;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function NavContent({
  roleName,
  companyId,
  displayName,
  navItems,
  closeDrawer,
  isCollapsed = false,
  onToggleCollapsed,
}: {
  roleName: string;
  companyId: string;
  displayName: string;
  navItems: NavItem[];
  closeDrawer?: () => void;
  isCollapsed?: boolean;
  onToggleCollapsed?: (value: boolean) => void;
}) {
  const pathname = usePathname();
  const menuTriggerId = `sidebar-profile-menu-trigger-${closeDrawer ? "mobile" : "desktop"}-${
    isCollapsed ? "collapsed" : "expanded"
  }`;
  const profileItem =
    navItems.find((item) => item.href === "/dashboard/my-profile") ?? null;
  const visibleNavItems = navItems.filter((item) => item.href !== "/dashboard/my-profile");

  return (
    <TooltipProvider delayDuration={80}>
      <div className="flex h-full flex-col overflow-x-hidden bg-background text-sidebar-foreground dark:bg-sidebar">
        <div className={cn("px-5 py-6", isCollapsed && "px-5 py-6")}>
          <SidebarBrand isCollapsed={isCollapsed} />
        </div>

        <div className={cn("mx-5 h-px bg-sidebar-border/80", isCollapsed && "mx-3")} />

        <nav
          className={cn(
            "flex-1 overflow-x-hidden overflow-y-auto px-5 py-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
            isCollapsed && "px-3 py-4",
          )}
        >
          <div className="space-y-5">
            {sectionOrder.map((section) => {
              const sectionItems = visibleNavItems.filter((item) => item.section === section);
              if (sectionItems.length === 0) return null;

              return (
                <div key={section}>
                  {!isCollapsed ? (
                    <p className="mb-2 text-[12px] font-semibold uppercase text-muted-foreground/55">
                      {sectionTitles[section]}
                    </p>
                  ) : null}
                  <div className="space-y-0.5">
                    {sectionItems.map((item) => (
                      <SidebarNavItem
                        active={isActiveNav(pathname, item.href)}
                        closeDrawer={closeDrawer}
                        isCollapsed={isCollapsed}
                        item={item}
                        key={item.href}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        <div className={cn("px-5 pb-3", isCollapsed && "px-3 pb-3 pt-3")}>
          {onToggleCollapsed ? (
            <div className="pb-3">
              <SidebarControlButton
                isCollapsed={isCollapsed}
                onToggleCollapsed={onToggleCollapsed}
              />
            </div>
          ) : null}
          {profileItem ? (
              <div className={cn("pb-3", isCollapsed && "pt-8")}>
              <SidebarNavItem
                active={isActiveNav(pathname, profileItem.href)}
                closeDrawer={closeDrawer}
                isCollapsed={isCollapsed}
                item={profileItem}
              />
            </div>
          ) : null}
          <div className="mb-3 h-px bg-sidebar-border/80" />
          <SidebarProfileStrip
            companyId={companyId}
            displayName={displayName}
            isCollapsed={isCollapsed}
            menuTriggerId={menuTriggerId}
            roleName={roleName}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

export function DashboardShell({
  roleName,
  companyId,
  displayName,
  navItems,
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [headerConfig, setHeaderConfig] = useState<DashboardHeaderConfig | null>(null);
  const normalizedItems = useMemo(() => navItems, [navItems]);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlHeight = html.style.height;
    const previousBodyHeight = body.style.height;
    const mediaQuery = window.matchMedia("(min-width: 768px)");

    const syncDesktopScrollLock = () => {
      if (mediaQuery.matches) {
        html.style.overflow = "hidden";
        body.style.overflow = "hidden";
        html.style.height = "100%";
        body.style.height = "100%";
      } else {
        html.style.overflow = previousHtmlOverflow;
        body.style.overflow = previousBodyOverflow;
        html.style.height = previousHtmlHeight;
        body.style.height = previousBodyHeight;
      }
    };

    syncDesktopScrollLock();
    mediaQuery.addEventListener("change", syncDesktopScrollLock);

    return () => {
      mediaQuery.removeEventListener("change", syncDesktopScrollLock);
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      html.style.height = previousHtmlHeight;
      body.style.height = previousBodyHeight;
    };
  }, []);

  const currentPageLabel = useMemo(() => {
    if (pathname === "/dashboard/create-account") {
      return "Create User";
    }

    if (pathname === "/dashboard/create-loan") {
      return "Create Loan";
    }

    if (/^\/dashboard\/collectors\/[^/]+$/.test(pathname)) {
      return "Collector Details";
    }

    if (/^\/dashboard\/borrowers\/[^/]+$/.test(pathname)) {
      return "Borrower's Details";
    }

    if (/^\/dashboard\/branches\/[^/]+$/.test(pathname)) {
      return "Branch Details";
    }

    if (/^\/dashboard\/manage-user-accounts\/[^/]+$/.test(pathname)) {
      return "User Details";
    }

    if (/^\/dashboard\/(admin|auditor|branch-manager|secretary)\/[^/]+$/.test(pathname)) {
      return "User Details";
    }

    if (pathname === "/dashboard/reports/create") {
      return "Generate Report";
    }

    if (/^\/dashboard\/loans\/\d+$/.test(pathname)) {
      return "Loan View";
    }

    if (/^\/dashboard\/reports\/\d+$/.test(pathname)) {
      return "Report Snapshot Viewer";
    }

    return normalizedItems.find((item) => isActiveNav(pathname, item.href))?.label ?? "Overview";
  }, [normalizedItems, pathname]);
  const defaultHeaderConfig = useMemo(
    () => buildDefaultDashboardHeaderConfig(pathname, roleName),
    [pathname, roleName],
  );
  const resolvedHeaderConfig = headerConfig ?? defaultHeaderConfig;
  const resolvedBreadcrumbCurrentLabel =
    resolvedHeaderConfig?.breadcrumbTitle ?? resolvedHeaderConfig?.title ?? currentPageLabel;
  const breadcrumbItems = useMemo(
    () => {
      if (resolvedHeaderConfig?.breadcrumbs) {
        return resolvedHeaderConfig.breadcrumbs;
      }

      const activeSearchParams = new URLSearchParams(searchParams.toString());

      return buildRouteAwareBreadcrumbs({
        pathname,
        searchParams: activeSearchParams,
        currentPageLabel: resolvedBreadcrumbCurrentLabel,
        navItems: normalizedItems,
      });
    },
    [normalizedItems, pathname, resolvedBreadcrumbCurrentLabel, searchParams, resolvedHeaderConfig?.breadcrumbs],
  );
  const shouldShowBreadcrumb = useMemo(
    () =>
      pathname.split("/").filter(Boolean).length >= 2 || Boolean(searchParams.get("returnTo")),
    [pathname, searchParams],
  );
  const previousBreadcrumbTarget = useMemo(() => {
    for (let index = breadcrumbItems.length - 2; index >= 0; index -= 1) {
      const item = breadcrumbItems[index];
      if (item?.href) {
        return item;
      }
    }
    return null;
  }, [breadcrumbItems]);
  const previousBreadcrumbHref = previousBreadcrumbTarget?.href ?? null;

  return (
    <div
      className="min-h-screen bg-[var(--app-background)] md:h-screen md:overflow-hidden"
      style={
        {
          "--dashboard-desktop-header-height": `${DESKTOP_HEADER_HEIGHT}px`,
        } as React.CSSProperties
      }
    >
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-sidebar-border/70 bg-card px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Button onClick={() => setMobileOpen(true)} size="icon" type="button" variant="outline">
            <Menu className="size-4" />
            <span className="sr-only">Open navigation</span>
          </Button>
          <Link className="relative h-8 w-[138px]" href="/dashboard">
            <Image
              alt="SumTrack"
              className="object-contain object-left"
              fill
              priority
              sizes="138px"
              src={BRAND_FULL_SRC}
            />
          </Link>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex min-h-0 w-full md:h-screen">
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 border-r border-sidebar-border/80 bg-background transition-[width] duration-200 md:block dark:bg-sidebar",
            isCollapsed ? "w-[68px]" : "w-[296px]",
          )}
        >
          <div className="h-full overflow-hidden">
            <NavContent
              companyId={companyId}
              displayName={displayName}
              isCollapsed={isCollapsed}
              navItems={normalizedItems}
              onToggleCollapsed={setIsCollapsed}
              roleName={roleName}
            />
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 bg-[var(--app-background)] md:h-screen md:overflow-y-auto">
          <DashboardHeaderConfigProvider setConfig={setHeaderConfig}>
            <DashboardPageHeader config={resolvedHeaderConfig} title={currentPageLabel} />
            <div className="px-3 pb-4 pt-4 md:p-4">
              <div className="w-full">
                {shouldShowBreadcrumb ? (
                  <div className="mb-3 flex items-center gap-2 md:mb-4">
                    {previousBreadcrumbTarget && previousBreadcrumbHref ? (
                      <Button
                        asChild
                        className="h-9 w-9 rounded-md border border-border/70 bg-card p-0 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <Link
                          aria-label={`Go back to ${previousBreadcrumbTarget.label}`}
                          href={previousBreadcrumbHref}
                        >
                          <ChevronLeft className="size-4" />
                        </Link>
                      </Button>
                    ) : null}

                    <Breadcrumb className="pl-1">
                      <BreadcrumbList>
                        {breadcrumbItems.map((item, index) => (
                          <Fragment key={`${item.label}-${index}`}>
                            <BreadcrumbItem>
                              {item.current ? (
                                <BreadcrumbPage>{item.label}</BreadcrumbPage>
                              ) : item.href ? (
                                <BreadcrumbLink asChild>
                                  <Link href={item.href}>{item.label}</Link>
                                </BreadcrumbLink>
                              ) : (
                                <span>{item.label}</span>
                              )}
                            </BreadcrumbItem>
                            {index < breadcrumbItems.length - 1 ? <BreadcrumbSeparator /> : null}
                          </Fragment>
                        ))}
                      </BreadcrumbList>
                    </Breadcrumb>
                  </div>
                ) : null}
                {children}
              </div>
            </div>
          </DashboardHeaderConfigProvider>
        </main>
      </div>

      <Sheet onOpenChange={setMobileOpen} open={mobileOpen}>
        <SheetContent
          className="w-[88vw] max-w-[320px] border-r border-sidebar-border/80 bg-background p-0 dark:bg-sidebar"
          showCloseButton={false}
          side="left"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Dashboard navigation</SheetDescription>
          </SheetHeader>
          <NavContent
            closeDrawer={() => setMobileOpen(false)}
            companyId={companyId}
            displayName={displayName}
            navItems={normalizedItems}
            roleName={roleName}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
