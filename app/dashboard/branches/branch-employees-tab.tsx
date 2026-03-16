"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getManagedUserViewHref } from "@/app/dashboard/manage-user-accounts/view-routes";
import type { BranchEmployeesTabData } from "@/app/dashboard/branches/types";

const PAGE_SIZE = 8;

function roleBadgeClass(roleName: string) {
  if (roleName === "Auditor") return "border-blue-200 bg-blue-50 text-blue-700";
  if (roleName === "Branch Manager") return "border-amber-200 bg-amber-50 text-amber-700";
  if (roleName === "Secretary") return "border-violet-200 bg-violet-50 text-violet-700";
  if (roleName === "Collector") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

function statusBadgeClass(status: "active" | "inactive") {
  return status === "active"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

function roleSortOrder(roleName: string) {
  if (roleName === "Branch Manager") return 1;
  if (roleName === "Auditor") return 2;
  if (roleName === "Secretary") return 3;
  if (roleName === "Collector") return 4;
  return 99;
}

export function BranchEmployeesTab({ data }: { data: BranchEmployeesTabData }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

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

      if (statusFilter !== "all" && employee.status !== statusFilter) {
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
  }, [data.employees, query, roleFilter, statusFilter]);

  const totalPages = Math.max(Math.ceil(filteredEmployees.length / PAGE_SIZE), 1);
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredEmployees.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const showingFrom = filteredEmployees.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const showingTo = filteredEmployees.length === 0 ? 0 : Math.min(safePage * PAGE_SIZE, filteredEmployees.length);

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="p-0">
        <div className="space-y-3 px-4 pb-3 pt-3 md:px-5 md:pb-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-sm font-medium" htmlFor="branchEmployeeSearch">
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  id="branchEmployeeSearch"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search employee name, company ID, or scope"
                  value={query}
                />
              </div>
            </div>

            <div className="w-full space-y-1 sm:w-52">
              <label className="text-sm font-medium" htmlFor="branchEmployeeRole">
                Role
              </label>
              <Select
                onValueChange={(value) => {
                  setRoleFilter(value);
                  setPage(1);
                }}
                value={roleFilter}
              >
                <SelectTrigger className="w-full" id="branchEmployeeRole">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">All roles</SelectItem>
                  {roleOptions.map((roleName) => (
                    <SelectItem key={roleName} value={roleName}>
                      {roleName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full space-y-1 sm:w-44">
              <label className="text-sm font-medium" htmlFor="branchEmployeeStatus">
                Status
              </label>
              <Select
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
                value={statusFilter}
              >
                <SelectTrigger className="w-full" id="branchEmployeeStatus">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 px-4 pb-4 pt-3 md:px-5 md:pb-5">
          {pageRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/15 px-5 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No employees match the current branch filters.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another search term, role, or status.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-2 py-2.5 font-medium">Full Name</th>
                      <th className="px-2 py-2.5 font-medium">Company ID</th>
                      <th className="px-2 py-2.5 font-medium">Role</th>
                      <th className="px-2 py-2.5 font-medium">Status</th>
                      <th className="px-2 py-2.5 font-medium">Branch / Scope</th>
                      <th className="px-2 py-2.5 font-medium">Contact No.</th>
                      <th className="px-2 py-2.5 font-medium">Email</th>
                      <th className="px-2 py-2.5 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => (
                      <tr className="border-b" key={row.userId}>
                        <td className="px-2 py-3 font-medium">{row.fullName}</td>
                        <td className="px-2 py-3">
                          <Badge className="border-zinc-200 bg-zinc-50 text-zinc-700" variant="outline">
                            {row.companyId}
                          </Badge>
                        </td>
                        <td className="px-2 py-3">
                          <Badge className={roleBadgeClass(row.roleName)} variant="outline">
                            {row.roleName}
                          </Badge>
                        </td>
                        <td className="px-2 py-3">
                          <Badge className={statusBadgeClass(row.status)} variant="outline">
                            {row.status === "active" ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-2 py-3">{row.scopeLabel}</td>
                        <td className="px-2 py-3 text-muted-foreground">{row.contactNo || "N/A"}</td>
                        <td className="px-2 py-3 text-muted-foreground">{row.email || "N/A"}</td>
                        <td className="px-2 py-3">
                          <Link href={getManagedUserViewHref(row, { returnTo, source: "branches" })}>
                            <Button
                              className="bg-white text-slate-700 hover:bg-slate-100"
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t pt-3 text-sm md:flex-row md:items-center md:justify-between">
                <p className="text-muted-foreground">
                  Showing {showingFrom}-{showingTo} of {filteredEmployees.length}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    Page {safePage} of {totalPages}
                  </span>
                  <Button
                    disabled={safePage <= 1}
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
