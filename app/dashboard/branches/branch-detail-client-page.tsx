"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BranchEmployeesTab } from "@/app/dashboard/branches/branch-employees-tab";
import { BranchOverviewTab } from "@/app/dashboard/branches/branch-overview-tab";
import type {
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

function PlaceholderTab({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="px-5 py-10 text-center">
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
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
  employeesData,
  initialTab,
}: {
  backHref: string;
  backLabel: string;
  data: BranchDetailOverviewData;
  employeesData: BranchEmployeesTabData;
  initialTab: BranchDetailTabKey;
}) {
  const [activeTab, setActiveTab] = useState<BranchDetailTabKey>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-slate-50 via-white to-emerald-50/60 p-6">
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
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800" variant="outline">
                    Status: {data.statusLabel}
                  </Badge>
                  {data.managerName ? (
                    <Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">
                      Manager Assigned
                    </Badge>
                  ) : null}
                  {data.auditorName ? (
                    <Badge className="border-amber-200 bg-amber-50 text-amber-700" variant="outline">
                      Auditor Assigned
                    </Badge>
                  ) : null}
                </div>
              </div>

              <Link href={backHref}>
                <Button size="sm" type="button" variant="outline">
                  {backLabel}
                </Button>
              </Link>
            </div>
          </div>

          <div className="border-t border-border/70 p-6">
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
          </div>
        </CardContent>
      </Card>

      {activeTab === "overview" ? (
        <BranchOverviewTab data={data} />
      ) : activeTab === "employees" ? (
        <BranchEmployeesTab data={employeesData} />
      ) : (
        <PlaceholderTab
          description="Area assignments, area metrics, and area-level controls will be added in a later pass."
          title="Areas Tab Coming Soon"
        />
      )}
    </div>
  );
}
