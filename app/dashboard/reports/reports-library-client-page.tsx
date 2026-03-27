"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileStack, FolderOpenDot } from "lucide-react";
import { SegmentedStatusControl } from "@/app/dashboard/_components/segmented-status-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatStoredDateTimeForManila } from "@/app/dashboard/datetime";
import { getReportsDatePresetLabel } from "@/app/dashboard/reports/date-range-presets";
import {
  buildReportsLibraryHref,
  createDefaultReportsLibraryFilters,
} from "@/app/dashboard/reports/filters";
import { ReportsLibraryFilterSheet } from "@/app/dashboard/reports/reports-library-filter-sheet";
import type {
  ReportsLibraryCategoryTab,
  ReportsLibraryFilterState,
  ReportsLibraryPageData,
  ReportsPageAccessState,
  ReportsTemplateCategoryKey,
} from "@/app/dashboard/reports/types";

function formatGeneratedAt(value: string) {
  return formatStoredDateTimeForManila(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildReportsLibraryDataUrl(filters: ReportsLibraryFilterState) {
  const href = buildReportsLibraryHref(filters);
  return href.replace("/dashboard/reports", "/dashboard/reports/data");
}

function buildReportStatusUrl(reportId: number) {
  return `/dashboard/reports/${reportId}/status`;
}

function templateCategoryMatchesLibraryTab(
  libraryCategory: ReportsLibraryCategoryTab,
  templateCategory: ReportsTemplateCategoryKey | null,
) {
  if (!templateCategory || libraryCategory === "all") {
    return true;
  }

  if (libraryCategory === "documents") {
    return templateCategory === "documents";
  }

  return templateCategory !== "documents";
}

function templateKeyMatchesLibraryTab(
  libraryCategory: ReportsLibraryCategoryTab,
  templateCategory: ReportsTemplateCategoryKey | null,
) {
  return templateCategoryMatchesLibraryTab(libraryCategory, templateCategory);
}

function CategoryTabButton(props: {
  active: boolean;
  category: ReportsLibraryCategoryTab;
  count: number;
  label: string;
  onSelect: (category: ReportsLibraryCategoryTab) => void;
}) {
  return (
    <button
      className={`inline-flex rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        props.active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
      onClick={() => props.onSelect(props.category)}
      type="button"
    >
      {props.label} ({props.count})
    </button>
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

function resolveEmptyState(filters: ReportsLibraryFilterState, counts: ReportsLibraryPageData["counts"]) {
  if (counts.all === 0) {
    return {
      title: "No saved reports are visible in your current scope yet.",
      description:
        "Generated analytics reports and operational documents will appear here once they have been saved inside your allowed branch scope.",
    };
  }

  if (filters.status === "archived") {
    return {
      title: "No archived reports matched the current filters.",
      description:
        "Restore an archived report to move it back into the active library, or adjust the current filters to see other archived entries.",
    };
  }

  if (filters.category === "analytics") {
    return {
      title: "No analytics reports matched the current filters.",
      description:
        "Try switching to All Reports or generate a new analytical report from the dedicated creation page.",
    };
  }

  if (filters.category === "documents") {
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

function ActiveFilterChip(props: { label: string; onRemove: () => void }) {
  return (
    <button onClick={props.onRemove} type="button">
      <Badge className="rounded-full border border-border/70 bg-background px-3 py-1 text-foreground hover:bg-muted/40">
        {props.label} x
      </Badge>
    </button>
  );
}

function roleBadgeClass(roleName: string | null) {
  if (roleName === "Admin") return "border-red-200 bg-red-50 text-red-700";
  if (roleName === "Auditor") return "border-blue-200 bg-blue-50 text-blue-700";
  if (roleName === "Branch Manager") return "border-amber-200 bg-amber-50 text-amber-700";
  if (roleName === "Secretary") return "border-violet-200 bg-violet-50 text-violet-700";
  if (roleName === "Collector") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

function GeneratedByCell(props: {
  generatedType: "user" | "system";
  generatedByName: string;
  generatedByCompanyId: string | null;
  generatedByRoleName: string | null;
}) {
  if (props.generatedType === "system") {
    return (
      <Badge className="border-indigo-600 bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-600">
        System-generated
      </Badge>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.generatedByRoleName ? (
        <Badge className={roleBadgeClass(props.generatedByRoleName)} variant="outline">
          {props.generatedByRoleName}
        </Badge>
      ) : null}
      <p className="font-medium text-foreground">
        {props.generatedByName} ({props.generatedByCompanyId?.trim() || "N/A"})
      </p>
    </div>
  );
}

function buildActiveFilterChipData(
  filters: ReportsLibraryFilterState,
  pageData: ReportsLibraryPageData,
) {
  const defaultFilters = createDefaultReportsLibraryFilters();
  const templateLabelMap = new Map(
    pageData.filterOptions.templates.map((option) => [option.templateKey, option.label]),
  );
  const generatedByLabelMap = new Map(
    pageData.filterOptions.generatedByUsers.map((option) => [option.userId, option.displayName]),
  );
  const branchLabelMap = new Map(
    pageData.filterOptions.branches.map((option) => [option.branchId, option.branchName]),
  );
  const chips: Array<{ key: string; label: string; nextFilters: ReportsLibraryFilterState }> = [];

  if (filters.templateKey) {
    chips.push({
      key: "template",
      label: `Template: ${templateLabelMap.get(filters.templateKey) ?? filters.templateKey}`,
      nextFilters: {
        ...filters,
        templateKey: null,
      },
    });
  }

  if (filters.templateCategory) {
    const templateCategoryLabelMap = new Map(
      pageData.filterOptions.templateCategories.map((option) => [option.key, option.label]),
    );

    chips.push({
      key: "templateCategory",
      label: `Category: ${
        templateCategoryLabelMap.get(filters.templateCategory) ?? filters.templateCategory
      }`,
      nextFilters: {
        ...filters,
        templateCategory: null,
        templateKey: null,
      },
    });
  }

  if (filters.generatedType !== defaultFilters.generatedType) {
    chips.push({
      key: "generatedType",
      label: `Generated Type: ${filters.generatedType === "user" ? "User" : "System"}`,
      nextFilters: {
        ...filters,
        generatedType: defaultFilters.generatedType,
      },
    });
  }

  if (filters.generatedByRoleName) {
    chips.push({
      key: "generatedByRole",
      label: `Role: ${filters.generatedByRoleName}`,
      nextFilters: {
        ...filters,
        generatedByRoleName: null,
        generatedByUserId: null,
      },
    });
  }

  if (filters.generatedByUserId) {
    chips.push({
      key: "generatedBy",
      label: `Generated By: ${generatedByLabelMap.get(filters.generatedByUserId) ?? "Unknown"}`,
      nextFilters: {
        ...filters,
        generatedByUserId: null,
      },
    });
  }

  for (const branchId of filters.branchIds) {
    chips.push({
      key: `branch-${branchId}`,
      label: `Branch: ${branchLabelMap.get(branchId) ?? `Branch ${branchId}`}`,
      nextFilters: {
        ...filters,
        branchIds: filters.branchIds.filter((value) => value !== branchId),
      },
    });
  }

  if (filters.generatedDatePreset !== "lifetime" && filters.generatedDatePreset !== "custom") {
    chips.push({
      key: "generatedDatePreset",
      label: `Generated Date: ${getReportsDatePresetLabel(filters.generatedDatePreset)}`,
      nextFilters: {
        ...filters,
        generatedDatePreset: "lifetime",
        generatedDateFrom: null,
        generatedDateTo: null,
      },
    });
  } else if (filters.generatedDateFrom) {
    chips.push({
      key: "generatedDateFrom",
      label: `Generated From: ${filters.generatedDateFrom}`,
      nextFilters: {
        ...filters,
        generatedDateFrom: null,
      },
    });
  }

  if (filters.generatedDateTo && filters.generatedDatePreset === "custom") {
    chips.push({
      key: "generatedDateTo",
      label: `Generated To: ${filters.generatedDateTo}`,
      nextFilters: {
        ...filters,
        generatedDateTo: null,
      },
    });
  }

  if (filters.coverageDatePreset !== "lifetime" && filters.coverageDatePreset !== "custom") {
    chips.push({
      key: "coverageDatePreset",
      label: `Coverage Date: ${getReportsDatePresetLabel(filters.coverageDatePreset)}`,
      nextFilters: {
        ...filters,
        coverageDatePreset: "lifetime",
        coverageDateFrom: null,
        coverageDateTo: null,
      },
    });
  } else if (filters.coverageDateFrom) {
    chips.push({
      key: "coverageDateFrom",
      label: `Coverage From: ${filters.coverageDateFrom}`,
      nextFilters: {
        ...filters,
        coverageDateFrom: null,
      },
    });
  }

  if (filters.coverageDateTo && filters.coverageDatePreset === "custom") {
    chips.push({
      key: "coverageDateTo",
      label: `Coverage To: ${filters.coverageDateTo}`,
      nextFilters: {
        ...filters,
        coverageDateTo: null,
      },
    });
  }

  return chips;
}

export function ReportsLibraryClientPage({
  access,
  pageData,
}: {
  access: Extract<ReportsPageAccessState, { view: "ready" }>;
  pageData: ReportsLibraryPageData;
}) {
  const initialFilters = useMemo(() => pageData.filters, [pageData.filters]);
  const [results, setResults] = useState(pageData);
  const [filters, setFilters] = useState(initialFilters);
  const [isPending, setIsPending] = useState(false);
  const [statusActionReportId, setStatusActionReportId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const filtersRef = useRef(initialFilters);

  useEffect(() => {
    setResults(pageData);
    setFilters(initialFilters);
    setErrorMessage(null);
  }, [initialFilters, pageData]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateHistory = useCallback((nextFilters: ReportsLibraryFilterState) => {
    window.history.replaceState(null, "", buildReportsLibraryHref(nextFilters));
  }, []);

  const loadResults = useCallback(async (nextFilters: ReportsLibraryFilterState) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    abortRef.current = controller;
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(buildReportsLibraryDataUrl(nextFilters), {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Unable to update reports.");
      }

      const nextData = (await response.json()) as ReportsLibraryPageData;
      if (requestIdRef.current !== requestId) {
        return;
      }

      setResults(nextData);
      setFilters(nextData.filters);
      updateHistory(nextData.filters);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      if (requestIdRef.current !== requestId) {
        return;
      }

      setErrorMessage("Unable to refresh reports right now.");
    } finally {
      if (abortRef.current === controller && requestIdRef.current === requestId) {
        setIsPending(false);
      }
    }
  }, [updateHistory]);

  const applyFilters = useCallback(
    (nextFilters: ReportsLibraryFilterState, options?: { preservePage?: boolean }) => {
      const resolvedFilters = options?.preservePage ? nextFilters : { ...nextFilters, page: 1 };
      setFilters(resolvedFilters);
      void loadResults(resolvedFilters);
    },
    [loadResults],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      applyFilters(
        {
          ...filtersRef.current,
          page,
        },
        { preservePage: true },
      );
    },
    [applyFilters],
  );

  const updateReportStatus = useCallback(
    async (reportId: number, status: "active" | "archived") => {
      setStatusActionReportId(reportId);
      setErrorMessage(null);

      try {
        const response = await fetch(buildReportStatusUrl(reportId), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({ status }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message || "Unable to update the saved report status.");
        }

        await loadResults(filtersRef.current);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to update the saved report status.",
        );
      } finally {
        setStatusActionReportId(null);
      }
    },
    [loadResults],
  );

  const emptyState = resolveEmptyState(filters, results.counts);
  const canGenerate = access.canAccessAnalytics || access.canAccessOperationalDocuments;
  const createHref =
    access.canAccessAnalytics || !access.canAccessOperationalDocuments
      ? "/dashboard/reports/create"
      : "/dashboard/reports/create?tab=documents";
  const activeFilterChips = buildActiveFilterChipData(filters, results);
  const hasNonDefaultFilters = activeFilterChips.length > 0;
  const clearAllFilters = {
    ...createDefaultReportsLibraryFilters(),
    category: filters.category,
    status: filters.status,
  } satisfies ReportsLibraryFilterState;
  const totalPages = Math.max(Math.ceil(results.totalCount / results.pageSize), 1);
  const safePage = Math.min(Math.max(results.page, 1), totalPages);
  const showingFrom = results.totalCount === 0 ? 0 : (safePage - 1) * results.pageSize + 1;
  const showingTo =
    results.totalCount === 0 ? 0 : Math.min(safePage * results.pageSize, results.totalCount);
  const currentLibraryHref = buildReportsLibraryHref(filters);
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden p-0">
        <div className="bg-linear-to-r from-slate-50 via-white to-emerald-50/60 p-6">
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
          <div className="inline-flex flex-wrap gap-2 rounded-xl border border-border/70 bg-muted/30 p-1">
            <CategoryTabButton
              active={filters.category === "all"}
              category="all"
              count={results.counts.all}
              label="All Reports"
              onSelect={(category) =>
                  applyFilters({
                    ...filtersRef.current,
                    category,
                    templateCategory: filtersRef.current.templateCategory,
                    templateKey: filtersRef.current.templateKey,
                  })
              }
            />
            <CategoryTabButton
              active={filters.category === "analytics"}
              category="analytics"
              count={results.counts.analytics}
              label="Analytics"
              onSelect={(category) =>
                applyFilters({
                    ...filtersRef.current,
                    category,
                    templateCategory: templateCategoryMatchesLibraryTab(
                      category,
                      filtersRef.current.templateCategory,
                    )
                      ? filtersRef.current.templateCategory
                      : null,
                    templateKey: templateKeyMatchesLibraryTab(
                      category,
                      results.filterOptions.templates.find(
                        (option) => option.templateKey === filtersRef.current.templateKey,
                      )?.templateCategory ?? null,
                    )
                      ? filtersRef.current.templateKey
                      : null,
                  })
              }
            />
            <CategoryTabButton
              active={filters.category === "documents"}
              category="documents"
              count={results.counts.documents}
              label="Documents"
              onSelect={(category) =>
                applyFilters({
                    ...filtersRef.current,
                    category,
                    templateCategory: templateCategoryMatchesLibraryTab(
                      category,
                      filtersRef.current.templateCategory,
                    )
                      ? filtersRef.current.templateCategory
                      : null,
                    templateKey: templateKeyMatchesLibraryTab(
                      category,
                      results.filterOptions.templates.find(
                        (option) => option.templateKey === filtersRef.current.templateKey,
                      )?.templateCategory ?? null,
                    )
                      ? filtersRef.current.templateKey
                      : null,
                  })
              }
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/60 bg-background">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-border/70 bg-background text-muted-foreground">
              <FileStack className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <CardTitle>Saved Reports</CardTitle>
              <CardDescription>
                Saved reports and documents stay here first, and each entry opens into a dedicated report view page.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SegmentedStatusControl
              className="mb-2"
              onChange={(status) =>
                applyFilters({
                  ...filtersRef.current,
                  status,
                })
              }
              options={[
                { value: "active", label: `Active (${results.counts.active})`, tone: "active" },
                { value: "archived", label: `Archived (${results.counts.archived})`, tone: "archived" },
              ]}
              selectedValue={filters.status}
            />

            <ReportsLibraryFilterSheet
              branchOptions={results.filterOptions.branches}
              filters={filters}
              generatedByRoleOptions={results.filterOptions.generatedByRoles}
              generatedByOptions={results.filterOptions.generatedByUsers}
              onApply={applyFilters}
              templateCategoryOptions={results.filterOptions.templateCategories}
              templateOptions={results.filterOptions.templates}
            />
          </div>

          {hasNonDefaultFilters ? (
            <div className="flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <ActiveFilterChip
                  key={chip.key}
                  label={chip.label}
                  onRemove={() => applyFilters(chip.nextFilters)}
                />
              ))}
              <Button
                className="h-8 px-3 text-xs"
                onClick={() => applyFilters(clearAllFilters)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Clear all filters
              </Button>
            </div>
          ) : null}

          <div className="relative space-y-3">
            {results.rows.length === 0 ? (
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
                        <th className="px-4 py-3 font-medium">Generated By</th>
                        <th className="px-4 py-3 font-medium">Generated At</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 bg-background">
                      {results.rows.map((row) => {
                        const canChangeStatus =
                          row.generatedType === "user" &&
                          (access.roleName === "Admin" || row.generatedByUserId === access.userId);

                        return (
                          <tr className="align-middle text-sm" key={row.reportId}>
                            <td className="px-4 py-4 align-middle">
                              <div className="space-y-1">
                                <p className="font-medium text-foreground">{row.title}</p>
                                {row.sourceEntityType && row.sourceEntityId ? (
                                  <p className="text-xs text-muted-foreground">
                                    Linked to {row.sourceEntityType} #{row.sourceEntityId}
                                  </p>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-4 align-middle">
                              <GeneratedByCell
                                generatedByCompanyId={row.generatedByCompanyId}
                                generatedByName={row.generatedByName}
                                generatedByRoleName={row.generatedByRoleName}
                                generatedType={row.generatedType}
                              />
                            </td>
                            <td className="px-4 py-4 align-middle text-muted-foreground">
                              {formatGeneratedAt(row.generatedAt)}
                            </td>
                            <td className="px-4 py-4 align-middle">
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
                            <td className="px-4 py-4 align-middle">
                              <div className="flex flex-wrap items-center gap-2">
                                <Link
                                  href={`/dashboard/reports/${row.reportId}?back=${encodeURIComponent(currentLibraryHref)}`}
                                >
                                  <Button size="sm" type="button" variant="outline">
                                    View
                                  </Button>
                                </Link>
                                {canChangeStatus ? (
                                  <Button
                                    className={
                                      row.status === "active"
                                        ? "bg-amber-500 text-white hover:bg-amber-600 hover:text-white"
                                        : undefined
                                    }
                                    disabled={isPending || statusActionReportId === row.reportId}
                                    onClick={() =>
                                      void updateReportStatus(
                                        row.reportId,
                                        row.status === "active" ? "archived" : "active",
                                      )
                                    }
                                    size="sm"
                                    type="button"
                                    variant={row.status === "active" ? "outline" : "default"}
                                  >
                                    {statusActionReportId === row.reportId
                                      ? row.status === "active"
                                        ? "Archiving..."
                                        : "Restoring..."
                                      : row.status === "active"
                                        ? "Archive"
                                        : "Restore"}
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {results.totalCount > 0 ? (
              <div className="flex flex-col gap-3 border-t pt-3 text-sm md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground">
                    Showing {showingFrom}-{showingTo} of {results.totalCount}
                  </p>
                  {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    Page {safePage} of {totalPages}
                  </span>
                  <Button
                    disabled={isPending || safePage <= 1}
                    onClick={() => handlePageChange(safePage - 1)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={isPending || safePage >= totalPages}
                    onClick={() => handlePageChange(safePage + 1)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : errorMessage ? (
              <p className="text-destructive text-sm">{errorMessage}</p>
            ) : null}

            {isPending ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/65 backdrop-blur-[1px]">
                <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
                  Updating reports...
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
