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

export function LoanDeleteButton({
  loanId,
  loanCode,
  redirectHref,
  size = "sm",
}: {
  loanId: number;
  loanCode: string;
  redirectHref?: string;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function performDelete() {
    const response = await fetch(`/dashboard/loans/${loanId}/delete`, {
      method: "POST",
      credentials: "same-origin",
    });
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    const message = payload?.message ?? "Unable to delete this loan right now.";

    if (!response.ok) {
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setOpen(false);
    setErrorMessage(null);
    toast.success(message);

    if (redirectHref) {
      router.push(redirectHref);
      router.refresh();
      return;
    }

    router.refresh();
  }

  function handleDelete() {
    setErrorMessage(null);

    startTransition(async () => {
      await performDelete();
    });
  }

  return (
    <AlertDialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setErrorMessage(null);
        }
      }}
      open={open}
    >
      <AlertDialogTrigger asChild>
        <Button className="bg-destructive text-white hover:bg-destructive/90" size={size} type="button">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this loan?</AlertDialogTitle>
          <AlertDialogDescription>
            This is only allowed for Admin and only when the loan has no recorded collections. If the loan has uploaded documents, they will be removed together with the loan record.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <p className="text-sm">
          <span className="font-medium">Loan:</span> {loanCode}
        </p>

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
