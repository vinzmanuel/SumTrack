"use client";

import { useState } from "react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function BranchDeleteButton({
  branchCode,
  branchName,
}: {
  branchCode: string;
  branchName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    setIsSubmitting(true);

    const response = await fetch(`/dashboard/branches/${encodeURIComponent(branchCode)}/delete`, {
      method: "POST",
      credentials: "same-origin",
    });

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    const message = payload?.message ?? "Unable to delete this branch right now.";

    if (!response.ok) {
      setIsSubmitting(false);
      toast.error(message);
      return;
    }

    toast.success(message);
    setOpen(false);
    setIsSubmitting(false);
    router.push("/dashboard/branches");
    router.refresh();
  }

  return (
    <>
      <Button
        className="bg-red-600 text-white hover:bg-red-700 hover:text-white"
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
      >
        Delete
      </Button>

      <AlertDialog onOpenChange={setOpen} open={open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this branch?</AlertDialogTitle>
            <AlertDialogDescription>
              {branchName} will only delete if it has no live operational dependencies. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isSubmitting}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirm();
              }}
            >
              {isSubmitting ? "Deleting..." : "Delete Branch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
