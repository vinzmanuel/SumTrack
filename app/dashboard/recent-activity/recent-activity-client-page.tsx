"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import type {
  RecentActivityActorOption,
  RecentActivityFilters,
  RecentActivityItem,
  RecentActivityPageData,
  RecentActivityPreset,
  RecentActivityTypeFilter,
} from "@/app/dashboard/recent-activity/types";
import {
  RECENT_ACTIVITY_PRESET_OPTIONS,
  RECENT_ACTIVITY_TYPE_OPTIONS,
} from "@/app/dashboard/recent-activity/types";

type RecentActivityClientFilters = Omit<RecentActivityFilters, "page">;

type ActorComboboxOption = {
  userId: string;
  displayName: string;
  roleName: string | null;
};

const rolePriority = ["Admin", "Auditor", "Branch Manager", "Secretary", "Collector", "Borrower"];
const FILTER_GRID_CLASS =
  "grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.88fr)]";
const DESKTOP_LOG_GRID_CLASS =
  "grid-cols-[minmax(0,190px)_minmax(0,1.85fr)_minmax(220px,1.2fr)_minmax(140px,0.95fr)_24px]";
const EXPANDED_DETAIL_GRID_CLASS = "grid-cols-1 md:grid-cols-[160px_minmax(0,1fr)]";

const timestampFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function buildPageUrl(filters: RecentActivityClientFilters) {
  const params = new URLSearchParams();
  params.set("preset", filters.preset);

  if (filters.preset === "custom") {
    if (filters.fromDate) {
      params.set("from", filters.fromDate);
    }
    if (filters.toDate) {
      params.set("to", filters.toDate);
    }
  }

  if (filters.activityType !== "all") {
    params.set("activity", filters.activityType);
  }

  if (filters.actorRoleName) {
    params.set("actorRole", filters.actorRoleName);
  }

  if (filters.actorUserId) {
    params.set("actor", filters.actorUserId);
  }

  if (filters.branchId) {
    params.set("branch", String(filters.branchId));
  }

  const queryString = params.toString();
  return queryString ? `/dashboard/recent-activity?${queryString}` : "/dashboard/recent-activity";
}

function buildDataUrl(filters: RecentActivityClientFilters, page: number) {
  const params = new URLSearchParams();
  params.set("preset", filters.preset);

  if (filters.preset === "custom") {
    if (filters.fromDate) {
      params.set("from", filters.fromDate);
    }
    if (filters.toDate) {
      params.set("to", filters.toDate);
    }
  }

  if (filters.activityType !== "all") {
    params.set("activity", filters.activityType);
  }

  if (filters.actorRoleName) {
    params.set("actorRole", filters.actorRoleName);
  }

  if (filters.actorUserId) {
    params.set("actor", filters.actorUserId);
  }

  if (filters.branchId) {
    params.set("branch", String(filters.branchId));
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  return `/dashboard/recent-activity/data?${params.toString()}`;
}

function sameFilters(left: RecentActivityClientFilters, right: RecentActivityClientFilters) {
  return (
    left.preset === right.preset &&
    left.fromDate === right.fromDate &&
    left.toDate === right.toDate &&
    left.activityType === right.activityType &&
    left.actorRoleName === right.actorRoleName &&
    left.actorUserId === right.actorUserId &&
    left.branchId === right.branchId
  );
}

function buildActivitySummary(item: RecentActivityItem) {
  if (item.activityType === "account_created") {
    return `Created ${item.subjectPrimary} account`;
  }
  if (item.activityType === "borrower_created") {
    return `Created borrower ${item.subjectPrimary}`;
  }
  if (item.activityType === "loan_created") {
    return `Created loan ${item.subjectPrimary}`;
  }
  if (item.activityType === "collection_recorded") {
    return `Recorded collection ${item.subjectPrimary}`;
  }
  if (item.activityType === "missed_payment_recorded") {
    return `Recorded missed payment ${item.subjectPrimary}`;
  }
  if (item.activityType === "expense_recorded") {
    return `Recorded ${item.subjectPrimary}`;
  }
  if (item.activityType === "incentive_rule_created") {
    return `Created ${item.subjectPrimary}`;
  }
  if (item.activityType === "report_generated") {
    return `Generated ${item.subjectPrimary}`;
  }
  if (item.activityType === "loan_document_uploaded") {
    return `Uploaded ${item.subjectPrimary}`;
  }
  return `Uploaded ${item.subjectPrimary}`;
}

// Legacy helper kept only to avoid noisy merge churn while recent-activity formatting settles.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildActionLine(item: RecentActivityItem) {
  const summary = buildActivitySummary(item);
  if (
    item.activityType === "account_created" ||
    item.activityType === "borrower_created"
  ) {
    return summary;
  }
  return item.contextLabel ? `${summary} • ${item.contextLabel}` : summary;
}

function buildLogActionLine(item: RecentActivityItem) {
  const summary = buildActivitySummary(item);
  if (
    item.activityType === "account_created" ||
    item.activityType === "borrower_created"
  ) {
    return summary;
  }
  return item.contextLabel ? `${summary} - ${item.contextLabel}` : summary;
}

function activityBadgeClass(activityType: RecentActivityItem["activityType"]) {
  if (activityType === "missed_payment_recorded") {
    return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
  }
  if (activityType === "collection_recorded" || activityType === "expense_recorded") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
  }
  if (activityType === "report_generated") {
    return "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300";
  }
  if (activityType === "loan_document_uploaded" || activityType === "borrower_document_uploaded") {
    return "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300";
  }
  return "border-zinc-200 bg-zinc-100 text-zinc-800 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100";
}

function roleBadgeClass(roleName: string | null) {
  if (roleName === "System") return "whitespace-nowrap border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500/40 dark:bg-indigo-500/20 dark:text-indigo-100";
  if (roleName === "Admin") return "whitespace-nowrap border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300";
  if (roleName === "Auditor") return "whitespace-nowrap border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300";
  if (roleName === "Branch Manager") return "whitespace-nowrap border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
  if (roleName === "Secretary") return "whitespace-nowrap border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300";
  if (roleName === "Collector") return "whitespace-nowrap border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (roleName === "Borrower") return "whitespace-nowrap border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100";
  return "whitespace-nowrap border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100";
}

function buildRoleOptions(actorOptions: RecentActivityActorOption[]) {
  const seen = new Set<string>();
  const options: string[] = [];

  for (const option of actorOptions) {
    if (!option.roleName || seen.has(option.roleName)) {
      continue;
    }

    seen.add(option.roleName);
    options.push(option.roleName);
  }

  return options.sort((left, right) => {
    const leftIndex = rolePriority.indexOf(left);
    const rightIndex = rolePriority.indexOf(right);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

function FilterLabel(props: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-foreground">{props.children}</span>;
}

function trimReportTitle(title: string) {
  const [primary, ...rest] = title.split(" - ");
  return {
    primary: primary || title,
    remainder: rest.join(" - "),
  };
}

function splitDetailContext(contextLabel: string | null) {
  if (!contextLabel) {
    return { lead: null, detail: null };
  }

  const [lead, ...rest] = contextLabel.split(" - ");
  return {
    lead: lead || null,
    detail: rest.length > 0 ? rest.join(" - ") : null,
  };
}

function buildCollapsedActionLine(item: RecentActivityItem) {
  if (item.activityType === "report_generated") {
    const trimmed = trimReportTitle(item.subjectPrimary);
    return `Generated ${trimmed.primary}`;
  }

  if (
    item.activityType === "loan_created" ||
    item.activityType === "collection_recorded" ||
    item.activityType === "missed_payment_recorded" ||
    item.activityType === "expense_recorded"
  ) {
    return buildActivitySummary(item);
  }

  return buildLogActionLine(item);
}

function buildExpandedDetails(item: RecentActivityItem) {
  if (item.activityType === "account_created") {
    const details = [];

    if (item.detailPrimary) {
      details.push({ label: "Full Name", value: item.detailPrimary });
    }
    if (item.detailSecondary) {
      details.push({ label: "Company ID", value: item.detailSecondary });
    }
    details.push({ label: "Initial Branch", value: item.contextLabel || item.branchLabel || "Unassigned" });
    if (item.detailTertiary) {
      details.push({ label: "Initial Area", value: item.detailTertiary });
    }

    return details;
  }

  if (item.activityType === "borrower_created") {
    const details = [];

    if (item.detailPrimary) {
      details.push({ label: "Full Name", value: item.detailPrimary });
    }
    details.push({ label: "Company ID", value: item.subjectPrimary });
    details.push({ label: "Initial Branch", value: item.branchLabel || "Unassigned" });
    if (item.detailTertiary) {
      details.push({ label: "Initial Area", value: item.detailTertiary });
    }

    return details;
  }

  if (item.activityType === "loan_created") {
    const details = [];

    if (item.detailPrimary) {
      details.push({ label: "Borrower", value: item.detailPrimary });
    }

    return details;
  }

  if (item.activityType === "collection_recorded") {
    const details = [];

    if (item.detailPrimary) {
      details.push({ label: "Amount collected", value: item.detailPrimary });
    }
    if (item.detailSecondary) {
      details.push({ label: "Loan owner", value: item.detailSecondary });
    }

    return details;
  }

  if (item.activityType === "report_generated") {
    const trimmed = trimReportTitle(item.subjectPrimary);
    const details = [];

    if (trimmed.remainder) {
      details.push({ label: "Filters / scope", value: trimmed.remainder });
    }
    if (item.contextLabel) {
      details.push({ label: "Report kind", value: item.contextLabel });
    }

    return details;
  }

  if (item.activityType === "missed_payment_recorded") {
    const split = splitDetailContext(item.contextLabel);
    const details = [];

    if (item.detailPrimary) {
      details.push({ label: "Amount collected", value: item.detailPrimary });
    }
    if (item.detailSecondary) {
      details.push({ label: "Loan owner", value: item.detailSecondary });
    }
    if (split.lead) {
      details.push({ label: "Loan", value: split.lead });
    }
    if (split.detail) {
      details.push({ label: "Note", value: split.detail });
    }

    return details;
  }

  if (item.activityType === "expense_recorded") {
    const split = splitDetailContext(item.contextLabel);
    const details = [];

    if (split.lead) {
      details.push({ label: "Amount", value: split.lead });
    }
    if (split.detail) {
      details.push({ label: "Description", value: split.detail });
    }

    return details;
  }

  return [];
}

function ExpandedDetailRows(props: {
  details: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="space-y-3">
      {props.details.map((detail) => (
        <div
          className={`grid items-start gap-x-6 gap-y-1 border-b border-border/50 pb-3 last:border-b-0 last:pb-0 ${EXPANDED_DETAIL_GRID_CLASS}`}
          key={`${detail.label}-${detail.value}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 md:pt-1">
            {detail.label}
          </p>
          <p className="text-sm leading-6 text-foreground">{detail.value}</p>
        </div>
      ))}
    </div>
  );
}

export function RecentActivityClientPage({
  initialData,
  initialFilters,
}: {
  initialData: RecentActivityPageData;
  initialFilters: RecentActivityClientFilters;
}) {
  const [results, setResults] = useState(initialData);
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const filtersRef = useRef(initialFilters);
  const requestIdRef = useRef(0);

  useEffect(() => {
    setResults(initialData);
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setExpandedActivityId(null);
  }, [initialData, initialFilters]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const updateHistory = useCallback((nextFilters: RecentActivityClientFilters) => {
    window.history.replaceState(null, "", buildPageUrl(nextFilters));
  }, []);

  const loadResults = useCallback(
    async (
      nextFilters: RecentActivityClientFilters,
      options?: {
        append?: boolean;
        page?: number;
      },
    ) => {
      const append = options?.append ?? false;
      const page = options?.page ?? 1;

      if (!append) {
        abortRef.current?.abort();
      }

      const controller = new AbortController();
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      abortRef.current = controller;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsPending(true);
        setErrorMessage(null);
      }

      try {
        const response = await fetch(buildDataUrl(nextFilters, page), {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to refresh recent activity.");
        }

        const nextData = (await response.json()) as RecentActivityPageData;
        if (requestIdRef.current !== requestId) {
          return;
        }

        if (append) {
          setResults((previous) => ({
            ...nextData,
            items: [...previous.items, ...nextData.items],
          }));
        } else {
          setResults(nextData);
          setAppliedFilters(nextFilters);
          updateHistory(nextFilters);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (requestIdRef.current !== requestId) {
          return;
        }

        setErrorMessage("Unable to refresh recent activity right now.");
      } finally {
        if (abortRef.current === controller && requestIdRef.current === requestId) {
          setIsPending(false);
          setIsLoadingMore(false);
        }
      }
    },
    [updateHistory],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (sameFilters(filters, appliedFilters)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadResults(filtersRef.current, { append: false, page: 1 });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [appliedFilters, filters, loadResults]);

  const handleLoadMore = useCallback(() => {
    if (!results.hasMore || isLoadingMore) {
      return;
    }

    void loadResults(appliedFilters, {
      append: true,
      page: results.page + 1,
    });
  }, [appliedFilters, isLoadingMore, loadResults, results.hasMore, results.page]);

  const actorRoleOptions = useMemo(() => buildRoleOptions(results.actorOptions), [results.actorOptions]);

  const filteredActorOptions = useMemo<ActorComboboxOption[]>(
    () =>
      (filters.actorRoleName
        ? results.actorOptions.filter((option) => option.roleName === filters.actorRoleName)
        : []
      ).map((option) => ({
        userId: option.userId,
        displayName: option.displayName,
        roleName: option.roleName,
      })),
    [filters.actorRoleName, results.actorOptions],
  );

  const selectedActorOption =
    filteredActorOptions.find((option) => option.userId === filters.actorUserId) ?? null;

  return (
    <div className="w-full max-w-none space-y-5 pb-6 pt-1 sm:pb-6 sm:pt-2">
      <TremorCard className="overflow-hidden p-0">
        <div className="bg-gradient-to-r from-slate-50 via-background to-emerald-50/60 p-6 dark:from-zinc-950 dark:via-background dark:to-emerald-950/45">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-1">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">Recent Activity</h1>
                <TremorDescription>
                  Operational log of creation-based events the current schema can support truthfully.
                </TremorDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Badge className="border-zinc-200 bg-background/80 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100" variant="outline">
                  {results.totalCount} events
                </Badge>
                <Badge className="border-zinc-200 bg-background/80 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100" variant="outline">
                  {results.rangeLabel}
                </Badge>
                <Badge className="border-zinc-200 bg-background/80 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100" variant="outline">
                  {results.scopeLabel}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 px-6 pb-4 pt-3">
          <div className={`grid gap-4 ${FILTER_GRID_CLASS}`}>
            <label>
              <FilterLabel>Recency</FilterLabel>
              <Select
                onValueChange={(value) =>
                  setFilters((previous) => ({
                    ...previous,
                    preset: value as RecentActivityPreset,
                  }))
                }
                value={filters.preset}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECENT_ACTIVITY_PRESET_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label>
              <FilterLabel>Activity Type</FilterLabel>
              <Select
                onValueChange={(value) =>
                  setFilters((previous) => ({
                    ...previous,
                    activityType: value as RecentActivityTypeFilter,
                  }))
                }
                value={filters.activityType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECENT_ACTIVITY_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label>
              <FilterLabel>Actor Role</FilterLabel>
              <Select
                onValueChange={(value) =>
                  setFilters((previous) => {
                    const nextRoleName = value === "__all__" ? null : value;
                    const selectedActorStillValid =
                      previous.actorUserId &&
                      nextRoleName &&
                      results.actorOptions.some(
                        (option) =>
                          option.userId === previous.actorUserId &&
                          option.roleName === nextRoleName,
                      );

                    return {
                      ...previous,
                      actorRoleName: nextRoleName,
                      actorUserId: selectedActorStillValid ? previous.actorUserId : null,
                    };
                  })
                }
                value={filters.actorRoleName ?? "__all__"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All visible roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All visible roles</SelectItem>
                  {actorRoleOptions.map((roleOption) => (
                    <SelectItem key={roleOption} value={roleOption}>
                      {roleOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label>
              <FilterLabel>Branch</FilterLabel>
              <Select
                disabled={results.branchOptions.length <= 1}
                onValueChange={(value) =>
                  setFilters((previous) => ({
                    ...previous,
                    branchId: value === "__all__" ? null : Number(value),
                  }))
                }
                value={filters.branchId ? String(filters.branchId) : "__all__"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All visible branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All visible branches</SelectItem>
                  {results.branchOptions.map((option) => (
                    <SelectItem key={option.branchId} value={String(option.branchId)}>
                      {option.branchName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          {filters.actorRoleName ? (
            <div className="mt-4 w-full lg:max-w-xl">
              <label className="space-y-2">
                <FilterLabel>Specific Actor</FilterLabel>
                <Combobox
                  items={filteredActorOptions}
                  isItemEqualToValue={(item, value) => item.userId === value.userId}
                  itemToStringLabel={(item) => item.displayName}
                  itemToStringValue={(item) => item.userId}
                  onValueChange={(nextValue) =>
                    setFilters((previous) => ({
                      ...previous,
                      actorUserId: (nextValue as ActorComboboxOption | null)?.userId ?? null,
                    }))
                  }
                  value={selectedActorOption}
                >
                  <ComboboxInput
                    className="w-full"
                    placeholder={`Search ${filters.actorRoleName.toLowerCase()}s`}
                    showClear
                  />
                  <ComboboxContent className="z-100 max-h-72">
                    <ComboboxEmpty>No visible actors found.</ComboboxEmpty>
                    <ComboboxList>
                      {(item: ActorComboboxOption) => (
                        <ComboboxItem key={item.userId} value={item}>
                          {item.displayName}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </label>
            </div>
          ) : null}

          {filters.preset === "custom" ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <FilterLabel>From</FilterLabel>
                <Input
                  onChange={(event) =>
                    setFilters((previous) => ({
                      ...previous,
                      fromDate: event.target.value || null,
                    }))
                  }
                  type="date"
                  value={filters.fromDate ?? ""}
                />
              </label>
              <label className="space-y-2">
                <FilterLabel>To</FilterLabel>
                <Input
                  onChange={(event) =>
                    setFilters((previous) => ({
                      ...previous,
                      toDate: event.target.value || null,
                    }))
                  }
                  type="date"
                  value={filters.toDate ?? ""}
                />
              </label>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
            <p className="text-sm text-muted-foreground">Filters update the log directly without reloading the page.</p>
            <Button
              onClick={() => {
                const resetFilters: RecentActivityClientFilters = {
                  preset: "30d",
                  fromDate: null,
                  toDate: null,
                  activityType: "all",
                  actorRoleName: null,
                  actorUserId: null,
                  branchId: null,
                };
                setFilters(resetFilters);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Reset filters
            </Button>
          </div>
        </div>
      </TremorCard>

      <TremorCard className="relative overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-6 py-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-foreground">Activity Log</h2>
            <p className="text-sm text-muted-foreground">Latest visible creation-based events across your scope.</p>
          </div>
          <div className="text-sm text-muted-foreground">{results.items.length} loaded</div>
        </div>

        {errorMessage ? (
          <div className="border-b border-border/70 px-6 py-3 text-sm text-destructive">{errorMessage}</div>
        ) : null}

        {results.items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-base font-medium text-foreground">No activity matches the current filters.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try widening the date range or clearing one of the filters.
            </p>
          </div>
        ) : (
          <div className="relative w-full">
            <div
              className={`hidden gap-4 border-b border-border/70 bg-[#F6F6F6] px-6 py-3 text-sm font-medium text-muted-foreground dark:bg-[var(--app-table-header)] lg:grid ${DESKTOP_LOG_GRID_CLASS}`}
            >
              <span>Time</span>
              <span>Action</span>
              <span>Actor</span>
              <span>Branch</span>
              <span aria-hidden="true" />
            </div>

            <div className="w-full">
              {results.items.map((item) => {
                const details = buildExpandedDetails(item);
                const isExpandable = details.length > 0;
                const isExpanded = expandedActivityId === item.activityId;
                const actorHasVisibleName = item.actorRoleName !== "System" && item.actorName.trim().length > 0;

                return (
                  <div className="border-b border-border/70 last:border-b-0" key={item.activityId}>
                    <button
                      className={`w-full px-4 py-3 text-left transition-colors disabled:cursor-default sm:px-6 ${isExpandable ? "hover:bg-zinc-50/60" : ""}`}
                      disabled={!isExpandable}
                      onClick={() =>
                        isExpandable
                          ? setExpandedActivityId((current) =>
                              current === item.activityId ? null : item.activityId,
                            )
                          : undefined
                      }
                      type="button"
                    >
                      <div className="space-y-2 lg:hidden">
                        <div className="font-mono text-[13px] text-muted-foreground">
                          {timestampFormatter.format(new Date(item.occurredAt))}
                        </div>
                        <div className="flex min-w-0 flex-wrap items-start gap-2">
                          <Badge className={activityBadgeClass(item.activityType)} variant="outline">
                            {item.activityLabel}
                          </Badge>
                          <span className="min-w-0 flex-1 whitespace-normal wrap-break-word text-sm leading-5 text-foreground">
                            {buildCollapsedActionLine(item)}
                          </span>
                          {isExpandable ? <ChevronDown className={`mt-0.5 size-4 shrink-0 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} /> : null}
                        </div>
                        <div className="flex flex-wrap items-start gap-2 text-sm text-foreground">
                          {item.actorRoleName ? (
                            <Badge className={roleBadgeClass(item.actorRoleName)} variant="outline">
                              {item.actorRoleName}
                            </Badge>
                          ) : null}
                          {actorHasVisibleName ? (
                            <span className="min-w-0 flex-1 whitespace-normal wrap-break-word">{item.actorName}</span>
                          ) : null}
                          <span className="text-muted-foreground">{item.branchLabel ?? "Global / Unscoped"}</span>
                        </div>
                      </div>

                      <div className={`hidden w-full items-start gap-4 lg:grid ${DESKTOP_LOG_GRID_CLASS}`}>
                        <div className="min-w-0 text-left font-mono text-[13px] text-muted-foreground">
                          {timestampFormatter.format(new Date(item.occurredAt))}
                        </div>

                        <div className="min-w-0 text-left">
                          <div className="flex min-w-0 items-start gap-2">
                            <Badge className={activityBadgeClass(item.activityType)} variant="outline">
                              {item.activityLabel}
                            </Badge>
                            <span className="min-w-0 flex-1 whitespace-normal wrap-break-word text-sm leading-5 text-foreground">
                              {buildCollapsedActionLine(item)}
                            </span>
                          </div>
                        </div>

                        <div className="min-w-0 text-left">
                          <div className="flex min-w-0 flex-wrap items-start gap-2">
                            {item.actorRoleName ? (
                              <Badge className={roleBadgeClass(item.actorRoleName)} variant="outline">
                                {item.actorRoleName}
                              </Badge>
                            ) : null}
                            {actorHasVisibleName ? (
                              <span className="min-w-0 flex-1 whitespace-normal wrap-break-word text-sm leading-5 text-foreground">
                                {item.actorName}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="min-w-0 text-left text-sm leading-5 text-foreground">
                          <span className="whitespace-normal wrap-break-word ">{item.branchLabel ?? "Global / Unscoped"}</span>
                        </div>

                        <div className="flex justify-end">
                          {isExpandable ? <ChevronDown className={`mt-0.5 size-4 shrink-0 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} /> : null}
                        </div>
                      </div>
                    </button>

                    {isExpandable && isExpanded ? (
                      <div className="border-t border-border/70 bg-zinc-50/60 px-4 py-4 sm:px-6">
                        <ExpandedDetailRows details={details} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {isPending ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/65 backdrop-blur-[1px]">
                <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
                  Updating results...
                </div>
              </div>
            ) : null}
          </div>
        )}
      </TremorCard>

      {results.hasMore ? (
        <div className="flex justify-center">
          <Button disabled={isLoadingMore || isPending} onClick={handleLoadMore} size="sm" type="button" variant="outline">
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
