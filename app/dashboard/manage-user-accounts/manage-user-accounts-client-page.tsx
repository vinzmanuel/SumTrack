"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ManageUserAccountsFilters } from "@/app/dashboard/manage-user-accounts/manage-user-accounts-filters";
import { ManagedUserAccountEditModal } from "@/app/dashboard/manage-user-accounts/managed-user-account-edit-modal";
import { ManageUserAccountsModule } from "@/app/dashboard/manage-user-accounts/manage-user-accounts-module";
import {
  canCreateManagedUser,
  type ManageUserAccountStatus,
  type ManageUserAccountsPageData,
  type ManageUserAccountsScope,
} from "@/app/dashboard/manage-user-accounts/types";

type ManageUserFilters = {
  status: ManageUserAccountStatus;
  branchId: number | null;
  areaId: number | null;
  roleName: string | null;
  query: string;
  page: number;
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

  if (filters.query.trim()) {
    params.set("query", filters.query.trim());
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
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

  if (filters.query.trim()) {
    params.set("query", filters.query.trim());
  }

  if (filters.page > 1) {
    params.set("page", String(filters.page));
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
      query: initialScope.searchQuery,
      page: initialData.page,
    }),
    [
      initialData.page,
      initialData.selectedAreaId,
      initialScope.searchQuery,
      initialScope.selectedBranchId,
      initialScope.selectedRoleName,
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
        query: nextFilters.query,
        page: nextData.page,
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
      filters.roleName === appliedFilters.roleName
    ) {
      return;
    }

    void loadResults({
      status: filters.status,
      branchId: filters.branchId,
      areaId: filters.areaId,
      roleName: filters.roleName,
      query: filters.query,
      page: 1,
    });
  }, [
    appliedFilters.status,
    appliedFilters.areaId,
    appliedFilters.branchId,
    appliedFilters.roleName,
    filters.status,
    filters.areaId,
    filters.branchId,
    filters.query,
    filters.roleName,
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
        query: filtersRef.current.query,
        page: 1,
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
      query: filtersRef.current.query,
      page,
    });
  }, [loadResults]);

  const handleRowDeleted = useCallback(() => {
    void loadResults({
      status: filtersRef.current.status,
      branchId: filtersRef.current.branchId,
      areaId: filtersRef.current.areaId,
      roleName: filtersRef.current.roleName,
      query: filtersRef.current.query,
      page: filtersRef.current.page,
    });
  }, [loadResults]);

  const showAreaFilter = Boolean(
    filters.branchId && (filters.roleName === "Collector" || filters.roleName === "Borrower"),
  );

  return (
    <>
      <ManageUserAccountsModule
        controls={
          <ManageUserAccountsFilters
            action={
              canCreateManagedUser(initialScope) ? (
                <Link href="/dashboard/create-account">
                  <Button
                    className="w-full bg-emerald-600 text-white hover:bg-emerald-700 xl:w-auto"
                    size="sm"
                    type="button"
                  >
                    Create User
                  </Button>
                </Link>
              ) : null
            }
            activeCount={results.activeCount}
            allBranchLabel={initialScope.allBranchLabel}
            areas={results.areas}
            branches={results.branches}
            canChooseBranch={initialScope.canChooseBranch}
            inactiveCount={results.inactiveCount}
            isPending={isPending}
            onStatusChange={(status) =>
              setFilters((previous) => ({
                ...previous,
                status,
                page: 1,
              }))
            }
            onAreaChange={(areaId) => setFilters((previous) => ({ ...previous, areaId, page: 1 }))}
            onBranchChange={(branchId) =>
              setFilters((previous) => ({
                ...previous,
                branchId,
                areaId: null,
                page: 1,
              }))
            }
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
            selectedStatus={filters.status}
            showAreaFilter={showAreaFilter}
          />
        }
        data={results}
        errorMessage={errorMessage}
        isPending={isPending}
        onDeleted={handleRowDeleted}
        onEdit={setEditingUserId}
        onPageChange={handlePageChange}
        scopeMessage={initialScope.scopeMessage}
      />

      <ManagedUserAccountEditModal
        onOpenChange={(open) => {
          if (!open) {
            setEditingUserId(null);
          }
        }}
        onSaved={handleRowDeleted}
        open={Boolean(editingUserId)}
        userId={editingUserId}
      />
    </>
  );
}
