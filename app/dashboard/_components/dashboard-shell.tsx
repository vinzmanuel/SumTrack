"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}: {
  roleName: string;
  companyId: string;
  navItems: NavItem[];
  closeDrawer?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-4">
        <p className="text-sm font-semibold">SumTrack</p>
        <p className="text-muted-foreground text-xs">{roleName}</p>
        <p className="text-muted-foreground text-xs">ID: {companyId}</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-3">
        {navItems.map((item) => {
          const active = isActiveNav(pathname, item.href);
          return (
            <Button
              asChild
              className="w-full justify-start active:scale-[0.98]"
              key={item.href}
              onClick={closeDrawer}
              variant={active ? "default" : "ghost"}
            >
              <Link href={item.href}>
                {item.label}
              </Link>
            </Button>
          );
        })}
      </nav>

      <div className="border-t px-3 py-3">
        <form action="/auth/signout" method="post">
          <Button className="w-full active:scale-[0.98]" type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}

export function DashboardShell({ roleName, companyId, navItems, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const normalizedItems = useMemo(
    () => Array.from(new Map(navItems.map((item) => [item.href, item])).values()),
    [navItems],
  );

  return (
    <div className="min-h-screen bg-background md:h-screen md:overflow-hidden">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <p className="text-sm font-semibold">SumTrack</p>
        <Button onClick={() => setMobileOpen(true)} size="icon" type="button" variant="outline">
          <Menu className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex w-full md:h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-background md:block">
          <div className="h-full overflow-y-auto">
            <NavContent companyId={companyId} navItems={normalizedItems} roleName={roleName} />
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-3 py-4 md:h-screen md:overflow-y-auto md:px-6 md:py-6">
          {children}
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
            navItems={normalizedItems}
            roleName={roleName}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
