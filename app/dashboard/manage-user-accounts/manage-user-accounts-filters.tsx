"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  ManagedUserAreaOption,
  ManagedUserBranchOption,
  ManagedUserRoleOption,
} from "@/app/dashboard/manage-user-accounts/types";

type ManageUserAccountsFiltersProps = {
  canChooseBranch: boolean;
  showAreaFilter: boolean;
  selectedBranchId: number | null;
  selectedAreaId: number | null;
  selectedRoleName: string | null;
  selectedSearchQuery: string;
  branches: ManagedUserBranchOption[];
  areas: ManagedUserAreaOption[];
  roles: ManagedUserRoleOption[];
  allBranchLabel: string;
  onBranchChange: (branchId: number | null) => void;
  onAreaChange: (areaId: number | null) => void;
  onRoleChange: (roleName: string | null) => void;
  onSearchChange: (query: string) => void;
  onClear: () => void;
};

export function ManageUserAccountsFilters({
  canChooseBranch,
  showAreaFilter,
  selectedBranchId,
  selectedAreaId,
  selectedRoleName,
  selectedSearchQuery,
  branches,
  areas,
  roles,
  allBranchLabel,
  onBranchChange,
  onAreaChange,
  onRoleChange,
  onSearchChange,
  onClear,
}: ManageUserAccountsFiltersProps) {
  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div className={`grid flex-1 gap-3 ${showAreaFilter ? "md:grid-cols-5" : canChooseBranch ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="accountSearch">
            Search
          </Label>
          <Input
            id="accountSearch"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search full name, username, or company ID"
            value={selectedSearchQuery}
          />
        </div>

        {canChooseBranch ? (
          <div className="space-y-1">
            <Label htmlFor="branchId">
              Branch
            </Label>
            <Select
              onValueChange={(value) => onBranchChange(value === "__all" ? null : Number(value))}
              value={selectedBranchId ? String(selectedBranchId) : "__all"}
            >
              <SelectTrigger className="w-full" id="branchId">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{allBranchLabel}</SelectItem>
                {branches.map((item) => (
                  <SelectItem key={item.branchId} value={String(item.branchId)}>
                    {item.branchName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {showAreaFilter ? (
          <div className="space-y-1">
            <Label htmlFor="areaId">
              Area
            </Label>
            <Select
              onValueChange={(value) => onAreaChange(value === "__all" ? null : Number(value))}
              value={selectedAreaId ? String(selectedAreaId) : "__all"}
            >
              <SelectTrigger className="w-full" id="areaId">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All areas</SelectItem>
                {areas.map((item) => (
                  <SelectItem key={item.areaId} value={String(item.areaId)}>
                    {item.areaCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="space-y-1">
          <Label htmlFor="roleName">
            Role
          </Label>
          <Select
            onValueChange={(value) => onRoleChange(value === "__all" ? null : value)}
            value={selectedRoleName ?? "__all"}
          >
            <SelectTrigger className="w-full" id="roleName">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All roles</SelectItem>
              {roles.map((item) => (
                <SelectItem key={item.roleName} value={item.roleName}>
                  {item.roleName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-end">
        <Button onClick={onClear} size="sm" type="button" variant="outline">
          Clear
        </Button>
      </div>
    </div>
  );
}
