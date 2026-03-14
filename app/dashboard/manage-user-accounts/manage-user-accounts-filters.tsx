"use client";

import type { ReactNode } from "react";
import type {
  ManageUserAccountStatus,
  ManagedUserAreaOption,
  ManagedUserBranchOption,
  ManagedUserRoleOption,
} from "@/app/dashboard/manage-user-accounts/types";

type ManageUserAccountsFiltersProps = {
  canChooseBranch: boolean;
  showAreaFilter: boolean;
  selectedStatus: ManageUserAccountStatus;
  selectedBranchId: number | null;
  selectedAreaId: number | null;
  selectedRoleName: string | null;
  selectedSearchQuery: string;
  branches: ManagedUserBranchOption[];
  areas: ManagedUserAreaOption[];
  roles: ManagedUserRoleOption[];
  activeCount: number;
  inactiveCount: number;
  allBranchLabel: string;
  isPending: boolean;
  onStatusChange: (status: ManageUserAccountStatus) => void;
  onBranchChange: (branchId: number | null) => void;
  onAreaChange: (areaId: number | null) => void;
  onRoleChange: (roleName: string | null) => void;
  onSearchChange: (query: string) => void;
  action?: ReactNode;
};

export function ManageUserAccountsFilters({
  canChooseBranch,
  showAreaFilter,
  selectedStatus,
  selectedBranchId,
  selectedAreaId,
  selectedRoleName,
  selectedSearchQuery,
  branches,
  areas,
  roles,
  activeCount,
  inactiveCount,
  allBranchLabel,
  isPending,
  onStatusChange,
  onBranchChange,
  onAreaChange,
  onRoleChange,
  onSearchChange,
  action,
}: ManageUserAccountsFiltersProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        <button
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            selectedStatus === "active"
              ? "border-emerald-600 bg-emerald-50 text-emerald-700"
              : "border-border bg-background text-muted-foreground hover:bg-muted/40"
          }`}
          onClick={() => onStatusChange("active")}
          type="button"
        >
          Active ({activeCount})
        </button>
        <button
          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
            selectedStatus === "inactive"
              ? "border-amber-600 bg-amber-50 text-amber-700"
              : "border-border bg-background text-muted-foreground hover:bg-muted/40"
          }`}
          onClick={() => onStatusChange("inactive")}
          type="button"
        >
          Inactive ({inactiveCount})
        </button>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className={`grid flex-1 gap-3 ${showAreaFilter ? "md:grid-cols-5" : canChooseBranch ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium" htmlFor="accountSearch">
              Search
            </label>
            <input
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              id="accountSearch"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search full name, username, or company ID"
              value={selectedSearchQuery}
            />
          </div>

          {canChooseBranch ? (
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="branchId">
                Branch
              </label>
              <select
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
                id="branchId"
                onChange={(event) => onBranchChange(event.target.value ? Number(event.target.value) : null)}
                value={selectedBranchId ? String(selectedBranchId) : ""}
              >
                <option value="">{allBranchLabel}</option>
                {branches.map((item) => (
                  <option key={item.branchId} value={String(item.branchId)}>
                    {item.branchName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {showAreaFilter ? (
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="areaId">
                Area
              </label>
              <select
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
                id="areaId"
                onChange={(event) => onAreaChange(event.target.value ? Number(event.target.value) : null)}
                value={selectedAreaId ? String(selectedAreaId) : ""}
              >
                <option value="">All areas</option>
                {areas.map((item) => (
                  <option key={item.areaId} value={String(item.areaId)}>
                    {item.areaCode}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="roleName">
              Role
            </label>
            <select
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
              id="roleName"
              onChange={(event) => onRoleChange(event.target.value || null)}
              value={selectedRoleName ?? ""}
            >
              <option value="">All roles</option>
              {roles.map((item) => (
                <option key={item.roleName} value={item.roleName}>
                  {item.roleName}
                </option>
                ))}
              </select>
          </div>
        </div>

        {action ? <div className="shrink-0 xl:self-end">{action}</div> : null}
      </div>

      {isPending ? <p className="text-muted-foreground text-sm">Updating user accounts...</p> : null}
    </div>
  );
}
