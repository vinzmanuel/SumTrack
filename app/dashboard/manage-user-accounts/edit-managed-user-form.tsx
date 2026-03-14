"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  initialEditManagedUserState,
  updateManagedUserAccountAction,
} from "@/app/dashboard/manage-user-accounts/actions";
import type { ManagedUserDetail } from "@/app/dashboard/manage-user-accounts/types";

export function EditManagedUserForm({ detail }: { detail: ManagedUserDetail }) {
  const [state, formAction] = useActionState(updateManagedUserAccountAction, initialEditManagedUserState);

  return (
    <form action={formAction} className="space-y-6">
      <input name="user_id" type="hidden" value={detail.userId} />
      <input name="role_id" type="hidden" value={String(detail.roleId)} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <Input defaultValue={detail.email ?? ""} id="email" name="email" type="email" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="contact_no">
            Contact Number
          </label>
          <Input defaultValue={detail.contactNo ?? ""} id="contact_no" name="contact_no" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="first_name">
            First Name
          </label>
          <Input defaultValue={detail.firstName} id="first_name" name="first_name" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="middle_name">
            Middle Name
          </label>
          <Input defaultValue={detail.middleName} id="middle_name" name="middle_name" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="last_name">
            Last Name
          </label>
          <Input defaultValue={detail.lastName} id="last_name" name="last_name" required />
        </div>
      </div>

      {state.status === "error" ? <p className="text-sm text-destructive">{state.message}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit">Save Changes</Button>
        <Link href={`/dashboard/manage-user-accounts/${detail.userId}`}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
