"use client";

import Link from "next/link";
import { FileStack, FolderOpenDot, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildReportsLibraryHref } from "@/app/dashboard/reports/filters";
import type {
  ReportsLibraryCategoryTab,
  ReportsLibraryPageData,
  ReportsLibraryStatusTab,
  ReportsPageAccessState,
} from "@/app/dashboard/reports/types";

function formatGeneratedAt(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
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

function CategoryTabLink(props: {
  active: boolean;
  category: ReportsLibraryCategoryTab;
  count: number;
  status: ReportsLibraryStatusTab;
  label: string;
}) {
  return (
    <Link
      href={buildReportsLibraryHref({
        category: props.category,
        status: props.status,
      })}
    >
      <TabButton active={props.active} label={`${props.label} (${props.count})`} />
    </Link>
  );
}

function StatusTabLink(props: {
  active: boolean;
  category: ReportsLibraryCategoryTab;
  count: number;
  label: string;
  status: ReportsLibraryStatusTab;
}) {
  return (
    <Link
      href={buildReportsLibraryHref({
        category: props.category,
        status: props.status,
      })}
    >
      <TabButton active={props.active} label={`${props.label} (${props.count})`} />
    </Link>
  );
}

function EmptyState(props: {
  title: string;
  description: string;
  canGenerate: boolean;
  createHref: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/15 px-6 py-14 text-center">
      <div className="rounded-2xl border border-border/70 bg-background p-3 text-muted-foreground">
        <FolderOpenDot className="h-6 w-6" />
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-base font-medium text-foreground">{props.title}</p>
        <p className="max-w-xl text-sm text-muted-foreground">{props.description}</p>
      </div>
      {props.canGenerate ? (
        <div className="mt-5">
          <Link href={props.createHref}>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
              + Generate a New Report
            </Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function resolveEmptyState(pageData: ReportsLibraryPageData) {
  if (pageData.counts.all === 0) {
    return {
      title: "No saved reports are visible in your current scope yet.",
      description:
        "Generated analytics reports and operational documents will appear here once they have been saved inside your allowed branch scope.",
    };
  }

  if (pageData.filters.status === "archived") {
    return {
      title: "No archived reports are available yet.",
      description:
        "Archived reports will appear here in a later pass once archive actions are enabled.",
    };
  }

  if (pageData.filters.category === "analytics") {
    return {
      title: "No analytics reports matched the current filters.",
      description:
        "Try switching to All Reports or generate a new analytical report from the dedicated creation page.",
    };
  }

  if (pageData.filters.category === "documents") {
    return {
      title: "No operational documents matched the current filters.",
      description:
        "Operational documents are generated from related loan and collection pages, then saved back into this library.",
    };
  }

  return {
    title: "No reports matched the current filters.",
    description:
      "Try switching categories or statuses to view other saved reports inside your current scope.",
  };
}

export function ReportsLibraryClientPage({
  access,
  pageData,
}: {
  access: Extract<ReportsPageAccessState, { view: "ready" }>;
  pageData: ReportsLibraryPageData;
}) {
  const emptyState = resolveEmptyState(pageData);
  const canGenerate = access.canAccessAnalytics || access.canAccessOperationalDocuments;
  const createHref =
    access.canAccessAnalytics || !access.canAccessOperationalDocuments
      ? "/dashboard/reports/create"
      : "/dashboard/reports/create?tab=documents";

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-r from-slate-50 via-white to-emerald-50/60 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Reports Library</h1>
                <p className="text-sm text-muted-foreground">
                  Saved analytical reports and operational documents available inside your current reporting scope.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <Badge className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800 hover:bg-emerald-50">
                  {access.roleName}
                </Badge>
                <Badge className="rounded-full border border-border/70 bg-background px-3 py-1 text-foreground hover:bg-background">
                  Scope: {access.scopeLabel}
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {canGenerate ? (
                <Link href={createHref}>
                  <Button className="bg-emerald-600 text-white hover:bg-emerald-700">
                    + Generate a New Report
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 p-6">
          <div className="space-y-4">
            <div className="inline-flex flex-wrap gap-2 rounded-xl border border-border/70 bg-muted/30 p-1">
              <CategoryTabLink
                active={pageData.filters.category === "all"}
                category="all"
                count={pageData.counts.all}
                label="All Reports"
                status={pageData.filters.status}
              />
              <CategoryTabLink
                active={pageData.filters.category === "analytics"}
                category="analytics"
                count={pageData.counts.analytics}
                label="Analytics"
                status={pageData.filters.status}
              />
              <CategoryTabLink
                active={pageData.filters.category === "documents"}
                category="documents"
                count={pageData.counts.documents}
                label="Documents"
                status={pageData.filters.status}
              />
            </div>

            <div className="inline-flex flex-wrap gap-2 rounded-xl border border-border/70 bg-muted/20 p-1">
              <StatusTabLink
                active={pageData.filters.status === "active"}
                category={pageData.filters.category}
                count={pageData.counts.active}
                label="Active"
                status="active"
              />
              <StatusTabLink
                active={pageData.filters.status === "archived"}
                category={pageData.filters.category}
                count={pageData.counts.archived}
                label="Archived"
                status="archived"
              />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/60 bg-muted/15">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-border/70 bg-background p-2.5 text-muted-foreground">
              <FileStack className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <CardTitle>Saved Reports</CardTitle>
              <CardDescription>
                Reports open into the library first. Viewing, export, and archive actions are reserved for later passes.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {pageData.rows.length === 0 ? (
            <EmptyState
              canGenerate={canGenerate}
              createHref={createHref}
              description={emptyState.description}
              title={emptyState.title}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border/70">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border/70">
                  <thead className="bg-muted/20">
                    <tr className="text-left text-sm text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Category</th>
                      <th className="px-4 py-3 font-medium">Template</th>
                      <th className="px-4 py-3 font-medium">Generated Type</th>
                      <th className="px-4 py-3 font-medium">Generated At</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 bg-background">
                    {pageData.rows.map((row) => (
                      <tr className="align-top text-sm" key={row.reportId}>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{row.title}</p>
                            {row.sourceEntityType && row.sourceEntityId ? (
                              <p className="text-xs text-muted-foreground">
                                Linked to {row.sourceEntityType} #{row.sourceEntityId}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {row.reportCategory === "analytics" ? "Analytics" : "Document"}
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <p className="text-foreground">{row.templateLabel}</p>
                            <p className="text-xs text-muted-foreground">{row.templateKey}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/20 px-2.5 py-1 text-xs font-medium">
                            <ScrollText className="h-3.5 w-3.5" />
                            {row.generatedType === "user" ? "User" : "System"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {formatGeneratedAt(row.generatedAt)}
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            className={
                              row.status === "active"
                                ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800 hover:bg-emerald-50"
                                : "rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-zinc-700 hover:bg-zinc-50"
                            }
                          >
                            {row.status === "active" ? "Active" : "Archived"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
