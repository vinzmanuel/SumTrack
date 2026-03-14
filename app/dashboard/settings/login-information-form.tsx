"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateSelfPasswordAction, updateSelfUsernameAction } from "@/app/dashboard/settings/actions";
import {
  initialSettingsFormState,
} from "@/app/dashboard/settings/state";

function UpdateUsernameButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={pending} type="submit">
      {pending ? "Updating..." : "Update Username"}
    </Button>
  );
}

function ChangePasswordButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={pending} type="submit">
      {pending ? "Updating..." : "Change Password"}
    </Button>
  );
}

export function LoginInformationForm({ username }: { username: string }) {
  const [usernameState, usernameAction] = useActionState(
    updateSelfUsernameAction,
    initialSettingsFormState,
  );
  const [passwordState, passwordAction] = useActionState(
    updateSelfPasswordAction,
    initialSettingsFormState,
  );
  const lastUsernameSuccessRef = useRef<string | null>(null);
  const lastPasswordSuccessRef = useRef<string | null>(null);

  useEffect(() => {
    if (usernameState.status !== "success") {
      return;
    }

    if (lastUsernameSuccessRef.current === usernameState.message) {
      return;
    }

    lastUsernameSuccessRef.current = usernameState.message;
    toast.success(usernameState.message);
  }, [usernameState.message, usernameState.status]);

  useEffect(() => {
    if (passwordState.status !== "success") {
      return;
    }

    if (lastPasswordSuccessRef.current === passwordState.message) {
      return;
    }

    lastPasswordSuccessRef.current = passwordState.message;
    toast.success(passwordState.message);
  }, [passwordState.message, passwordState.status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Login Information</CardTitle>
        <CardDescription>
          Update your username separately from your password so account details stay distinct from login settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={usernameAction} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="login-username">
              Username
            </label>
            <Input defaultValue={username} id="login-username" name="username" />
            <p className="text-xs text-muted-foreground">
              This is the username you use on the login screen.
            </p>
          </div>

          <div className="flex items-center justify-end">
            <UpdateUsernameButton />
          </div>

          {usernameState.status === "error" ? (
            <p className="text-sm text-destructive">
              {usernameState.message}
            </p>
          ) : null}
        </form>

        <div className="border-t pt-6" />

        <form action={passwordAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="current-password">
                Current Password
              </label>
              <Input id="current-password" name="current_password" type="password" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="new-password">
                New Password
              </label>
              <Input id="new-password" name="new_password" type="password" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="confirm-password">
                Confirm New Password
              </label>
              <Input id="confirm-password" name="confirm_password" type="password" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Enter your current password first. New passwords must be at least 8 characters long.
          </p>

          <div className="flex items-center justify-end">
            <ChangePasswordButton />
          </div>

          {passwordState.status === "error" ? (
            <p className="text-sm text-destructive">
              {passwordState.message}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}
