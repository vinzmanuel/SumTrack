"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
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

export function AccountInformationForm({
  profile,
  canRequireContactNo,
}: {
  profile: SelfProfileDetail;
  canRequireContactNo: boolean;
}) {
  const [state, formAction] = useActionState(updateSelfAccountDetailsAction, initialSettingsFormState);
  const lastSuccessMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    if (lastSuccessMessageRef.current === state.message) {
      return;
    }

    lastSuccessMessageRef.current = state.message;
    toast.success(state.message);
  }, [state.message, state.status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Information</CardTitle>
        <CardDescription>
          Update the personal details you are allowed to manage for your own account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-first-name">
                First Name
              </label>
              <Input
                defaultValue={profile.firstName}
                id="profile-first-name"
                name="first_name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-middle-name">
                Middle Name
              </label>
              <Input
                defaultValue={profile.middleName}
                id="profile-middle-name"
                name="middle_name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="profile-last-name">
                Last Name
              </label>
              <Input
                defaultValue={profile.lastName}
                id="profile-last-name"
                name="last_name"
                required
              />
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
              Company ID, role, status, and assignment details remain managed by authorized staff.
            </p>
            <SaveDetailsButton />
          </div>

          {state.status === "error" ? (
            <p className="text-sm text-destructive">
              {state.message}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
