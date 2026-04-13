"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, MoreHorizontal, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CollectorLiveLoanReassignmentDialog,
  type CollectorReassignmentRequest,
} from "@/app/dashboard/manage-user-accounts/collector-live-loan-reassignment-dialog";
import { ManagedUserAccountEditModal } from "@/app/dashboard/manage-user-accounts/managed-user-account-edit-modal";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getManagedUserViewHref } from "@/app/dashboard/manage-user-accounts/view-routes";
import {
  UI_CONTROL_CLASS_NAME,
  UI_FILTER_STACK_CLASS_NAME,
  UI_PAGINATION_CONTAINER_CLASS_NAME,
  UI_PAGINATION_TEXT_CLASS_NAME,
  UI_SEARCH_CONTAINER_CLASS_NAME,
  UI_SEARCH_ICON_CLASS_NAME,
  UI_SEARCH_INPUT_CLASS_NAME,
  UI_TABLE_HEADER_ROW_CLASS_NAME,
  UI_TABLE_ROW_HOVER_CLASS_NAME,
  UI_TABLE_WRAPPER_CLASS_NAME,
  getUiRoleBadgeClassName,
} from "@/app/dashboard/_components/ui-patterns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  ManagedCollectorReassignmentRequiredPayload,
} from "@/app/dashboard/manage-user-accounts/types";
import type { BranchEmployeesTabData } from "@/app/dashboard/branches/types";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function statusBadgeClass(status: "active" | "inactive") {
  return status === "active"
    ? "rounded-md border-emerald-200 bg-emerald-50 py-1 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
    : "rounded-md border-amber-200 bg-amber-50 py-1 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
}

function roleSortOrder(roleName: string) {
  if (roleName === "Branch Manager") return 1;
  if (roleName === "Auditor") return 2;
  if (roleName === "Secretary") return 3;
  if (roleName === "Collector") return 4;
  return 99;
}

function rowActionItemClassName(tone: "default" | "blue") {
  if (tone === "blue") {
    return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-blue-600 hover:text-blue-600 outline-hidden transition-colors hover:bg-blue-50 focus:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10 dark:focus:bg-blue-500/10";
  }

  return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-foreground outline-hidden transition-colors hover:bg-accent focus:bg-accent";
}

export function BranchEmployeesTab({
  canManageEmployees,
  data,
}: {
  canManageEmployees: boolean;
  data: BranchEmployeesTabData;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [reassignmentRequest, setReassignmentRequest] = useState<CollectorReassignmentRequest | null>(null);

  const returnTo = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "employees");
    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [pathname, searchParams]);

  const roleOptions = useMemo(
    () => Array.from(new Set(data.employees.map((employee) => employee.roleName))),
    [data.employees],
  );

  const filteredEmployees = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const rows = data.employees.filter((employee) => {
      if (roleFilter !== "all" && employee.roleName !== roleFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        employee.fullName,
        employee.companyId,
        employee.roleName,
        employee.scopeLabel,
        employee.contactNo ?? "",
        employee.email ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    return rows.sort((left, right) => {
      const roleDiff = roleSortOrder(left.roleName) - roleSortOrder(right.roleName);
      if (roleDiff !== 0) {
        return roleDiff;
      }

      return left.fullName.localeCompare(right.fullName);
    });
  }, [data.employees, query, roleFilter]);

  const totalPages = Math.max(Math.ceil(filteredEmployees.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredEmployees.slice((safePage - 1) * pageSize, safePage * pageSize);

  const showingFrom = filteredEmployees.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingTo = filteredEmployees.length === 0 ? 0 : Math.min(safePage * pageSize, filteredEmployees.length);

  function handleReassignmentRequired(
    blocked: ManagedCollectorReassignmentRequiredPayload,
    retryAction: () => Promise<void>,
  ) {
    setReassignmentRequest({
      blocked,
      retryAction,
    });
  }

  return (
    <>
      <div className={UI_FILTER_STACK_CLASS_NAME}>
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-start">
          <div className={UI_SEARCH_CONTAINER_CLASS_NAME}>
            <Search className={UI_SEARCH_ICON_CLASS_NAME} />
            <Input
              className={UI_SEARCH_INPUT_CLASS_NAME}
              id="branchEmployeeSearch"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search employee name, company ID, or scope"
              value={query}
            />
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
            <Select
              onValueChange={(value) => {
                setRoleFilter(value);
                setPage(1);
              }}
              value={roleFilter}
            >
              <SelectTrigger className={`${UI_CONTROL_CLASS_NAME} w-full min-w-[180px]`} id="branchEmployeeRole">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  <SelectLabel>Role</SelectLabel>
                  <SelectItem value="all">All roles</SelectItem>
                  {roleOptions.map((roleName) => (
                    <SelectItem key={roleName} value={roleName}>
                      {roleName}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {pageRows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/80 bg-muted/15 px-5 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No employees match the current branch filters.</p>
            <p className="mt-1 text-sm text-muted-foreground">Try another search term or role.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={UI_TABLE_WRAPPER_CLASS_NAME}>
              <table className="w-full min-w-[1160px] text-sm">
                <thead>
                  <tr className={`${UI_TABLE_HEADER_ROW_CLASS_NAME} border-b text-left`}>
                    <th className="px-4 py-3 font-medium">Full Name</th>
                    <th className="px-4 py-3 font-medium">Company ID</th>
                    <th className="px-4 py-3 font-medium">Role</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Branch / Scope</th>
                    <th className="px-4 py-3 font-medium">Contact No.</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr className={`${UI_TABLE_ROW_HOVER_CLASS_NAME} border-b`} key={row.userId}>
                      <td className="px-4 py-3 font-medium">{row.fullName}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className="rounded-md border-zinc-200 bg-zinc-50 py-1 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100"
                          variant="outline"
                        >
                          {row.companyId}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={getUiRoleBadgeClassName(row.roleName)} variant="outline">
                          {row.roleName}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={statusBadgeClass(row.status)} variant="outline">
                          {row.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{row.scopeLabel}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.contactNo || "N/A"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.email || "N/A"}</td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              className="h-9 w-9 rounded-md border-0 bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground dark:bg-transparent dark:hover:bg-white/[0.08]"
                              size="icon"
                              type="button"
                              variant="ghost"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open actions for {row.fullName}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 rounded-xl p-1.5">
                            {row.canView ? (
                              <DropdownMenuItem asChild className={rowActionItemClassName("default")}>
                                <Link href={getManagedUserViewHref(row, { returnTo, source: "branches" })}>View</Link>
                              </DropdownMenuItem>
                            ) : null}
                            {canManageEmployees && row.canEdit ? (
                              <DropdownMenuItem asChild className={rowActionItemClassName("blue")}>
                                <button onClick={() => setEditingUserId(row.userId)} type="button">
                                  Edit
                                </button>
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={UI_PAGINATION_CONTAINER_CLASS_NAME}>
              <div className="flex flex-col gap-3 text-sm xl:flex-row xl:items-center xl:justify-between">
                <p className={UI_PAGINATION_TEXT_CLASS_NAME}>
                  Showing {showingFrom}-{showingTo} of {filteredEmployees.length}
                </p>
                <div className="flex flex-wrap items-center gap-2 xl:justify-center">
                  <div className="flex items-center gap-2">
                    <span className={UI_PAGINATION_TEXT_CLASS_NAME}>Rows</span>
                    <Select
                      onValueChange={(value) => {
                        setPageSize(Number(value));
                        setPage(1);
                      }}
                      value={String(pageSize)}
                    >
                      <SelectTrigger className={`${UI_CONTROL_CLASS_NAME} w-[84px]`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Rows</SelectLabel>
                          {PAGE_SIZE_OPTIONS.map((option) => (
                            <SelectItem key={option} value={String(option)}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="ml-4 flex items-center gap-2">
                    <span className={UI_PAGINATION_TEXT_CLASS_NAME}>
                      Page {safePage} of {totalPages}
                    </span>
                    <Button
                      className="h-9 w-9 rounded-md"
                      disabled={safePage <= 1}
                      onClick={() => setPage((current) => Math.max(current - 1, 1))}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span className="sr-only">Previous page</span>
                    </Button>
                    <Button
                      className="h-9 w-9 rounded-md"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <ChevronRight className="h-4 w-4" />
                      <span className="sr-only">Next page</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ManagedUserAccountEditModal
        mode="staffing"
        onOpenChange={(open) => {
          if (!open) {
            setEditingUserId(null);
          }
        }}
        onSaved={() => {
          router.refresh();
        }}
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
