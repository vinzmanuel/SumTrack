"use client";

import { ThemeToggle } from "@/app/dashboard/_components/theme-toggle";

type DashboardPageHeaderProps = {
  title: string;
};

export function DashboardPageHeader({ title }: DashboardPageHeaderProps) {
  return (
    <div className="flex h-14 items-stretch border-b bg-card md:h-[var(--dashboard-desktop-header-height)]">
      <div className="flex min-w-0 items-center px-3 md:px-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
      </div>
      <div className="ml-auto flex items-center px-3 md:px-4">
        <ThemeToggle />
      </div>
    </div>
  );
}
