"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileStack, FolderOpenDot, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildReportsLibraryHref,
  createDefaultReportsLibraryFilters,
} from "@/app/dashboard/reports/filters";
import { ReportsLibraryFilterSheet } from "@/app/dashboard/reports/reports-library-filter-sheet";
import type {
  ReportsLibraryCategoryTab,
  ReportsLibraryFilterState,
  ReportsLibraryPageData,
  ReportsLibraryStatusTab,
  ReportsPageAccessState,
  ReportsTemplateCategoryKey,
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

function buildReportsLibraryDataUrl(filters: ReportsLibraryFilterState) {
  const href = buildReportsLibraryHref(filters);
  return href.replace("/dashboard/reports", "/dashboard/reports/data");
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
      className={`inline-flex rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function CategoryTabButton(props: {
  active: boolean;
  category: ReportsLibraryCategoryTab;
  count: number;
  label: string;
  onSelect: (category: ReportsLibraryCategoryTab) => void;
}) {
  return (
    <TabButton
      active={props.active}
      label={`${props.label} (${props.count})`}
      onClick={() => props.onSelect(props.category)}
    />
  );
}

function StatusTabButton(props: {
  active: boolean;
  count: number;
  label: string;
  status: ReportsLibraryStatusTab;
  onSelect: (status: ReportsLibraryStatusTab) => void;
}) {
  return (
    <TabButton
      active={props.active}
      label={`${props.label} (${props.count})`}
      onClick={() => props.onSelect(props.status)}
    />
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
      title: "No archived reports are available yet.",
      description:
        "Archived reports will appear here in a later pass once archive actions are enabled.",
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

  if (filters.generatedDateFrom) {
    const generatedDateLabelMap = {
      today: "Generated Date: Today",
      this_week: "Generated Date: This Week",
      this_month: "Generated Date: This Month",
      this_year: "Generated Date: This Year",
    } as const;

    if (
      filters.generatedDatePreset !== "all" &&
      filters.generatedDatePreset !== "custom"
    ) {
      chips.push({
        key: "generatedDatePreset",
        label: generatedDateLabelMap[filters.generatedDatePreset],
        nextFilters: {
          ...filters,
          generatedDatePreset: "all",
          generatedDateFrom: null,
          generatedDateTo: null,
        },
      });
    } else {
      chips.push({
        key: "generatedDateFrom",
        label: `Generated From: ${filters.generatedDateFrom}`,
        nextFilters: {
          ...filters,
          generatedDatePreset: filters.generatedDateTo ? "custom" : "all",
          generatedDateFrom: null,
        },
      });
    }
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

  if (filters.coverageDateFrom) {
    chips.push({
      key: "coverageDateFrom",
      label: `Coverage From: ${filters.coverageDateFrom}`,
      nextFilters: {
        ...filters,
        coverageDateFrom: null,
      },
    });
  }

  if (filters.coverageDateTo) {
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
            <div className="inline-flex flex-wrap gap-2 rounded-xl border border-border/70 bg-muted/20 p-1 mb-2">
              <StatusTabButton
                active={filters.status === "active"}
                count={results.counts.active}
                label="Active"
                onSelect={(status) =>
                  applyFilters({
                    ...filtersRef.current,
                    status,
                  })
                }
                status="active"
              />
              <StatusTabButton
                active={filters.status === "archived"}
                count={results.counts.archived}
                label="Archived"
                onSelect={(status) =>
                  applyFilters({
                    ...filtersRef.current,
                    status,
                  })
                }
                status="archived"
              />
            </div>

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
                        <th className="px-4 py-3 font-medium">Category</th>
                        <th className="px-4 py-3 font-medium">Template</th>
                        <th className="px-4 py-3 font-medium">Generated Type</th>
                        <th className="px-4 py-3 font-medium">Generated At</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 bg-background">
                      {results.rows.map((row) => (
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
                          <td className="px-4 py-4">
                            <Link href={`/dashboard/reports/${row.reportId}`}>
                              <Button size="sm" type="button" variant="outline">
                                View
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
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
