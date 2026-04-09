"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteAccountButton } from "@/app/dashboard/manage-user-accounts/delete-account-button";
import { ToggleAccountStatusButton } from "@/app/dashboard/manage-user-accounts/toggle-account-status-button";
import type {
  ManagedCollectorReassignmentRequiredPayload,
  ManageUserAccountsSort,
  ManagedUserListRow,
} from "@/app/dashboard/manage-user-accounts/types";
import { getManagedUserViewHref } from "@/app/dashboard/manage-user-accounts/view-routes";

const headerRowClassName = "border-border/70 bg-card";

const manageUserDateFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function roleBadgeClass(roleName: string) {
  if (roleName === "Admin") return "whitespace-nowrap rounded-md border border-red-200 bg-red-50 py-1 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300";
  if (roleName === "Auditor") return "whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 py-1 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300";
  if (roleName === "Branch Manager") return "whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 py-1 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
  if (roleName === "Secretary") return "whitespace-nowrap rounded-md border border-violet-200 bg-violet-50 py-1 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300";
  if (roleName === "Collector") return "whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 py-1 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (roleName === "Borrower") return "whitespace-nowrap rounded-md border border-zinc-200 bg-zinc-50 py-1 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100";
  return "whitespace-nowrap rounded-md border border-zinc-200 bg-zinc-50 py-1 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100";
}

function formatDateCreated(value: string | null) {
  if (!value) {
    return "-";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return manageUserDateFormatter.format(parsedDate);
}

function rowActionItemClassName(tone: "default" | "blue" | "amber" | "red" | "green") {
  if (tone === "blue") {
    return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-blue-600 outline-hidden transition-colors hover:bg-blue-50 focus:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-500/10 dark:focus:bg-blue-500/10";
  }

  if (tone === "amber") {
    return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-amber-600 outline-hidden transition-colors hover:bg-amber-50 focus:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10 dark:focus:bg-amber-500/10";
  }

  if (tone === "red") {
    return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 outline-hidden transition-colors hover:bg-red-50 focus:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10 dark:focus:bg-red-500/10";
  }

  if (tone === "green") {
    return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-emerald-600 outline-hidden transition-colors hover:bg-emerald-50 focus:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:focus:bg-emerald-500/10";
  }

  return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-foreground outline-hidden transition-colors hover:bg-accent focus:bg-accent";
}

function getNextSort(currentSort: ManageUserAccountsSort, field: "name" | "role" | "date_created") {
  if (field === "name") {
    return currentSort === "name_asc" ? "name_desc" : "name_asc";
  }

  if (field === "date_created") {
    return currentSort === "date_created_asc" ? "date_created_desc" : "date_created_asc";
  }

  return currentSort === "role_asc" ? "role_desc" : "role_asc";
}

function SortIcon({
  activeSort,
  field,
}: {
  activeSort: ManageUserAccountsSort;
  field: "name" | "role" | "date_created";
}) {
  const isAsc = activeSort === `${field}_asc`;
  const isDesc = activeSort === `${field}_desc`;

  if (isAsc) {
    return <ArrowUp className="h-4 w-4" />;
  }

  if (isDesc) {
    return <ArrowDown className="h-4 w-4" />;
  }

  return <ArrowUpDown className="h-4 w-4" />;
}

function SortableHeader({
  label,
  field,
  selectedSort,
  onSortChange,
}: {
  label: string;
  field: "name" | "role" | "date_created";
  selectedSort: ManageUserAccountsSort;
  onSortChange: (sort: ManageUserAccountsSort) => void;
}) {
  const isActive = selectedSort === `${field}_asc` || selectedSort === `${field}_desc`;

  return (
    <Button
      className={`-ml-3 h-auto gap-1.5 px-3 py-1.5 text-sm font-semibold ${
        isActive ? "text-foreground" : "text-muted-foreground"
      }`}
      onClick={() => onSortChange(getNextSort(selectedSort, field))}
      size="sm"
      type="button"
      variant="ghost"
    >
      <span>{label}</span>
      <SortIcon activeSort={selectedSort} field={field} />
    </Button>
  );
}

export function ManageUserAccountsTable({
  users,
  onDeleted,
  onEdit,
  onReassignmentRequired,
  onSortChange,
  selectedSort,
}: {
  users: ManagedUserListRow[];
  onDeleted: () => void;
  onEdit: (userId: string) => void;
  onReassignmentRequired: (
    blocked: ManagedCollectorReassignmentRequiredPayload,
    retryAction: () => Promise<void>,
  ) => void;
  onSortChange: (sort: ManageUserAccountsSort) => void;
  selectedSort: ManageUserAccountsSort;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const returnTo = query ? `${pathname}?${query}` : pathname;

  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">No user accounts found for your scope.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border/70 bg-card shadow-sm">
      <Table className="min-w-[1280px] text-sm">
        <TableHeader>
          <TableRow className={headerRowClassName}>
            <TableHead className="h-auto py-3 pl-5">
              <SortableHeader
                field="name"
                label="Full Name"
                onSortChange={onSortChange}
                selectedSort={selectedSort}
              />
            </TableHead>
            <TableHead className="h-auto py-3">Company ID</TableHead>
            <TableHead className="h-auto py-3">
              <SortableHeader
                field="role"
                label="Role"
                onSortChange={onSortChange}
                selectedSort={selectedSort}
              />
            </TableHead>
            <TableHead className="h-auto py-3">Branch / Scope</TableHead>
            <TableHead className="h-auto py-3">Contact No.</TableHead>
            <TableHead className="h-auto py-3">Email</TableHead>
            <TableHead className="h-auto py-3">
              <SortableHeader
                field="date_created"
                label="Date Created"
                onSortChange={onSortChange}
                selectedSort={selectedSort}
              />
            </TableHead>
            <TableHead className="h-auto py-3">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((row) => {
            const deactivateTone = row.status === "active" ? "amber" : "green";
            const deactivateLabel = row.status === "active" ? "Deactivate" : "Reactivate";
            const viewHref = getManagedUserViewHref(row, { returnTo, source: "manage-users" });

            return (
              <TableRow
                className={row.canView ? "cursor-pointer transition-colors hover:bg-accent/35" : undefined}
                key={row.userId}
                onClick={() => {
                  if (row.canView) {
                    router.push(viewHref);
                  }
                }}
                onKeyDown={(event) => {
                  if (!row.canView) {
                    return;
                  }

                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(viewHref);
                  }
                }}
                tabIndex={row.canView ? 0 : undefined}
              >
                <TableCell className="py-3 pl-5 font-medium">{row.displayName}</TableCell>
                <TableCell className="py-3">
                  <Badge
                    className="whitespace-nowrap rounded-md border border-zinc-200 bg-zinc-100/65 py-1 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100"
                    variant="outline"
                  >
                    {row.companyId}
                  </Badge>
                </TableCell>
                <TableCell className="py-3">
                  <Badge className={roleBadgeClass(row.roleName)} variant="outline">
                    {row.roleName}
                  </Badge>
                </TableCell>
                <TableCell className="py-3">
                  <div className="space-y-0.5">
                    <p>{row.scopeLabel}</p>
                    {row.scopeContextLabel ? (
                      <p className="text-xs text-muted-foreground">{row.scopeContextLabel}</p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="py-3 text-muted-foreground">{row.contactNo || "-"}</TableCell>
                <TableCell className="py-3 text-muted-foreground">{row.email || "-"}</TableCell>
                <TableCell className="py-3 text-muted-foreground">{formatDateCreated(row.dateCreated)}</TableCell>
                <TableCell
                  className="py-3"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="h-9 w-9 rounded-md border-0 bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground dark:bg-transparent dark:hover:bg-white/[0.08]"
                        onClick={(event) => event.stopPropagation()}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open actions for {row.displayName}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
                      {row.canView ? (
                        <DropdownMenuItem asChild className={rowActionItemClassName("default")}>
                          <button
                            onClick={() => router.push(viewHref)}
                            type="button"
                          >
                            View
                          </button>
                        </DropdownMenuItem>
                      ) : null}
                      {row.canEdit ? (
                        <DropdownMenuItem asChild className={rowActionItemClassName("blue")}>
                          <button onClick={() => onEdit(row.userId)} type="button">
                            Edit
                          </button>
                        </DropdownMenuItem>
                      ) : null}
                      {row.canManageStatus ? (
                        <ToggleAccountStatusButton
                          currentStatus={row.status}
                          onStatusChanged={onDeleted}
                          onReassignmentRequired={onReassignmentRequired}
                          trigger={
                            <button className={rowActionItemClassName(deactivateTone)} type="button">
                              {deactivateLabel}
                            </button>
                          }
                          userId={row.userId}
                          userLabel={row.fullName}
                        />
                      ) : null}
                      {row.canDelete ? (
                        <DeleteAccountButton
                          onDeleted={onDeleted}
                          onReassignmentRequired={onReassignmentRequired}
                          trigger={
                            <button className={rowActionItemClassName("red")} type="button">
                              Delete
                            </button>
                          }
                          userId={row.userId}
                          userLabel={row.fullName}
                        />
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
