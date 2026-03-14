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

export function ToggleAccountStatusButton({
  currentStatus,
  onStatusChanged,
  userId,
  userLabel,
}: {
  currentStatus: "active" | "inactive";
  onStatusChanged: () => void;
  userId: string;
  userLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const nextStatus = currentStatus === "active" ? "inactive" : "active";
  const actionLabel = currentStatus === "active" ? "Deactivate" : "Reactivate";

  function handleStatusChange() {
    setErrorMessage(null);

    startTransition(async () => {
      const response = await fetch(`/dashboard/manage-user-accounts/${userId}/status`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        const message = payload?.message ?? `Unable to ${actionLabel.toLowerCase()} this account right now.`;
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      setOpen(false);
      toast.success(
        currentStatus === "active"
          ? `${userLabel} was deactivated.`
          : `${userLabel} was reactivated.`,
      );
      onStatusChanged();
    });
  }

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>
        <Button
          className={
            currentStatus === "active"
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }
          size="sm"
          type="button"
        >
          {actionLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{actionLabel} user account?</AlertDialogTitle>
          <AlertDialogDescription>
            {currentStatus === "active"
              ? `This will mark ${userLabel} as inactive until reactivated.`
              : `This will restore ${userLabel} to active account status.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={
              currentStatus === "active"
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              handleStatusChange();
            }}
          >
            {isPending ? `${actionLabel}...` : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
