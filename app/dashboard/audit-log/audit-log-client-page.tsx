"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Logs, Search } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { AuditLogTable } from "@/app/dashboard/audit-log/audit-log-table";
import type {
  AuditLogDatePreset,
  AuditLogFilterAction,
  AuditLogFilters,
  AuditLogPageData,
} from "@/app/dashboard/audit-log/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ACTIONS,
  type AuditEntityType,
} from "@/lib/audit/taxonomy";

type AuditLogClientPageProps = {
  initialData: AuditLogPageData;
  canChooseBranch: boolean;
};

const controlClassName = "!h-11 rounded-md bg-white py-0 text-sm dark:bg-background";

const AUDIT_FILTER_ACTION_LABELS: Record<AuditLogFilterAction, string> = {
  ...AUDIT_ACTION_LABELS,
  "collection.payment_recorded": "Collection recorded",
  "collection.missed_payment_recorded": "Missed payment recorded",
};

const ENTITY_ACTIONS: Record<AuditEntityType, AuditLogFilterAction[]> = {
  auth: AUDIT_ACTIONS.filter((action) => action.startsWith("auth.")),
  user: AUDIT_ACTIONS.filter((action) => action.startsWith("user.")),
  assignment: AUDIT_ACTIONS.filter((action) => action.startsWith("assignment.")),
  loan: AUDIT_ACTIONS.filter((action) => action.startsWith("loan.")),
  collection: ["collection.payment_recorded", "collection.missed_payment_recorded"],
  expense: ["expense.created"],
  document: AUDIT_ACTIONS.filter((action) => action.startsWith("document.")),
  report: [
    "report.generated",
    "report.exported",
    "report.generated_system_monthly",
    "incentive.report_generated",
  ],
  incentive: ["incentive.rule_created", "incentive.batch_finalized", "incentive.payout_recorded"],
};

const FILTER_ENTITY_OPTIONS: Array<{ value: AuditLogFilters["entityType"]; label: string }> = [
  { value: "auth", label: "Auth" },
  { value: "user", label: "User" },
  { value: "assignment", label: "Assignment" },
  { value: "loan", label: "Loan" },
  { value: "collection", label: "Collection" },
  { value: "expense", label: "Expense" },
  { value: "document", label: "Document" },
  { value: "report", label: "Report" },
  { value: "incentive", label: "Incentive" },
];

function filtersEqual(left: AuditLogFilters, right: AuditLogFilters) {
  return (
    left.preset === right.preset &&
    left.fromDate === right.fromDate &&
    left.toDate === right.toDate &&
    left.branchId === right.branchId &&
    left.action === right.action &&
    left.entityType === right.entityType &&
    left.actorRole === right.actorRole &&
    left.actor === right.actor &&
    left.query === right.query &&
    left.page === right.page &&
    left.pageSize === right.pageSize
  );
}

function filtersEqualIgnoringPage(left: AuditLogFilters, right: AuditLogFilters) {
  return (
    left.preset === right.preset &&
    left.fromDate === right.fromDate &&
    left.toDate === right.toDate &&
    left.branchId === right.branchId &&
    left.action === right.action &&
    left.entityType === right.entityType &&
    left.actorRole === right.actorRole &&
    left.actor === right.actor &&
    left.query === right.query &&
    left.pageSize === right.pageSize
  );
}

function buildResultsUrl(filters: AuditLogFilters) {
  const params = new URLSearchParams();

  if (filters.preset !== "30d") {
    params.set("preset", filters.preset);
  }

  if (filters.preset === "custom") {
    if (filters.fromDate) {
      params.set("from", filters.fromDate);
    }
    if (filters.toDate) {
      params.set("to", filters.toDate);
    }
  }

  if (filters.branchId) {
    params.set("branch", String(filters.branchId));
  }

  if (filters.action !== "all") {
    params.set("action", filters.action);
  }

  if (filters.entityType !== "all") {
    params.set("entity", filters.entityType);
  }

  if (filters.actorRole !== "all") {
    params.set("actorRole", filters.actorRole);
  }

  if (filters.actor !== "all") {
    params.set("actor", filters.actor);
  }

  if (filters.query.trim()) {
    params.set("query", filters.query.trim());
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  if (filters.pageSize !== 25) {
    params.set("pageSize", String(filters.pageSize));
  }

  const queryString = params.toString();
  return queryString ? `/dashboard/audit-log?${queryString}` : "/dashboard/audit-log";
}

function buildDataUrl(filters: AuditLogFilters) {
  const resultsUrl = buildResultsUrl(filters);
  return resultsUrl === "/dashboard/audit-log"
    ? "/dashboard/audit-log/data"
    : `/dashboard/audit-log/data?${resultsUrl.split("?")[1] ?? ""}`;
}

function clampPage(page: number, totalCount: number, pageSize: number) {
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1);
  return Math.min(Math.max(page, 1), totalPages);
}

export function AuditLogClientPage({ initialData, canChooseBranch }: AuditLogClientPageProps) {
  const initialFilters = useMemo(() => initialData.filters, [initialData.filters]);
  const [data, setData] = useState(initialData);
  const [filters, setFilters] = useState(initialFilters);
  const [debouncedQuery, setDebouncedQuery] = useState(initialFilters.query);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const loadedRequestUrlRef = useRef(buildDataUrl(initialFilters));
  const lastLoadedBaseFiltersRef = useRef(initialData.filters);

  useEffect(() => {
    setData(initialData);
    setFilters(initialData.filters);
    setDebouncedQuery(initialData.filters.query);
    setErrorMessage(null);
    loadedRequestUrlRef.current = buildDataUrl(initialData.filters);
    lastLoadedBaseFiltersRef.current = initialData.filters;
  }, [initialData]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(filters.query);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [filters.query]);

  const updateHistory = useCallback((nextFilters: AuditLogFilters) => {
    window.history.replaceState(null, "", buildResultsUrl(nextFilters));
  }, []);

  const loadResults = useCallback(
    async (nextFilters: AuditLogFilters, options?: { append?: boolean; force?: boolean }) => {
      const requestUrl = buildDataUrl(nextFilters);
      if (!options?.force && requestUrl === loadedRequestUrlRef.current) {
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      abortRef.current = controller;
      setIsPending(true);
      setErrorMessage(null);

      try {
        const response = await fetch(requestUrl, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to refresh the audit log.");
        }

        const nextData = (await response.json()) as AuditLogPageData;
        if (requestIdRef.current !== requestId) {
          return;
        }

        loadedRequestUrlRef.current = buildDataUrl(nextData.filters);
        lastLoadedBaseFiltersRef.current = {
          ...nextData.filters,
          page: 1,
        };
        setData((current) =>
          options?.append
            ? {
                ...nextData,
                rows: [...current.rows, ...nextData.rows],
              }
            : nextData,
        );
        setFilters((current) => (filtersEqual(current, nextData.filters) ? current : nextData.filters));
        updateHistory(nextData.filters);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (requestIdRef.current !== requestId) {
          return;
        }

        setErrorMessage("Unable to refresh the audit log right now.");
      } finally {
        if (abortRef.current === controller && requestIdRef.current === requestId) {
          setIsPending(false);
        }
      }
    },
    [updateHistory],
  );

  const requestFilters = useMemo<AuditLogFilters>(
    () => ({
      ...filters,
      query: debouncedQuery,
    }),
    [debouncedQuery, filters],
  );

  useEffect(() => {
    const baseRequestFilters = {
      ...requestFilters,
      page: 1,
    };

    if (filtersEqualIgnoringPage(lastLoadedBaseFiltersRef.current, baseRequestFilters)) {
      return;
    }

    void loadResults(baseRequestFilters, { force: true });
  }, [loadResults, requestFilters]);

  const availableActions = useMemo(
    () =>
      filters.entityType === "all"
        ? ([...AUDIT_ACTIONS, "collection.payment_recorded", "collection.missed_payment_recorded"] as AuditLogFilterAction[])
        : ENTITY_ACTIONS[filters.entityType],
    [filters.entityType],
  );

  useEffect(() => {
    if (filters.action === "all" || availableActions.includes(filters.action)) {
      return;
    }

    setFilters((previous) =>
      previous.action === "all" || availableActions.includes(previous.action as AuditLogFilterAction)
        ? previous
        : {
            ...previous,
            action: "all",
            page: 1,
          },
    );
  }, [availableActions, filters.action]);

  useEffect(() => {
    if (filters.actor === "all") {
      return;
    }

    if (data.actorOptions.some((option) => option.actorKey === filters.actor)) {
      return;
    }

    setFilters((previous) =>
      previous.actor === "all"
        ? previous
        : {
            ...previous,
            actor: "all",
            page: 1,
          },
    );
  }, [data.actorOptions, filters.actor]);
  const totalPages = Math.max(Math.ceil(data.totalCount / filters.pageSize), 1);
  const safeCurrentPage = clampPage(filters.page, data.totalCount, filters.pageSize);
  const loadedCount = data.rows.length;
  const hasMore = loadedCount < data.totalCount;

  return (
    <div className="space-y-4">
      <DashboardHeaderConfigurator
        config={{
          icon: <Logs className="size-9 text-sidebar-foreground/65" />,
          title: "Audit Log",
          description:
            "Review security and operational event logs that happen across the system based on your scope",
        }}
      />

      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:w-[360px] xl:shrink-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground/70" />
              <Input
                aria-label="Search audit log"
                className={`${controlClassName} pl-10 placeholder:text-muted-foreground/75`}
                id="auditLogSearch"
                onChange={(event) =>
                  setFilters((previous) => ({
                    ...previous,
                    query: event.target.value,
                    page: 1,
                  }))
                }
                placeholder="Search actor, target, remarks, or metadata"
                value={filters.query}
              />
            </div>

            <div className="flex w-full flex-wrap items-center gap-2.5 xl:w-auto xl:justify-end">
              <Select
                onValueChange={(value) =>
                  setFilters((previous) => ({
                    ...previous,
                    preset: value as AuditLogDatePreset,
                    fromDate: value === "custom" ? previous.fromDate : null,
                    toDate: value === "custom" ? previous.toDate : null,
                    page: 1,
                  }))
                }
                value={filters.preset}
              >
                <SelectTrigger aria-label="Date range" className={`${controlClassName} w-full min-w-[180px] sm:w-[190px]`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Date Range</SelectLabel>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>

              {canChooseBranch ? (
                <Select
                  onValueChange={(value) =>
                    setFilters((previous) => ({
                      ...previous,
                      branchId: value === "__all" ? null : Number(value),
                      page: 1,
                    }))
                  }
                  value={filters.branchId ? String(filters.branchId) : "__all"}
                >
                  <SelectTrigger aria-label="Branch" className={`${controlClassName} w-full min-w-[180px] sm:w-[190px]`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Branch</SelectLabel>
                      <SelectItem value="__all">All visible branches</SelectItem>
                      {data.branchOptions.map((option) => (
                        <SelectItem key={option.branchId} value={String(option.branchId)}>
                          {option.branchName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : null}

              <Select
                onValueChange={(value) =>
                  setFilters((previous) => {
                    const nextEntity = value as AuditLogFilters["entityType"];
                    const nextActions =
                      nextEntity === "all"
                        ? ([...AUDIT_ACTIONS, "collection.payment_recorded", "collection.missed_payment_recorded"] as AuditLogFilterAction[])
                        : ENTITY_ACTIONS[nextEntity];

                    return {
                      ...previous,
                      entityType: nextEntity,
                      action:
                        previous.action !== "all" && !nextActions.includes(previous.action as AuditLogFilterAction)
                          ? "all"
                          : previous.action,
                      page: 1,
                    };
                  })
                }
                value={filters.entityType}
              >
                <SelectTrigger aria-label="Entity" className={`${controlClassName} w-full min-w-[180px] sm:w-[190px]`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Entity</SelectLabel>
                    <SelectItem value="all">All entities</SelectItem>
                    {FILTER_ENTITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                onValueChange={(value) =>
                  setFilters((previous) => ({
                    ...previous,
                    action: value as AuditLogFilters["action"],
                    page: 1,
                  }))
                }
                value={filters.action}
              >
                <SelectTrigger aria-label="Action" className={`${controlClassName} w-full min-w-[180px] sm:w-[190px]`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Action</SelectLabel>
                    <SelectItem value="all">All actions</SelectItem>
                    {availableActions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {AUDIT_FILTER_ACTION_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Select
                onValueChange={(value) =>
                  setFilters((previous) => ({
                    ...previous,
                    actorRole: value,
                    actor: "all",
                    page: 1,
                  }))
                }
                value={filters.actorRole}
              >
                <SelectTrigger aria-label="Actor role" className={`${controlClassName} w-full min-w-[180px] sm:w-[190px]`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Actor Role</SelectLabel>
                    <SelectItem value="all">All actor roles</SelectItem>
                    {data.actorRoleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Button
                className={`${controlClassName} px-4`}
                onClick={() => {
                  const resetFilters: AuditLogFilters = {
                    ...initialFilters,
                    branchId: canChooseBranch ? null : initialFilters.branchId,
                    action: "all",
                    entityType: "all",
                    actorRole: "all",
                    actor: "all",
                    preset: "30d",
                    fromDate: null,
                    toDate: null,
                    query: "",
                    page: 1,
                  };
                  setFilters(resetFilters);
                  setDebouncedQuery("");
                }}
                type="button"
                variant="outline"
              >
                Clear
              </Button>
            </div>
          </div>

          {filters.preset === "custom" ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-full min-w-[180px] sm:w-[190px]">
                <label className="sr-only" htmlFor="auditFrom">
                  From
                </label>
                <Input
                  className={`${controlClassName} w-full`}
                  id="auditFrom"
                  onChange={(event) =>
                    setFilters((previous) => ({
                      ...previous,
                      fromDate: event.target.value || null,
                      page: 1,
                    }))
                  }
                  type="date"
                  value={filters.fromDate ?? ""}
                />
              </div>
              <div className="w-full min-w-[180px] sm:w-[190px]">
                <label className="sr-only" htmlFor="auditTo">
                  To
                </label>
                <Input
                  className={`${controlClassName} w-full`}
                  id="auditTo"
                  onChange={(event) =>
                    setFilters((previous) => ({
                      ...previous,
                      toDate: event.target.value || null,
                      page: 1,
                    }))
                  }
                  type="date"
                  value={filters.toDate ?? ""}
                />
              </div>
            </div>
          ) : null}

          {filters.actorRole !== "all" ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <Select
                onValueChange={(value) =>
                  setFilters((previous) => ({
                    ...previous,
                    actor: value,
                    page: 1,
                  }))
                }
                value={filters.actor}
              >
                <SelectTrigger aria-label="Actor" className={`${controlClassName} w-full min-w-[180px] sm:w-[190px]`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Actor</SelectLabel>
                    <SelectItem value="all">All relevant actors</SelectItem>
                    {data.actorOptions.map((option) => (
                      <SelectItem key={option.actorKey} value={option.actorKey}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div className="px-1">
          {errorMessage ? <p className="mt-2 text-sm text-destructive">{errorMessage}</p> : null}
        </div>

        <div className={isPending ? "transition-opacity" : undefined}>
          <AuditLogTable branchOptions={data.branchOptions} rows={data.rows} />
        </div>

        <div className="px-1">
          <div className="flex flex-col gap-3 text-sm md:flex-row md:items-center md:justify-between">
            <p className="text-muted-foreground">
              Showing {loadedCount} of {data.totalCount}
            </p>
            <div className="flex items-center gap-2">
              {hasMore ? (
              <Button
                className="h-11 rounded-md px-4 text-sm"
                disabled={isPending}
                onClick={() =>
                  void loadResults(
                    {
                      ...requestFilters,
                      page: Math.min(safeCurrentPage + 1, totalPages),
                    },
                    { append: true, force: true },
                  )
                }
                type="button"
                variant="outline"
              >
                {isPending ? "Loading..." : "Load more"}
              </Button>
              ) : (
                <span className="text-muted-foreground">All matching events loaded</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
