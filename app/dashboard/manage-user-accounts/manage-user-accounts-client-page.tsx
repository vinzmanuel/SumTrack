"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, UserCog } from "lucide-react";
import { appendBackNavigationToHref } from "@/app/dashboard/back-navigation";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { Button } from "@/components/ui/button";
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

function filtersEqual(left: ManageUserFilters, right: ManageUserFilters) {
  return (
    left.status === right.status &&
    left.branchId === right.branchId &&
    left.areaId === right.areaId &&
    left.roleName === right.roleName &&
    left.sort === right.sort &&
    left.query === right.query &&
    left.page === right.page &&
    left.pageSize === right.pageSize
  );
}

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
  const [debouncedQuery, setDebouncedQuery] = useState(initialFilters.query);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const filtersRef = useRef<ManageUserFilters>(initialFilters);
  const requestIdRef = useRef(0);
  const loadedRequestUrlRef = useRef(buildDataUrl(initialFilters));
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [reassignmentRequest, setReassignmentRequest] = useState<CollectorReassignmentRequest | null>(null);

  useEffect(() => {
    setResults(initialData);
    setFilters(initialFilters);
    setDebouncedQuery(initialFilters.query);
    setErrorMessage(null);
    loadedRequestUrlRef.current = buildDataUrl(initialFilters);
  }, [initialData, initialFilters]);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(filters.query);
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [filters.query]);

  const updateHistory = useCallback((nextFilters: ManageUserFilters) => {
    window.history.replaceState(null, "", buildResultsUrl(nextFilters));
  }, []);
  const currentReturnTo = buildResultsUrl(filters);

  const loadResults = useCallback(async (nextFilters: ManageUserFilters, options?: { force?: boolean }) => {
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

      const resolvedFilters: ManageUserFilters = {
        status: nextFilters.status,
        branchId: nextFilters.branchId,
        areaId: nextData.selectedAreaId,
        roleName: nextFilters.roleName,
        sort: nextFilters.sort,
        query: nextFilters.query,
        page: nextData.page,
        pageSize: nextData.pageSize,
      };

      setResults(nextData);
      loadedRequestUrlRef.current = buildDataUrl(resolvedFilters);
      setFilters((current) => (filtersEqual(current, resolvedFilters) ? current : resolvedFilters));
      updateHistory(resolvedFilters);
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

  const requestFilters = useMemo<ManageUserFilters>(
    () => ({
      status: filters.status,
      branchId: filters.branchId,
      areaId: filters.areaId,
      roleName: filters.roleName,
      sort: filters.sort,
      query: debouncedQuery,
      page: filters.page,
      pageSize: filters.pageSize,
    }),
    [
      debouncedQuery,
      filters.areaId,
      filters.branchId,
      filters.page,
      filters.pageSize,
      filters.roleName,
      filters.sort,
      filters.status,
    ],
  );

  useEffect(() => {
    void loadResults(requestFilters);
  }, [loadResults, requestFilters]);

  const handlePageChange = useCallback((page: number) => {
    setFilters((previous) => ({
      ...previous,
      page,
    }));
  }, []);

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
    }, { force: true });
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

  const createUserAction = useMemo(() => {
    if (!canCreateManagedUser(initialScope)) {
      return null;
    }

    return (
      <Link
        href={appendBackNavigationToHref("/dashboard/create-account", {
          source: "manage-users",
          returnTo: currentReturnTo,
        })}
      >
        <Button
          className="h-11 rounded-md bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700 hover:text-white"
          type="button"
        >
          <Plus className="h-4 w-4" />
          Create User
        </Button>
      </Link>
    );
  }, [currentReturnTo, initialScope]);

  const headerConfig = useMemo(
    () => ({
      action: null,
      description: "Review, filter, and manage user accounts within your current scope.",
      icon: <UserCog className="size-9 text-sidebar-foreground/65" />,
      title: "Manage User Accounts",
    }),
    [],
  );

  return (
    <>
      <DashboardHeaderConfigurator config={headerConfig} />

      <div className="w-full max-w-none sm: md:space-y-4">
        <ManageUserAccountsFilters
          action={createUserAction}
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
