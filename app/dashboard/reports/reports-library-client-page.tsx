"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BarChart3,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Filter,
  FolderOpenDot,
  MoreHorizontal,
  Plus,
  ReceiptText,
} from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { SegmentedStatusControl } from "@/app/dashboard/_components/segmented-status-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { appendBackNavigationToHref } from "@/app/dashboard/back-navigation";
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

const REPORTS_LIBRARY_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
const headerRowClassName = "border-border/70 bg-card";

function formatGeneratedAt(value: string) {
  return formatStoredDateTimeForManila(value, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function splitReportTitleParts(title: string) {
  const separatorIndex = title.indexOf(" - ");

  if (separatorIndex === -1) {
    return {
      primary: title,
      secondary: null,
    };
  }

  return {
    primary: title.slice(0, separatorIndex),
    secondary: title.slice(separatorIndex + 3),
  };
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

const CONTROL_CLASS_NAME = "!h-11 rounded-md bg-white py-0 text-sm dark:bg-background";

function CategoryTabButton(props: {
  active: boolean;
  category: ReportsLibraryCategoryTab;
  count: number;
  label: string;
  icon?: ReactNode;
  onSelect: (category: ReportsLibraryCategoryTab) => void;
}) {
  return (
    <button
      className={`inline-flex h-11 items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors ${
        props.active
          ? "border-[#e73c31] text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground dark:hover:text-white"
      }`}
      onClick={() => props.onSelect(props.category)}
      type="button"
    >
      <span className={props.active ? "text-[#e73c31]" : undefined}>{props.icon}</span>
      <span>
        {props.label} ({props.count})
      </span>
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
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white">
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
  if (roleName === "Admin") return "whitespace-nowrap rounded-md border border-red-200 bg-red-50 py-1 text-red-700 hover:bg-red-50 hover:text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-300";
  if (roleName === "Auditor") return "whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 py-1 text-blue-700 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/10 dark:hover:text-blue-300";
  if (roleName === "Branch Manager") return "whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 py-1 text-amber-700 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/10 dark:hover:text-amber-300";
  if (roleName === "Secretary") return "whitespace-nowrap rounded-md border border-violet-200 bg-violet-50 py-1 text-violet-700 hover:bg-violet-50 hover:text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/10 dark:hover:text-violet-300";
  if (roleName === "Collector") return "whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 py-1 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300";
  return "whitespace-nowrap rounded-md border border-zinc-200 bg-zinc-50 py-1 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100";
}

function rowActionItemClassName(tone: "default" | "amber" | "green") {
  if (tone === "amber") {
    return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium !text-amber-600 outline-hidden transition-colors hover:bg-amber-50 hover:!text-amber-600 focus:bg-amber-50 focus:!text-amber-600 data-[highlighted]:bg-amber-50 data-[highlighted]:!text-amber-600 dark:!text-amber-400 dark:hover:bg-amber-500/10 dark:hover:!text-amber-400 dark:focus:bg-amber-500/10 dark:focus:!text-amber-400 dark:data-[highlighted]:bg-amber-500/10 dark:data-[highlighted]:!text-amber-400";
  }

  if (tone === "green") {
    return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium !text-emerald-600 outline-hidden transition-colors hover:bg-emerald-50 hover:!text-emerald-600 focus:bg-emerald-50 focus:!text-emerald-600 data-[highlighted]:bg-emerald-50 data-[highlighted]:!text-emerald-600 dark:!text-emerald-400 dark:hover:bg-emerald-500/10 dark:hover:!text-emerald-400 dark:focus:bg-emerald-500/10 dark:focus:!text-emerald-400 dark:data-[highlighted]:bg-emerald-500/10 dark:data-[highlighted]:!text-emerald-400";
  }

  return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-foreground outline-hidden transition-colors hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground data-[highlighted]:bg-accent data-[highlighted]:text-foreground";
}

function GeneratedByCell(props: {
  generatedType: "user" | "system";
  generatedByName: string;
  generatedByCompanyId: string | null;
  generatedByRoleName: string | null;
}) {
  if (props.generatedType === "system") {
    return (
      <Badge className="whitespace-nowrap rounded-md border border-indigo-600 bg-indigo-600 py-1 text-white hover:bg-indigo-600 hover:text-white dark:border-indigo-500/40 dark:bg-indigo-500/20 dark:text-indigo-100 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-100">
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
  const router = useRouter();
  const initialFilters = useMemo(() => pageData.filters, [pageData.filters]);
  const [results, setResults] = useState(pageData);
  const [filters, setFilters] = useState(initialFilters);
  const [isPending, setIsPending] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
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
    setHasMounted(true);
  }, []);

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
  const currentLibraryHref = buildReportsLibraryHref(filters);
  const createHrefBase =
    access.canAccessAnalytics || !access.canAccessOperationalDocuments
      ? "/dashboard/reports/create"
      : "/dashboard/reports/create?tab=documents";
  const createHref = appendBackNavigationToHref(createHrefBase, {
    returnTo: currentLibraryHref,
    source: "reports",
  });
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
    <>
      <DashboardHeaderConfigurator
        config={{
          icon: <ChartColumn className="size-9 text-sidebar-foreground/65" />,
          title: "Reports",
          description:
            "Review saved analytics reports and operational documents available inside your current reporting scope.",
        }}
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            {hasMounted ? (
              <ReportsLibraryFilterSheet
                branchOptions={results.filterOptions.branches}
                filters={filters}
                generatedByRoleOptions={results.filterOptions.generatedByRoles}
                generatedByOptions={results.filterOptions.generatedByUsers}
                onApply={applyFilters}
                templateCategoryOptions={results.filterOptions.templateCategories}
                templateOptions={results.filterOptions.templates}
              />
            ) : (
              <Button className="h-11 rounded-md px-4 text-sm" type="button" variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Advanced Filters
              </Button>
            )}
          </div>

          {canGenerate ? (
            <div className="flex flex-wrap items-center gap-2.5 xl:justify-end">
              <Link href={createHref}>
                <Button className="h-11 rounded-md bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700 hover:text-white dark:bg-green-500/60 dark:text-white dark:hover:bg-green-500/80 dark:hover:text-white">
                  <Plus className="h-4 w-4" />
                  Generate Report
                </Button>
              </Link>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="border-b-2 border-border/80 p">
            <div className="-mb-px flex flex-wrap items-center gap-6">
              <CategoryTabButton
                active={filters.category === "all"}
                category="all"
                count={results.counts.all}
                label="All Reports"
                icon={<ChartColumn className="size-4" />}
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
                label="Analytical"
                icon={<BarChart3 className="size-4" />}
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
                label="Operational"
                icon={<ReceiptText className="size-4" />}
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

          <SegmentedStatusControl
            className = "pt-3"
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

        <div className="space-y-4">
          <div className="relative">
            {results.rows.length === 0 ? (
              <div className="rounded-md border border-border/70 bg-card p-4 shadow-sm">
                <EmptyState
                  canGenerate={canGenerate}
                  createHref={createHref}
                  description={emptyState.description}
                  title={emptyState.title}
                />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border/70 bg-card shadow-sm">
                <Table className="min-w-[1080px] text-sm">
                  <TableHeader>
                    <TableRow className={headerRowClassName}>
                      <TableHead className="h-auto py-3 pl-5 font-medium">Title</TableHead>
                      <TableHead className="h-auto py-3 font-medium">Generated By</TableHead>
                      <TableHead className="h-auto py-3 font-medium">Generated At</TableHead>
                      <TableHead className="h-auto py-3 font-medium">Status</TableHead>
                      <TableHead className="h-auto py-3">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                      {results.rows.map((row) => {
                        const canChangeStatus =
                          row.generatedType === "user" &&
                          (access.roleName === "Admin" || row.generatedByUserId === access.userId);
                        const actionTone = row.status === "active" ? "amber" : "green";
                        const actionLabel = row.status === "active" ? "Archive" : "Restore";
                        const viewHref = appendBackNavigationToHref(`/dashboard/reports/${row.reportId}`, {
                          returnTo: currentLibraryHref,
                          source: "reports",
                        });
                        const titleParts = splitReportTitleParts(row.title);

                        return (
                          <TableRow
                            className="cursor-pointer transition-colors hover:bg-accent/35"
                            key={row.reportId}
                            onClick={() => router.push(viewHref)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                router.push(viewHref);
                              }
                            }}
                            tabIndex={0}
                          >
                            <TableCell className="py-3 pl-5 pr-4 align-middle">
                              <p className="font-medium leading-6 text-foreground">
                                <span>{titleParts.primary}</span>
                                {titleParts.secondary ? (
                                  <span className="text-muted-foreground">{" - "}{titleParts.secondary}</span>
                                ) : null}
                              </p>
                            </TableCell>
                            <TableCell className="py-3 align-middle">
                              <GeneratedByCell
                                generatedByCompanyId={row.generatedByCompanyId}
                                generatedByName={row.generatedByName}
                                generatedByRoleName={row.generatedByRoleName}
                                generatedType={row.generatedType}
                              />
                            </TableCell>
                            <TableCell className="py-3 align-middle text-muted-foreground">
                              {formatGeneratedAt(row.generatedAt)}
                            </TableCell>
                            <TableCell className="py-3 align-middle">
                              <Badge
                                className={
                                  row.status === "active"
                                    ? "whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 py-1 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
                                    : "whitespace-nowrap rounded-md border border-zinc-200 bg-zinc-50 py-1 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100"
                                }
                              >
                                {row.status === "active" ? "Active" : "Archived"}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className="py-3"
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                            >
                              {hasMounted ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      className="h-9 w-9 rounded-md border-0 bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground dark:bg-transparent dark:hover:bg-white/[0.08]"
                                      onClick={(event) => event.stopPropagation()}
                                      size="icon"
                                      type="button"
                                      variant="ghost"
                                    >
                                      <MoreHorizontal className="h-4 w-4" />
                                      <span className="sr-only">Open actions for {row.title}</span>
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
                                    <DropdownMenuItem asChild className={rowActionItemClassName("default")}>
                                      <Link href={viewHref}>
                                        View
                                      </Link>
                                    </DropdownMenuItem>
                                    {canChangeStatus ? (
                                      <DropdownMenuItem
                                        className={rowActionItemClassName(actionTone)}
                                        disabled={isPending || statusActionReportId === row.reportId}
                                        onClick={() =>
                                          void updateReportStatus(
                                            row.reportId,
                                            row.status === "active" ? "archived" : "active",
                                          )
                                        }
                                      >
                                        {statusActionReportId === row.reportId
                                          ? row.status === "active"
                                            ? "Archiving..."
                                            : "Restoring..."
                                          : actionLabel}
                                      </DropdownMenuItem>
                                    ) : null}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <Button
                                  className="h-9 w-9 rounded-md border-0 bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground dark:bg-transparent dark:hover:bg-white/[0.08]"
                                  onClick={(event) => event.stopPropagation()}
                                  size="icon"
                                  type="button"
                                  variant="ghost"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Actions unavailable while loading</span>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>
            )}

            {isPending ? (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/65 backdrop-blur-[1px]">
                <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
                  Updating reports...
                </div>
              </div>
            ) : null}
          </div>

          {results.totalCount > 0 || errorMessage ? (
            <div className="px-1">
              <div className="flex flex-col gap-3 text-sm xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-1">
                  <p className="text-muted-foreground">
                    Showing {showingFrom}-{showingTo} of {results.totalCount}
                  </p>
                  {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}
                </div>
                {results.totalCount > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 xl:justify-center">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Rows</span>
                      {hasMounted ? (
                        <Select
                          onValueChange={(value) =>
                            applyFilters({
                              ...filtersRef.current,
                              pageSize: Number(value),
                              page: 1,
                            })
                          }
                          value={String(results.pageSize)}
                        >
                          <SelectTrigger className={`${CONTROL_CLASS_NAME} w-[84px]`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REPORTS_LIBRARY_PAGE_SIZE_OPTIONS.map((option) => (
                              <SelectItem key={option} value={String(option)}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Button className={`${CONTROL_CLASS_NAME} w-[84px] justify-between px-3`} type="button" variant="outline">
                          {results.pageSize}
                        </Button>
                      )}
                    </div>

                    <div className="ml-4 flex items-center gap-2">
                      <span className="text-muted-foreground">
                        Page {safePage} of {totalPages}
                      </span>
                      <Button
                        disabled={isPending || safePage <= 1}
                        onClick={() => handlePageChange(safePage - 1)}
                        size="icon"
                        type="button"
                        variant="outline"
                      >
                        <ChevronLeft />
                        <span className="sr-only">Previous page</span>
                      </Button>
                      <Button
                        disabled={isPending || safePage >= totalPages}
                        onClick={() => handlePageChange(safePage + 1)}
                        size="icon"
                        type="button"
                        variant="outline"
                      >
                        <ChevronRight />
                        <span className="sr-only">Next page</span>
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
