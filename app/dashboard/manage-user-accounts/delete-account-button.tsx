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

export function DeleteAccountButton({
  userId,
  userLabel,
  onDeleted,
}: {
  userId: string;
  userLabel: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setErrorMessage(null);

    startTransition(async () => {
      const response = await fetch(`/dashboard/manage-user-accounts/${userId}/delete`, {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        const message = payload?.message ?? "Unable to delete this account right now.";
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      setOpen(false);
      toast.success(`${userLabel} was deleted.`);
      onDeleted();
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
