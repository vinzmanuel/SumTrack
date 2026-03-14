"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteAccountButton } from "@/app/dashboard/manage-user-accounts/delete-account-button";
import { ToggleAccountStatusButton } from "@/app/dashboard/manage-user-accounts/toggle-account-status-button";
import type { ManagedUserListRow } from "@/app/dashboard/manage-user-accounts/types";
import { getManagedUserViewHref } from "@/app/dashboard/manage-user-accounts/view-routes";

function roleBadgeClass(roleName: string) {
  if (roleName === "Admin") return "border-red-200 bg-red-50 text-red-700";
  if (roleName === "Auditor") return "border-blue-200 bg-blue-50 text-blue-700";
  if (roleName === "Branch Manager") return "border-amber-200 bg-amber-50 text-amber-700";
  if (roleName === "Secretary") return "border-violet-200 bg-violet-50 text-violet-700";
  if (roleName === "Collector") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (roleName === "Borrower") return "border-zinc-200 bg-zinc-50 text-zinc-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

function statusBadgeClass(status: "active" | "inactive") {
  return status === "active"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
}

export function ManageUserAccountsTable({
  users,
  onDeleted,
  onEdit,
}: {
  users: ManagedUserListRow[];
  onDeleted: () => void;
  onEdit: (userId: string) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const returnTo = query ? `${pathname}?${query}` : pathname;

  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">No user accounts found for your scope.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1280px] text-sm">
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
          {users.map((row) => (
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
              <td className="px-2 py-3 text-muted-foreground">{row.contactNo || "—"}</td>
              <td className="px-2 py-3 text-muted-foreground">{row.email || "—"}</td>
              <td className="px-2 py-3">
                <div className="flex flex-wrap gap-2">
                  {row.canView ? (
                    <Link href={getManagedUserViewHref(row, { returnTo, source: "manage-users" })}>
                      <Button
                        className="bg-white text-slate-700 hover:bg-slate-100"
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
                      userId={row.userId}
                      userLabel={row.fullName}
                    />
                  ) : null}
                  {row.canDelete ? (
                    <DeleteAccountButton onDeleted={onDeleted} userId={row.userId} userLabel={row.fullName} />
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
