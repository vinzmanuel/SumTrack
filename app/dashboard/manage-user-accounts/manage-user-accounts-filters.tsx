"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  action?: ReactNode;
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
  action,
}: ManageUserAccountsFiltersProps) {
  const controlClassName = "!h-11 rounded-md bg-white py-0 text-sm dark:bg-background";

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="relative w-full xl:w-[360px] xl:shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground/70" />
        <Input
          aria-label="Search users"
          className={`${controlClassName} pl-10 placeholder:text-muted-foreground/75`}
          id="accountSearch"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search full name or company ID"
          value={selectedSearchQuery}
        />
      </div>

      <div className="flex w-full flex-wrap items-center gap-2.5 xl:w-auto xl:justify-end">
        {canChooseBranch ? (
          <Select
            onValueChange={(value) => onBranchChange(value === "__all" ? null : Number(value))}
            value={selectedBranchId ? String(selectedBranchId) : "__all"}
          >
            <SelectTrigger
              aria-label="Branch"
              className={`${controlClassName} w-full min-w-[180px] sm:w-[190px]`}
              id="branchId"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Branch</SelectLabel>
                <SelectItem value="__all">{allBranchLabel}</SelectItem>
                {branches.map((item) => (
                  <SelectItem key={item.branchId} value={String(item.branchId)}>
                    {item.branchName}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}

        {showAreaFilter ? (
          <Select
            onValueChange={(value) => onAreaChange(value === "__all" ? null : Number(value))}
            value={selectedAreaId ? String(selectedAreaId) : "__all"}
          >
            <SelectTrigger
              aria-label="Area"
              className={`${controlClassName} w-full min-w-[160px] sm:w-[170px]`}
              id="areaId"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Area</SelectLabel>
                <SelectItem value="__all">All areas</SelectItem>
                {areas.map((item) => (
                  <SelectItem key={item.areaId} value={String(item.areaId)}>
                    {item.areaCode}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}

        <Select
          onValueChange={(value) => onRoleChange(value === "__all" ? null : value)}
          value={selectedRoleName ?? "__all"}
        >
          <SelectTrigger
            aria-label="Role"
            className={`${controlClassName} w-full min-w-[160px] sm:w-[170px]`}
            id="roleName"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Role</SelectLabel>
              <SelectItem value="__all">All roles</SelectItem>
              {roles.map((item) => (
                <SelectItem key={item.roleName} value={item.roleName}>
                  {item.roleName}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Button
          className={`${controlClassName} px-4`}
          onClick={onClear}
          type="button"
          variant="outline"
        >
          Clear
        </Button>
        {action}
      </div>
    </div>
  );
}
