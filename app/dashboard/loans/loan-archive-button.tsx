"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import type { VisibleLoanStatus } from "@/app/dashboard/loans/loan-state";

export function LoanArchiveButton({
  loanId,
  loanCode,
  visibleStatus,
  size = "sm",
  triggerLabel,
}: {
  loanId: number;
  loanCode: string;
  visibleStatus: VisibleLoanStatus;
  size?: "sm" | "default";
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [abandonedConfirmed, setAbandonedConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isOverdue = visibleStatus === "Overdue";

  async function performArchive() {
    const response = await fetch(`/dashboard/loans/${loanId}/archive`, {
      method: "POST",
      credentials: "same-origin",
    });
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    const message = payload?.message ?? "Unable to archive this loan right now.";

    if (!response.ok) {
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setOpen(false);
    setErrorMessage(null);
    setAbandonedConfirmed(false);
    toast.success(message);
    router.refresh();
  }

  function handleConfirm() {
    setErrorMessage(null);

    startTransition(async () => {
      await performArchive();
    });
  }

  const title = isOverdue ? "Mark loan as Abandoned?" : "Archive completed loan?";
  const description = isOverdue
    ? "This loan is currently overdue. Archiving it will move it to the Archived tab and label it as Abandoned. Use this only for exceptional cases where the loan is no longer expected to be collectible. This keeps the loan record and digital passbook history intact."
    : "This completed loan will move to the Archived tab. The record, receipts, and digital passbook will remain available for reference.";
  const actionLabel = isOverdue ? "Mark as Abandoned" : "Archive";
  const buttonLabel = triggerLabel ?? "Archive";

  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setErrorMessage(null);
          setAbandonedConfirmed(false);
        }
      }}
      open={open}
    >
      <AlertDialogTrigger asChild>
        <Button
          className="bg-amber-500 text-white hover:bg-amber-600 hover:text-white"
          size={size}
          type="button"
        >
          {buttonLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Loan:</span> {loanCode}
          </p>
          <p>
            <span className="font-medium">Current visible status:</span> {visibleStatus}
          </p>
        </div>

        {isOverdue ? (
          <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <input
              checked={abandonedConfirmed}
              className="mt-1 h-4 w-4"
              onChange={(event) => setAbandonedConfirmed(event.target.checked)}
              type="checkbox"
            />
            <span>I understand this will mark the loan as Abandoned and move it to the Archived tab.</span>
          </label>
        ) : null}

        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={
              isOverdue
                ? "bg-destructive text-white hover:bg-destructive/90"
                : "bg-amber-500 text-white hover:bg-amber-600"
            }
            disabled={isPending || (isOverdue && !abandonedConfirmed)}
            onClick={(event) => {
              event.preventDefault();
              handleConfirm();
            }}
          >
            {isPending ? "Saving..." : actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
