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
import type { BranchStatus } from "@/app/dashboard/branches/types";

export function BranchStatusButton({
  branchCode,
  branchName,
  status,
}: {
  branchCode: string;
  branchName: string;
  status: BranchStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextStatus = status === "active" ? "inactive" : "active";

  async function handleConfirm() {
    setIsSubmitting(true);

    const response = await fetch(`/dashboard/branches/${encodeURIComponent(branchCode)}/status`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nextStatus }),
    });

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    const message = payload?.message ?? "Unable to update branch status right now.";

    if (!response.ok) {
      setIsSubmitting(false);
      toast.error(message);
      return;
    }

    toast.success(message);
    setOpen(false);
    setIsSubmitting(false);
    router.refresh();
  }

  return (
    <>
      <Button
        className={
          status === "active"
            ? "bg-amber-500 text-white hover:bg-amber-600 hover:text-white"
            : "bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
        }
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
      >
        {status === "active" ? "Deactivate" : "Reactivate"}
      </Button>

      <AlertDialog onOpenChange={setOpen} open={open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {status === "active" ? "Deactivate this branch?" : "Reactivate this branch?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {status === "active"
                ? `This will close ${branchName} for new operational work while keeping existing obligations visible.`
                : `This will reopen ${branchName} for normal operational work.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirm();
              }}
            >
              {isSubmitting ? "Saving..." : status === "active" ? "Deactivate" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
