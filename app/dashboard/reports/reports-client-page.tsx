"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, FileStack, Lock, ReceiptText } from "lucide-react";
import { appendBackNavigationToHref } from "@/app/dashboard/back-navigation";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { AnalyticsReportGenerationForm } from "@/app/dashboard/reports/analytics-report-generation-form";
import { buildReportsCreateHref } from "@/app/dashboard/reports/filters";
import type {
  ReportsCreateTab,
  ReportsPageAccessState,
  ReportsPageData,
} from "@/app/dashboard/reports/types";

function OperationalEntryCard(props: { title: string; description: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-background px-4 py-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{props.title}</p>
        <p className="text-sm text-muted-foreground">{props.description}</p>
      </div>
    </div>
  );
}

function LockedCategoryState(props: { title: string; description: string; icon?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border/80 bg-muted/15 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-full border border-border/80 bg-background p-2 text-muted-foreground">
          {props.icon ?? <Lock className="h-4 w-4" />}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{props.title}</p>
          <p className="text-sm text-muted-foreground">{props.description}</p>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  label,
  icon,
}: {
  active: boolean;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-11 items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors ${
        active ? "border-[#e73c31] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon ? <span className={active ? "text-[#e73c31]" : undefined}>{icon}</span> : null}
      {label}
    </span>
  );
}

export function ReportsCreateClientPage({
  access,
  activeTab,
  backHref,
  pageData,
}: {
  access: Extract<ReportsPageAccessState, { view: "ready" }>;
  activeTab: ReportsCreateTab;
  backHref: string;
  pageData: ReportsPageData;
}) {
  return (
    <>
      <DashboardHeaderConfigurator
        config={{
          action: null,
          description: "Generate and save a new report or document inside your current reporting scope.",
          icon: <FileStack className="size-9 text-sidebar-foreground/65" />,
          title: "Generate Report",
        }}
      />

      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="border-b-2 border-border/80">
          <div className="-mb-px flex flex-wrap items-center gap-6">
            <Link href={appendBackNavigationToHref(buildReportsCreateHref("analytics"), { source: "reports", returnTo: backHref })}>
              <TabButton active={activeTab === "analytics"} icon={<BarChart3 className="size-4" />} label="Analytical" />
            </Link>
            <Link href={appendBackNavigationToHref(buildReportsCreateHref("documents"), { source: "reports", returnTo: backHref })}>
              <TabButton active={activeTab === "documents"} icon={<ReceiptText className="size-4" />} label="Operational" />
            </Link>
          </div>
        </div>

        {activeTab === "analytics" ? (
          access.canAccessAnalytics ? (
            <AnalyticsReportGenerationForm
              access={access}
              analyticsTemplates={pageData.analyticsTemplates}
              analyticsTemplateCategories={pageData.analyticsTemplateCategories}
              branchOptions={pageData.branchOptions}
              collectorOptions={pageData.collectorOptions}
            />
          ) : (
            <LockedCategoryState
              description="Your current role is limited to operational document workflows. Broad analytical reporting is not enabled here."
              icon={<BarChart3 className="h-4 w-4" />}
              title="Analytical reports are not available for this role"
            />
          )
        ) : (
          access.canAccessOperationalDocuments ? (
            <div className="space-y-4 rounded-md border border-border/70 bg-card px-4 py-4 shadow-sm md:px-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ReceiptText className="size-5 text-muted-foreground" />
                  <h2 className="text-base font-semibold tracking-tight text-foreground md:text-[1.05rem]">
                    Operational Document Entry Points
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Operational documents continue to be generated from their related record pages. Open a loan detail page to generate Borrower Loan Schedule and Loan Receipt Summary, or use collection history rows to generate Collection Receipt.
                </p>
              </div>

              <div className="border-t border-border/70" />

              <div className="grid gap-3 md:grid-cols-3">
                <OperationalEntryCard
                  description="Loan-scoped schedule summary document generated from a saved loan record."
                  title="Borrower Loan Schedule"
                />
                <OperationalEntryCard
                  description="Single collection receipt generated from a saved collection entry."
                  title="Collection Receipt"
                />
                <OperationalEntryCard
                  description="Whole-loan payment summary document with saved collection history context."
                  title="Loan Receipt Summary"
                />
              </div>
            </div>
          ) : (
            <LockedCategoryState
              description="Operational document generation is not available for your current role in this module."
              icon={<ReceiptText className="h-4 w-4" />}
              title="Operational documents are not available for your current role"
            />
          )
        )}
      </div>
    </>
  );
}
