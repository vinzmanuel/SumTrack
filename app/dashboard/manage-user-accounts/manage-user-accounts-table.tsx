"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteAccountButton } from "@/app/dashboard/manage-user-accounts/delete-account-button";
import { ToggleAccountStatusButton } from "@/app/dashboard/manage-user-accounts/toggle-account-status-button";
import type {
  ManagedCollectorReassignmentRequiredPayload,
  ManagedUserListRow,
} from "@/app/dashboard/manage-user-accounts/types";
import { getManagedUserViewHref } from "@/app/dashboard/manage-user-accounts/view-routes";

const headerRowClassName = "border-border/70 bg-card";

function roleBadgeClass(roleName: string) {
  if (roleName === "Admin") return "whitespace-nowrap rounded-md border-0 bg-red-50 py-1 text-red-700 dark:bg-red-500/10 dark:text-red-300";
  if (roleName === "Auditor") return "whitespace-nowrap rounded-md border-0 bg-blue-50 py-1 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300";
  if (roleName === "Branch Manager") return "whitespace-nowrap rounded-md border-0 bg-amber-50 py-1 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
  if (roleName === "Secretary") return "whitespace-nowrap rounded-md border-0 bg-violet-50 py-1 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300";
  if (roleName === "Collector") return "whitespace-nowrap rounded-md border-0 bg-emerald-50 py-1 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (roleName === "Borrower") return "whitespace-nowrap rounded-md border-0 bg-zinc-50 py-1 text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-100";
  return "whitespace-nowrap rounded-md border-zinc-200 bg-zinc-50 text-zinc-700 dark:bg-white/[0.₀6] dark:text-zinc-1₀₀";
}

export function ManageUserAccountsTable({
  users,
  onDeleted,
  onEdit,
  onReassignmentRequired,
}: {
  users: ManagedUserListRow[];
  onDeleted: () => void;
  onEdit: (userId: string) => void;
  onReassignmentRequired: (
    blocked: ManagedCollectorReassignmentRequiredPayload,
    retryAction: () => Promise<void>,
  ) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const returnTo = query ? `${pathname}?${query}` : pathname;

  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">No user accounts found for your scope.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border/70 bg-card shadow-sm">
      <Table className="min-w-[1180px] text-sm">
        <TableHeader>
          <TableRow className={headerRowClassName}>
            <TableHead className="h-auto py-3 pl-5">Full Name</TableHead>
            <TableHead className="h-auto py-3">Company ID</TableHead>
            <TableHead className="h-auto py-3">Role</TableHead>
            <TableHead className="h-auto py-3">Branch / Scope</TableHead>
            <TableHead className="h-auto py-3">Contact No.</TableHead>
            <TableHead className="h-auto py-3">Email</TableHead>
            <TableHead className="h-auto py-3">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((row) => (
            <TableRow key={row.userId}>
              <TableCell className="py-3 pl-5 font-medium">{row.displayName}</TableCell>
              <TableCell className="py-3">
                <Badge
                  className="whitespace-nowrap rounded-md border-0 bg-zinc-100/65 py-1 text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-100"
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
              <TableCell className="py-3">
                <div className="flex flex-wrap gap-2">
                  {row.canView ? (
                    <Link href={getManagedUserViewHref(row, { returnTo, source: "manage-users" })}>
                      <Button
                        className="bg-card text-foreground hover:bg-accent dark:border-white/12 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        View
                      </Button>
                    </Link>
                  ) : null}
                  {row.canEdit ? (
                    <Button
                      className="bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() => onEdit(row.userId)}
                      size="sm"
                      type="button"
                    >
                      Edit
                    </Button>
                  ) : null}
                  {row.canManageStatus ? (
                    <ToggleAccountStatusButton
                      currentStatus={row.status}
                      onStatusChanged={onDeleted}
                      onReassignmentRequired={onReassignmentRequired}
                      userId={row.userId}
                      userLabel={row.fullName}
                    />
                  ) : null}
                  {row.canDelete ? (
                    <DeleteAccountButton
                      onDeleted={onDeleted}
                      onReassignmentRequired={onReassignmentRequired}
                      userId={row.userId}
                      userLabel={row.fullName}
                    />
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
