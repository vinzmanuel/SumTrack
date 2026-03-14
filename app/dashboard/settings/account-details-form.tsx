"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { updateSelfAccountDetailsAction } from "@/app/dashboard/settings/actions";
import { initialSettingsFormState } from "@/app/dashboard/settings/state";
import type { SelfProfileDetail } from "@/app/dashboard/settings/types";

function SaveDetailsButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={pending} type="submit">
      {pending ? "Saving..." : "Save Account Details"}
    </Button>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

export function AccountDetailsForm({
  profile,
  canRequireContactNo,
}: {
  profile: SelfProfileDetail;
  canRequireContactNo: boolean;
}) {
  const [state, formAction] = useActionState(updateSelfAccountDetailsAction, initialSettingsFormState);

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-zinc-200 bg-zinc-50 text-zinc-700" variant="outline">
            {profile.companyId}
          </Badge>
          <Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">
            {profile.roleName}
          </Badge>
          <Badge
            className={
              profile.status === "active"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }
            variant="outline"
          >
            {profile.status === "active" ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            Review your account information. Contact number and email can be updated here.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-full-name">
                Full Name
              </label>
              <Input id="profile-full-name" readOnly value={profile.fullName} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-company-id">
                Company ID
              </label>
              <Input id="profile-company-id" readOnly value={profile.companyId} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-role">
                Role
              </label>
              <Input id="profile-role" readOnly value={profile.roleName} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-scope">
                Branch / Area / Scope
              </label>
              <Input id="profile-scope" readOnly value={profile.scopeLabel} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-status">
                Status
              </label>
              <Input id="profile-status" readOnly value={profile.status === "active" ? "Active" : "Inactive"} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-date-created">
                Date Created
              </label>
              <Input id="profile-date-created" readOnly value={formatDate(profile.dateCreated)} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-contact-no">
                Contact No.
              </label>
              <Input
                defaultValue={profile.contactNo ?? ""}
                id="profile-contact-no"
                inputMode="numeric"
                maxLength={11}
                name="contact_no"
                placeholder="09XXXXXXXXX"
                required={canRequireContactNo}
              />
              <p className="text-xs text-muted-foreground">
                Use an 11-digit PH mobile number starting with 09.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-email">
                Email
              </label>
              <Input
                defaultValue={profile.email ?? ""}
                id="profile-email"
                name="email"
                placeholder="name@example.com"
                type="email"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Company ID, role, status, and assignment details are managed by authorized staff.
            </p>
            <SaveDetailsButton />
          </div>

          {state.status !== "idle" ? (
            <p className={state.status === "error" ? "text-sm text-destructive" : "text-sm text-emerald-700"}>
              {state.message}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
