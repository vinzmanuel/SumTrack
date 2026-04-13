"use client";

import { LayoutDashboard } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";

export function DashboardOverviewHeaderConfig() {
  return (
    <DashboardHeaderConfigurator
      config={{
        icon: <LayoutDashboard className="size-9 text-sidebar-foreground/65" />,
        title: "Overview",
        breadcrumbTitle: "Overview",
        description: "Monitor performance, operational health, and priorities in your current scope.",
      }}
    />
  );
}

