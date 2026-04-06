"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ThemeToggle } from "@/app/dashboard/_components/theme-toggle";
import { Button } from "@/components/ui/button";

type DashboardPageHeaderProps = {
  title: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
};

export function DashboardPageHeader({
  title,
  isCollapsed,
  onToggleCollapse,
}: DashboardPageHeaderProps) {
  return (
    <div className="flex h-14 items-stretch border-b bg-card md:h-[var(--dashboard-desktop-header-height)]">
      <div className="hidden h-full w-14 items-center justify-center border-r md:flex">
        <Button
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapse}
          size="icon"
          type="button"
          variant="ghost"
        >
          {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex min-w-0 items-center px-3 md:px-4">
        <h1 className="text-2xl font-semibold">{title}</h1>
      </div>
      <div className="ml-auto flex items-center px-3 md:px-4">
        <ThemeToggle />
      </div>
    </div>
  );
}
