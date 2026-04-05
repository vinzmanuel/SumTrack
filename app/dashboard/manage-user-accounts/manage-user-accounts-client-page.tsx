"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, UserCog } from "lucide-react";
import { appendBackNavigationToHref } from "@/app/dashboard/back-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedStatusControl } from "@/app/dashboard/_components/segmented-status-control";
import {
  CollectorLiveLoanReassignmentDialog,
  type CollectorReassignmentRequest,
} from "@/app/dashboard/manage-user-accounts/collector-live-loan-reassignment-dialog";
import { ManageUserAccountsFilters } from "@/app/dashboard/manage-user-accounts/manage-user-accounts-filters";
import { ManagedUserAccountEditModal } from "@/app/dashboard/manage-user-accounts/managed-user-account-edit-modal";
import { ManageUserAccountsModule } from "@/app/dashboard/manage-user-accounts/manage-user-accounts-module";
import {
  canCreateManagedUser,
  type ManagedCollectorReassignmentRequiredPayload,
  type ManageUserAccountStatus,
  type ManageUserAccountsPageData,
  type ManageUserAccountsScope,
  type ManageUserAccountsSort,
} from "@/app/dashboard/manage-user-accounts/types";

type ManageUserFilters = {
  status: ManageUserAccountStatus;
  branchId: number | null;
  areaId: number | null;
  roleName: string | null;
  sort: ManageUserAccountsSort;
  query: string;
  page: number;
  pageSize: number;
};

function buildResultsUrl(filters: ManageUserFilters) {
  const params = new URLSearchParams();

  if (filters.status === "inactive") {
    params.set("status", filters.status);
  }

  if (filters.branchId) {
    params.set("branchId", String(filters.branchId));
  }

  if (filters.areaId) {
    params.set("areaId", String(filters.areaId));
  }

  if (filters.roleName) {
    params.set("role", filters.roleName);
  }

  if (filters.sort !== "role_asc") {
    params.set("sort", filters.sort);
  }

  if (filters.query.trim()) {
    params.set("query", filters.query.trim());
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  if (filters.pageSize !== 20) {
    params.set("pageSize", String(filters.pageSize));
  }

  const queryString = params.toString();
  return queryString ? `/dashboard/manage-user-accounts?${queryString}` : "/dashboard/manage-user-accounts";
}

function buildDataUrl(filters: ManageUserFilters) {
  const params = new URLSearchParams();

  if (filters.status === "inactive") {
    params.set("status", filters.status);
  }

  if (filters.branchId) {
    params.set("branchId", String(filters.branchId));
  }

  if (filters.areaId) {
    params.set("areaId", String(filters.areaId));
  }

  if (filters.roleName) {
    params.set("role", filters.roleName);
  }

  if (filters.sort !== "role_asc") {
    params.set("sort", filters.sort);
  }

  if (filters.query.trim()) {
    params.set("query", filters.query.trim());
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }

  if (filters.pageSize !== 20) {
    params.set("pageSize", String(filters.pageSize));
  }

  const queryString = params.toString();
  return queryString ? `/dashboard/manage-user-accounts/data?${queryString}` : "/dashboard/manage-user-accounts/data";
}

export function ManageUserAccountsClientPage({
  initialData,
  initialScope,
}: {
  initialData: ManageUserAccountsPageData;
  initialScope: ManageUserAccountsScope;
}) {
  const initialFilters = useMemo<ManageUserFilters>(
    () => ({
      status: initialScope.selectedStatus,
      branchId: initialScope.selectedBranchId,
      areaId: initialData.selectedAreaId,
      roleName: initialScope.selectedRoleName,
      sort: initialScope.selectedSort,
      query: initialScope.searchQuery,
      page: initialData.page,
      pageSize: initialData.pageSize,
    }),
    [
      initialData.page,
      initialData.pageSize,
      initialData.selectedAreaId,
      initialScope.searchQuery,
      initialScope.selectedBranchId,
      initialScope.selectedRoleName,
      initialScope.selectedSort,
      initialScope.selectedStatus,
    ],
  );
  const [results, setResults] = useState(initialData);
  const [filters, setFilters] = useState<ManageUserFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<ManageUserFilters>(initialFilters);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const filtersRef = useRef<ManageUserFilters>(initialFilters);
  const requestIdRef = useRef(0);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [reassignmentRequest, setReassignmentRequest] = useState<CollectorReassignmentRequest | null>(null);

  useEffect(() => {
    setResults(initialData);
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setErrorMessage(null);
  }, [initialData, initialFilters]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const updateHistory = useCallback((nextFilters: ManageUserFilters) => {
    window.history.replaceState(null, "", buildResultsUrl(nextFilters));
  }, []);
  const currentReturnTo = buildResultsUrl(filters);

  const loadResults = useCallback(async (nextFilters: ManageUserFilters) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    abortRef.current = controller;
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(buildDataUrl(nextFilters), {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Unable to update user accounts.");
      }

      const nextData = (await response.json()) as ManageUserAccountsPageData;
      if (requestIdRef.current !== requestId) {
        return;
      }

      setResults(nextData);
      const nextApplied = {
        status: nextFilters.status,
        branchId: nextFilters.branchId,
        areaId: nextData.selectedAreaId,
        roleName: nextFilters.roleName,
        sort: nextFilters.sort,
        query: nextFilters.query,
        page: nextData.page,
        pageSize: nextData.pageSize,
      };
      setAppliedFilters(nextApplied);
      updateHistory(nextApplied);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      if (requestIdRef.current !== requestId) {
        return;
      }

      setErrorMessage("Unable to refresh user accounts right now.");
    } finally {
      if (abortRef.current === controller && requestIdRef.current === requestId) {
        setIsPending(false);
      }
    }
  }, [updateHistory]);

  useEffect(() => {
    if (
      filters.status === appliedFilters.status &&
      filters.branchId === appliedFilters.branchId &&
      filters.areaId === appliedFilters.areaId &&
      filters.roleName === appliedFilters.roleName &&
      filters.sort === appliedFilters.sort &&
      filters.pageSize === appliedFilters.pageSize
    ) {
      return;
    }

    void loadResults({
      status: filters.status,
      branchId: filters.branchId,
      areaId: filters.areaId,
      roleName: filters.roleName,
      sort: filters.sort,
      query: filters.query,
      page: 1,
      pageSize: filters.pageSize,
    });
  }, [
    appliedFilters.status,
    appliedFilters.areaId,
    appliedFilters.branchId,
    appliedFilters.roleName,
    appliedFilters.sort,
    appliedFilters.pageSize,
    filters.status,
    filters.areaId,
    filters.branchId,
    filters.query,
    filters.roleName,
    filters.sort,
    filters.pageSize,
    loadResults,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (filtersRef.current.query === appliedFilters.query) {
        return;
      }

      void loadResults({
        status: filtersRef.current.status,
        branchId: filtersRef.current.branchId,
        areaId: filtersRef.current.areaId,
        roleName: filtersRef.current.roleName,
        sort: filtersRef.current.sort,
        query: filtersRef.current.query,
        page: 1,
        pageSize: filtersRef.current.pageSize,
      });
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [appliedFilters.query, filters.query, loadResults]);

  const handlePageChange = useCallback((page: number) => {
    setFilters((previous) => ({
      ...previous,
      page,
    }));

    void loadResults({
      status: filtersRef.current.status,
      branchId: filtersRef.current.branchId,
      areaId: filtersRef.current.areaId,
      roleName: filtersRef.current.roleName,
      sort: filtersRef.current.sort,
      query: filtersRef.current.query,
      page,
      pageSize: filtersRef.current.pageSize,
    });
  }, [loadResults]);

  const handlePageSizeChange = useCallback((pageSize: number) => {
    setFilters((previous) => ({
      ...previous,
      pageSize,
      page: 1,
    }));
  }, []);

  const handleRowDeleted = useCallback(() => {
    void loadResults({
      status: filtersRef.current.status,
      branchId: filtersRef.current.branchId,
      areaId: filtersRef.current.areaId,
      roleName: filtersRef.current.roleName,
      sort: filtersRef.current.sort,
      query: filtersRef.current.query,
      page: filtersRef.current.page,
      pageSize: filtersRef.current.pageSize,
    });
  }, [loadResults]);

  const handleReassignmentRequired = useCallback(
    (blocked: ManagedCollectorReassignmentRequiredPayload, retryAction: () => Promise<void>) => {
      setReassignmentRequest({
        blocked,
        retryAction,
      });
    },
    [],
  );

  const showAreaFilter = Boolean(
    filters.branchId && (filters.roleName === "Collector" || filters.roleName === "Borrower"),
  );
  const branchLabel = initialScope.canChooseBranch
    ? filters.branchId
      ? results.branches.find((branch) => branch.branchId === filters.branchId)?.branchName ?? "Selected branch"
      : initialScope.allBranchLabel
    : initialScope.allBranchLabel;
  const roleLabel = filters.roleName ?? "All roles";
  const statusLabel = filters.status === "active" ? "Active accounts" : "Inactive accounts";

  const handleClear = useCallback(() => {
    setFilters((previous) => ({
      ...previous,
      branchId: initialScope.canChooseBranch ? null : initialScope.selectedBranchId,
      areaId: null,
      roleName: null,
      query: "",
      page: 1,
    }));
  }, [initialScope.canChooseBranch, initialScope.selectedBranchId]);

  return (
    <>
      <div className="w-full max-w-none space-y-5 pb-6 pt-1 sm:pb-6 sm:pt-2">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="bg-gradient-to-r from-slate-50 via-background to-emerald-50/60 p-6 dark:from-zinc-950 dark:via-background dark:to-emerald-950/45">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-1">
                <div className="space-y-1">
                  <h1 className="flex items-center gap-2 text-3xl leading-none font-semibold tracking-tight text-foreground">
                    <UserCog className="relative -top-px size-7 shrink-0 text-muted-foreground" />
                    Manage User Accounts
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Review, filter, and manage user accounts within your current scope.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Badge
                    className="border-zinc-200 bg-background/80 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100"
                    variant="outline"
                  >
                    {results.totalCount} matches
                  </Badge>
                  <Badge
                    className="border-zinc-200 bg-background/80 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100"
                    variant="outline"
                  >
                    {branchLabel}
                  </Badge>
                  <Badge
                    className="border-zinc-200 bg-background/80 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100"
                    variant="outline"
                  >
                    {roleLabel}
                  </Badge>
                  <Badge
                    className="border-zinc-200 bg-background/80 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100"
                    variant="outline"
                  >
                    {statusLabel}
                  </Badge>
                </div>
              </div>

              {canCreateManagedUser(initialScope) ? (
                <Link href={appendBackNavigationToHref("/dashboard/create-account", {
                  source: "manage-users",
                  returnTo: currentReturnTo,
                })}>
                  <Button
                    className="bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                    size="sm"
                    type="button"
                  >
                    <Plus className="h-4 w-4" />
                    Create User
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>

          <div className="border-t border-border/70 px-6 pb-4 pt-3">
            <ManageUserAccountsFilters
              allBranchLabel={initialScope.allBranchLabel}
              areas={results.areas}
              branches={results.branches}
              canChooseBranch={initialScope.canChooseBranch}
              onAreaChange={(areaId) => setFilters((previous) => ({ ...previous, areaId, page: 1 }))}
              onBranchChange={(branchId) =>
                setFilters((previous) => ({
                  ...previous,
                  branchId,
                  areaId: null,
                  page: 1,
                }))
              }
              onClear={handleClear}
              onRoleChange={(roleName) =>
                setFilters((previous) => ({
                  ...previous,
                  roleName,
                  areaId: roleName === "Collector" || roleName === "Borrower" ? previous.areaId : null,
                  page: 1,
                }))
              }
              onSearchChange={(query) => setFilters((previous) => ({ ...previous, query, page: 1 }))}
              roles={results.roles}
              selectedAreaId={filters.areaId}
              selectedBranchId={filters.branchId}
              selectedRoleName={filters.roleName}
              selectedSearchQuery={filters.query}
              showAreaFilter={showAreaFilter}
            />
          </div>
        </Card>

        <ManageUserAccountsModule
          controls={
            <SegmentedStatusControl
              onChange={(status) =>
                setFilters((previous) => ({
                  ...previous,
                  status,
                  page: 1,
                }))
              }
              options={[
                { value: "active", label: `Active (${results.activeCount})`, tone: "active" },
                { value: "inactive", label: `Inactive (${results.inactiveCount})`, tone: "archived" },
              ]}
              selectedValue={filters.status}
            />
          }
          data={results}
          errorMessage={errorMessage}
          isPending={isPending}
          onDeleted={handleRowDeleted}
          onEdit={setEditingUserId}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          onReassignmentRequired={handleReassignmentRequired}
          onSortChange={(sort) =>
            setFilters((previous) => ({
              ...previous,
              sort,
              page: 1,
            }))
          }
          selectedSort={filters.sort}
          scopeMessage={initialScope.scopeMessage}
        />
      </div>

      <ManagedUserAccountEditModal
        onOpenChange={(open) => {
          if (!open) {
            setEditingUserId(null);
          }
        }}
        onSaved={handleRowDeleted}
        onReassignmentRequired={handleReassignmentRequired}
        open={Boolean(editingUserId)}
        userId={editingUserId}
      />

      <CollectorLiveLoanReassignmentDialog
        onOpenChange={(open) => {
          if (!open) {
            setReassignmentRequest(null);
          }
        }}
        request={reassignmentRequest}
      />
    </>
  );
}
