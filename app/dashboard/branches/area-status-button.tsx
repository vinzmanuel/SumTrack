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

export function AreaStatusButton({
  areaCode,
  areaId,
  branchCode,
  status,
}: {
  areaCode: string;
  areaId: number;
  branchCode: string;
  status: "active" | "inactive";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextStatus = status === "active" ? "inactive" : "active";

  async function handleConfirm() {
    setIsSubmitting(true);

    const response = await fetch(
      `/dashboard/branches/${encodeURIComponent(branchCode)}/areas/${areaId}/status`,
      {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nextStatus }),
      },
    );

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    const message = payload?.message ?? "Unable to update area status right now.";

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
              {status === "active" ? "Deactivate this area?" : "Reactivate this area?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {status === "active"
                ? `${areaCode} will stop receiving new borrower assignments, collector assignments, and new loan activity. Existing records stay visible.`
                : `${areaCode} will be available again for new borrower assignments, collector assignments, and new loan activity.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                status === "active"
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }
              disabled={isSubmitting}
              onClick={(event) => {
                event.preventDefault();
                void handleConfirm();
              }}
            >
              {isSubmitting ? "Saving..." : status === "active" ? "Yes, deactivate area" : "Yes, reactivate area"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
