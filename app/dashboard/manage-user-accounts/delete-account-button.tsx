"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type {
  ManagedCollectorReassignmentRequiredPayload,
  ManagedUserMutationErrorPayload,
} from "@/app/dashboard/manage-user-accounts/types";

export function DeleteAccountButton({
  userId,
  userLabel,
  onDeleted,
  onReassignmentRequired,
}: {
  userId: string;
  userLabel: string;
  onDeleted: () => void;
  onReassignmentRequired: (
    blocked: ManagedCollectorReassignmentRequiredPayload,
    retryAction: () => Promise<void>,
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function performDelete() {
    const response = await fetch(`/dashboard/manage-user-accounts/${userId}/delete`, {
      method: "POST",
      credentials: "same-origin",
    });
    const payload = (await response.json().catch(() => null)) as ManagedUserMutationErrorPayload | null;

    if (!response.ok) {
      if (payload?.errorType === "reassignment_required" && payload.reassignmentRequired && payload.collectorId) {
        setOpen(false);
        onReassignmentRequired(payload as ManagedCollectorReassignmentRequiredPayload, performDelete);
        return;
      }

      const message = payload?.message ?? "Unable to delete this account right now.";
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setOpen(false);
    toast.success(`${userLabel} was deleted.`);
    onDeleted();
  }

  function handleDelete() {
    setErrorMessage(null);

    startTransition(async () => {
      await performDelete();
    });
  }

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>
        <Button className="bg-destructive text-white hover:bg-destructive/90" size="sm" type="button">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete user account?</AlertDialogTitle>
          <AlertDialogDescription>
            This will attempt to remove {userLabel}. Accounts with linked operational records will be blocked.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              handleDelete();
            }}
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
