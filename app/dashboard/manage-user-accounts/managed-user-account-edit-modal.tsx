"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isValidEmailAddress, isValidPhilippineMobile, normalizeAccountContactNo } from "@/app/dashboard/account-field-validation";
import type { ManagedUserDetail } from "@/app/dashboard/manage-user-accounts/types";

type EditFormState = {
  roleId: string;
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  contactNo: string;
};

function toFormState(detail: ManagedUserDetail): EditFormState {
  return {
    roleId: String(detail.roleId),
    email: detail.email ?? "",
    firstName: detail.firstName,
    middleName: detail.middleName,
    lastName: detail.lastName,
    contactNo: detail.contactNo ?? "",
  };
}

export function ManagedUserAccountEditModal({
  onOpenChange,
  onSaved,
  open,
  userId,
}: {
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  open: boolean;
  userId: string | null;
}) {
  const [detail, setDetail] = useState<ManagedUserDetail | null>(null);
  const [formState, setFormState] = useState<EditFormState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setDetail(null);
      setFormState(null);
      setErrorMessage(null);
      setIsLoading(false);
      setIsSaving(false);
    }

    onOpenChange(nextOpen);
  }

  useEffect(() => {
    if (!open || !userId) {
      return;
    }

    const controller = new AbortController();
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`/dashboard/manage-user-accounts/${userId}/data`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load account details.");
        }

        const payload = (await response.json()) as ManagedUserDetail;
        setDetail(payload);
        setFormState(toFormState(payload));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setErrorMessage("Unable to load account details right now.");
        toast.error("Unable to load account details right now.");
      } finally {
        setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [open, userId]);

  async function handleSave() {
    if (!userId || !formState || !detail) {
      return;
    }

    const nextRole = detail.editableRoleOptions.find((item) => String(item.roleId) === formState.roleId);
    const requiresContactNo = detail.roleName === "Borrower" || nextRole?.roleName === "Collector";

    if (!formState.firstName.trim()) {
      setErrorMessage("First name is required.");
      return;
    }

    if (!formState.lastName.trim()) {
      setErrorMessage("Last name is required.");
      return;
    }

    if (requiresContactNo && !formState.contactNo) {
      setErrorMessage("Contact number is required for this account.");
      return;
    }

    if (formState.contactNo && !isValidPhilippineMobile(formState.contactNo)) {
      setErrorMessage("Enter a valid PH mobile number starting with 09.");
      return;
    }

    if (formState.email && !isValidEmailAddress(formState.email)) {
      setErrorMessage("Enter a valid email address.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const response = await fetch(`/dashboard/manage-user-accounts/${userId}/update`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formState),
    });
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      setIsSaving(false);
      const message = payload?.message ?? "Unable to update this account right now.";
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setIsSaving(false);
    toast.success(`Updated ${detail.fullName}.`);
    handleOpenChange(false);
    onSaved();
  }

  const roleOptions = detail?.editableRoleOptions ?? [];
  const showRoleSelector = roleOptions.length > 1;

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit User Account</DialogTitle>
          <DialogDescription>
            Update the allowed profile fields for this user account.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !formState ? (
          <div className="space-y-3">
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="edit-email">
                  Email
                </label>
                <Input
                  id="edit-email"
                  onChange={(event) =>
                    setFormState((previous) => previous ? { ...previous, email: event.target.value } : previous)
                  }
                  type="email"
                  value={formState.email}
                />
              </div>
            </div>

            <div className={`grid gap-4 ${showRoleSelector ? "md:grid-cols-4" : "md:grid-cols-2"}`}>
              {showRoleSelector ? (
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-medium" htmlFor="edit-role">
                    Role
                  </label>
                  <Select
                    onValueChange={(value) =>
                      setFormState((previous) => previous ? { ...previous, roleId: value } : previous)
                    }
                    value={formState.roleId}
                  >
                    <SelectTrigger id="edit-role" className="w-full">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((item) => (
                        <SelectItem key={String(item.roleId)} value={String(item.roleId)}>
                          {item.roleName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className={`space-y-1.5 ${showRoleSelector ? "md:col-span-2" : ""}`}>
                <label className="text-sm font-medium" htmlFor="edit-contact-no">
                  Contact Number
                </label>
                <Input
                  id="edit-contact-no"
                  inputMode="numeric"
                  maxLength={11}
                  onChange={(event) =>
                    setFormState((previous) =>
                      previous
                        ? { ...previous, contactNo: normalizeAccountContactNo(event.target.value) }
                        : previous,
                    )
                  }
                  placeholder="09XXXXXXXXX"
                  value={formState.contactNo}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="edit-first-name">
                  First Name
                </label>
                <Input
                  id="edit-first-name"
                  required
                  onChange={(event) => setFormState((previous) => previous ? { ...previous, firstName: event.target.value } : previous)}
                  value={formState.firstName}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="edit-middle-name">
                  Middle Name
                </label>
                <Input
                  id="edit-middle-name"
                  onChange={(event) => setFormState((previous) => previous ? { ...previous, middleName: event.target.value } : previous)}
                  value={formState.middleName}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="edit-last-name">
                  Last Name
                </label>
                <Input
                  id="edit-last-name"
                  required
                  onChange={(event) => setFormState((previous) => previous ? { ...previous, lastName: event.target.value } : previous)}
                  value={formState.lastName}
                />
              </div>
            </div>

            {detail ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Editing {detail.fullName} ({detail.status}) in {detail.scopeLabel}
              </div>
            ) : null}
          </div>
        )}

        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

        <DialogFooter>
          <Button disabled={isSaving} onClick={() => handleOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={isLoading || isSaving || !formState}
            onClick={handleSave}
            type="button"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
