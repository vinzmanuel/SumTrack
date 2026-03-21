"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, BarChart3, FileText, FolderKanban, Lock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalyticsReportGenerationForm } from "@/app/dashboard/reports/analytics-report-generation-form";
import { buildReportsCreateHref } from "@/app/dashboard/reports/filters";
import type {
  ReportsCreateTab,
  ReportsPageAccessState,
  ReportsPageCategoryItem,
  ReportsPageData,
} from "@/app/dashboard/reports/types";

const ANALYTICAL_REPORT_ITEMS: ReportsPageCategoryItem[] = [
  {
    key: "monthly-collections-summary",
    title: "Monthly Collections Summary",
    blurb: "Branch-scoped collection totals, trends, and missed-payment signals.",
  },
  {
    key: "active-loans-summary",
    title: "Active Loans Summary",
    blurb: "Live loan exposure, active/overdue counts, and operational loan totals.",
  },
  {
    key: "branch-performance-comparison",
    title: "Branch Performance Comparison",
    blurb: "Cross-branch comparison for collections, borrowers, and loan activity.",
  },
  {
    key: "monthly-financial-overview",
    title: "Monthly Financial Overview",
    blurb: "Collections, expenses, and monthly operating totals inside the current scope.",
  },
];

const OPERATIONAL_DOCUMENT_ITEMS: ReportsPageCategoryItem[] = [
  {
    key: "borrower-loan-schedule",
    title: "Borrower Loan Schedule",
    blurb: "Loan-scoped schedule summary document prepared from the current loan record.",
  },
  {
    key: "collection-receipt",
    title: "Collection Receipt",
    blurb: "Single collection receipt generated from a saved collection record.",
  },
  {
    key: "loan-receipt-summary",
    title: "Loan Receipt Summary",
    blurb: "Whole-loan payment summary document with saved collection history context.",
  },
];

function CategoryPreviewCard(props: ReportsPageCategoryItem) {
  return (
    <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{props.title}</p>
        <p className="text-sm text-muted-foreground">{props.blurb}</p>
      </div>
    </div>
  );
}

function LockedCategoryState(props: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-full border border-border/80 bg-background p-2 text-muted-foreground">
          <Lock className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{props.title}</p>
          <p className="text-sm text-muted-foreground">{props.description}</p>
        </div>
      </div>
    </div>
  );
}

function CategorySection(props: {
  title: string;
  description: string;
  icon: "analytics" | "documents";
  items: ReportsPageCategoryItem[];
  accessible: boolean;
  lockedTitle: string;
  lockedDescription: string;
  generationSlot?: ReactNode;
}) {
  const Icon = props.icon === "analytics" ? BarChart3 : FileText;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-muted/15">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-border/70 bg-background p-2.5 text-muted-foreground">
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <CardTitle>{props.title}</CardTitle>
            <CardDescription>{props.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {props.accessible ? (
          <>
            {props.generationSlot}
            <div className="grid gap-4 md:grid-cols-2">
              {props.items.map((item) => (
                <CategoryPreviewCard {...item} key={item.key} />
              ))}
            </div>
            <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Saved reports return to the Reports Library after generation, and each saved entry can now be opened on its own dedicated report page.
              </p>
            </div>
          </>
        ) : (
          <LockedCategoryState
            description={props.lockedDescription}
            title={props.lockedTitle}
          />
        )}
      </CardContent>
    </Card>
  );
}

function TabButton({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span
      className={`inline-flex rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </span>
  );
}

export function ReportsCreateClientPage({
  access,
  activeTab,
  pageData,
}: {
  access: Extract<ReportsPageAccessState, { view: "ready" }>;
  activeTab: ReportsCreateTab;
  pageData: ReportsPageData;
}) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-r from-slate-50 via-white to-emerald-50/60 px-6 py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <Link href="/dashboard/reports">
                <Button className="gap-2 px-0 text-muted-foreground hover:text-foreground" variant="ghost">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Reports Library
                </Button>
              </Link>

              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Create Report</h1>
                <p className="text-sm text-muted-foreground">
                  Generate and save a new report or document inside your current reporting scope.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <Badge className="gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800 hover:bg-emerald-50">
                  <Sparkles className="h-3.5 w-3.5" />
                  {access.roleName}
                </Badge>
                <Badge className="rounded-full border border-border/70 bg-background px-3 py-1 text-foreground hover:bg-background">
                  Scope: {access.scopeLabel}
                </Badge>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-muted p-2 text-muted-foreground">
                  <FolderKanban className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">PASS 4</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    {access.scopeDetail}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 p-6">
          <div className="inline-flex flex-wrap gap-2 rounded-xl border border-border/70 bg-muted/30 p-1">
            <Link href={buildReportsCreateHref("analytics")}>
              <TabButton active={activeTab === "analytics"} label="Analytical Reports" />
            </Link>
            <Link href={buildReportsCreateHref("documents")}>
              <TabButton active={activeTab === "documents"} label="Operational Documents" />
            </Link>
          </div>
        </div>
      </Card>

      {activeTab === "analytics" ? (
        <CategorySection
          accessible={access.canAccessAnalytics}
          description="Management-facing reporting space for aggregated branch and financial summaries."
          icon="analytics"
          items={ANALYTICAL_REPORT_ITEMS}
          lockedDescription="Your current role is limited to operational document workflows. Broad analytical reporting is not enabled here."
          lockedTitle="Analytical reports are not available for this role"
          generationSlot={
            <AnalyticsReportGenerationForm
              access={access}
              analyticsTemplates={pageData.analyticsTemplates}
              branchOptions={pageData.branchOptions}
            />
          }
          title="Analytical Reports"
        />
      ) : (
        <CategorySection
          accessible={access.canAccessOperationalDocuments}
          description="Record-specific reporting lane for printable operational documents tied to loans and collections."
          generationSlot={
            <Card className="border-border/70 bg-background">
              <CardHeader>
                <CardTitle className="text-xl">Operational Document Entry Points</CardTitle>
                <CardDescription>
                  Operational documents continue to be generated from their related record pages. Open a loan detail page to generate Borrower Loan Schedule and Loan Receipt Summary, or use collection history rows to generate Collection Receipt.
                </CardDescription>
              </CardHeader>
            </Card>
          }
          icon="documents"
          items={OPERATIONAL_DOCUMENT_ITEMS}
          lockedDescription="Operational document generation is not available for your current role in this module."
          lockedTitle="Operational documents are not available for your current role"
          title="Operational Documents"
        />
      )}
    </div>
  );
}
