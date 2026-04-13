"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Building2, BriefcaseBusiness, LayoutGrid, MapPin } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import {
  UI_TAB_ICON_ACTIVE_CLASS_NAME,
  UI_TAB_LIST_CLASS_NAME,
  UI_TAB_SEPARATOR_CLASS_NAME,
  getUiTabTriggerClassName,
} from "@/app/dashboard/_components/ui-patterns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BranchDeleteButton } from "@/app/dashboard/branches/branch-delete-button";
import { BranchEditDialog } from "@/app/dashboard/branches/branch-edit-dialog";
import { BranchAreasTab } from "@/app/dashboard/branches/branch-areas-tab";
import { BranchEmployeesTab } from "@/app/dashboard/branches/branch-employees-tab";
import { BranchOverviewTab } from "@/app/dashboard/branches/branch-overview-tab";
import { BranchStatusButton } from "@/app/dashboard/branches/branch-status-button";
import type {
  BranchActionPermissions,
  BranchAreasTabData,
  BranchDetailOverviewData,
  BranchDetailTabKey,
  BranchEmployeesTabData,
} from "@/app/dashboard/branches/types";

function replacePageUrl(next: { tab: BranchDetailTabKey }) {
  const url = new URL(window.location.href);

  if (next.tab === "overview") {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", next.tab);
  }

  const query = url.searchParams.toString();
  window.history.replaceState(null, "", query ? `${url.pathname}?${query}` : url.pathname);
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={getUiTabTriggerClassName(active)}
      onClick={onClick}
      type="button"
    >
      <span className={active ? UI_TAB_ICON_ACTIVE_CLASS_NAME : undefined}>{icon}</span>
      {label}
    </button>
  );
}

export function BranchDetailClientPage({
  data,
  areasData,
  employeesData,
  initialTab,
  permissions,
}: {
  data: BranchDetailOverviewData;
  areasData: BranchAreasTabData;
  employeesData: BranchEmployeesTabData;
  initialTab: BranchDetailTabKey;
  permissions: BranchActionPermissions;
}) {
  const [activeTab, setActiveTab] = useState<BranchDetailTabKey>(initialTab);
  const statusBadgeClass =
    data.status === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
      : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="space-y-4">
      <DashboardHeaderConfigurator
        config={{
          breadcrumbTitle: data.branchName,
          description: "Review branch profile, staffing roster, and area coverage inside your allowed scope.",
          icon: <Building2 className="size-9 text-sidebar-foreground/65" />,
          title: "Branch Details",
        }}
      />

      <Card className="overflow-hidden rounded-md border-border/70 py-0 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">{data.branchName}</h1>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {data.municipalityName}, {data.provinceName}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <Badge
                  className="rounded-md border-zinc-200 bg-zinc-50 py-1 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100"
                  variant="outline"
                >
                  Branch Code: {data.branchCode}
                </Badge>
                <Badge className={`${statusBadgeClass} rounded-md py-1`} variant="outline">
                  Status: {data.statusLabel}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {permissions.canEditDetails ? (
                <BranchEditDialog
                  branchAddress={data.branchAddress}
                  branchCode={data.branchCode}
                  branchName={data.branchName}
                  triggerLabel="Edit"
                />
              ) : null}
              {permissions.canManageLifecycle ? (
                <BranchStatusButton
                  branchCode={data.branchCode}
                  branchName={data.branchName}
                  status={data.status}
                />
              ) : null}
              {permissions.canDelete ? (
                <BranchDeleteButton branchCode={data.branchCode} branchName={data.branchName} />
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className={UI_TAB_SEPARATOR_CLASS_NAME}>
        <div className={UI_TAB_LIST_CLASS_NAME}>
          <TabButton
            active={activeTab === "overview"}
            icon={<LayoutGrid className="h-4 w-4" />}
            label="Overview"
            onClick={() => {
              setActiveTab("overview");
              replacePageUrl({ tab: "overview" });
            }}
          />
          <TabButton
            active={activeTab === "employees"}
            icon={<BriefcaseBusiness className="h-4 w-4" />}
            label="Employees"
            onClick={() => {
              setActiveTab("employees");
              replacePageUrl({ tab: "employees" });
            }}
          />
          <TabButton
            active={activeTab === "areas"}
            icon={<Building2 className="h-4 w-4" />}
            label="Areas"
            onClick={() => {
              setActiveTab("areas");
              replacePageUrl({ tab: "areas" });
            }}
          />
        </div>
      </div>

      {activeTab === "overview" ? (
        <BranchOverviewTab data={data} />
      ) : activeTab === "employees" ? (
        <BranchEmployeesTab
          canManageEmployees={permissions.canManageEmployees}
          data={employeesData}
        />
      ) : (
        <BranchAreasTab
          key={areasData.areas.map((area) => `${area.areaId}:${area.status}:${area.description ?? ""}`).join("|")}
          branchCode={data.branchCode}
          canCreateAreas={permissions.canManageAreas && data.status === "active"}
          canEditAreas={permissions.canManageAreas}
          data={areasData}
          isBranchActive={data.status === "active"}
        />
      )}
    </div>
  );
}
