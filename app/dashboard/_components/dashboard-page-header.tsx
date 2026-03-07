"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
    <div className="flex h-14 items-stretch border-b bg-background">
      <div className="hidden h-full w-14 items-center justify-center border-r md:flex">
        <Button
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="h-9 w-9 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:ring-zinc-300"
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
    </div>
  );
}
