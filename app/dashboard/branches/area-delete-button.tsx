"use client";

import { startTransition, useState } from "react";
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

export function AreaDeleteButton({
  areaCode,
  areaId,
  branchCode,
  onDeleted,
}: {
  areaCode: string;
  areaId: number;
  branchCode: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/dashboard/branches/${encodeURIComponent(branchCode)}/areas/${areaId}/delete`,
        {
          method: "POST",
          credentials: "same-origin",
        },
      );

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      const message = payload?.message ?? "Unable to delete this area right now.";

      if (!response.ok) {
        toast.error(message);
        return;
      }

      onDeleted?.();
      toast.success(message);
      setOpen(false);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      toast.error("Unable to delete this area right now. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
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
            <AlertDialogTitle>Delete this area?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {areaCode} only when it no longer has borrowers, collector assignments, loans, or other linked operational records. This action is permanent.
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
              {isSubmitting ? "Deleting..." : "Yes, delete area"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
