"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

export function BranchDetailClientPage({
  backHref,
  backLabel,
  data,
  areasData,
  employeesData,
  initialTab,
  permissions,
}: {
  backHref: string;
  backLabel: string;
  data: BranchDetailOverviewData;
  areasData: BranchAreasTabData;
  employeesData: BranchEmployeesTabData;
  initialTab: BranchDetailTabKey;
  permissions: BranchActionPermissions;
}) {
  const [activeTab, setActiveTab] = useState<BranchDetailTabKey>(initialTab);
  const statusBadgeClass =
    data.status === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/70 py-0 shadow-sm">
        <CardContent className="p-0">
          <div className="rounded-t-[inherit] bg-gradient-to-r from-slate-50 via-white to-emerald-50/60 p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">{data.branchName}</h1>
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{data.municipalityName}, {data.provinceName}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-medium">
                  <Badge className="border-zinc-300 bg-background text-zinc-700" variant="outline">
                    Branch Code: {data.branchCode}
                  </Badge>
                  <Badge className={statusBadgeClass} variant="outline">
                    Status: {data.statusLabel}
                  </Badge>
                </div>
              </div>

              <div className="flex justify-end">
                <Link href={backHref}>
                  <Button size="sm" type="button" variant="outline">
                    {backLabel}
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-border/70 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="inline-flex flex-wrap gap-2 rounded-xl border border-border/70 bg-muted/30 p-1">
                <TabButton
                  active={activeTab === "overview"}
                  label="Overview"
                  onClick={() => {
                    setActiveTab("overview");
                    replacePageUrl({ tab: "overview" });
                  }}
                />
                <TabButton
                  active={activeTab === "employees"}
                  label="Employees"
                  onClick={() => {
                    setActiveTab("employees");
                    replacePageUrl({ tab: "employees" });
                  }}
                />
                <TabButton
                  active={activeTab === "areas"}
                  label="Areas"
                  onClick={() => {
                    setActiveTab("areas");
                    replacePageUrl({ tab: "areas" });
                  }}
                />
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
          </div>
        </CardContent>
      </Card>

      {activeTab === "overview" ? (
        <BranchOverviewTab data={data} />
      ) : activeTab === "employees" ? (
        <BranchEmployeesTab
          canManageEmployees={permissions.canManageEmployees}
          data={employeesData}
        />
      ) : (
        <BranchAreasTab
          branchCode={data.branchCode}
          canManageAreas={permissions.canManageAreas}
          data={areasData}
        />
      )}
    </div>
  );
}
