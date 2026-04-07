"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Label } from "@/components/ui/label";

export function BranchEditAreaDialog({
  areaCode,
  areaId,
  branchCode,
  description,
  onUpdated,
}: {
  areaCode: string;
  areaId: number;
  branchCode: string;
  description: string | null;
  onUpdated?: (nextDescription: string | null) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [nextDescription, setNextDescription] = useState(description ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasChanges = useMemo(
    () => nextDescription.trim() !== (description ?? "").trim(),
    [description, nextDescription],
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setNextDescription(description ?? "");
      setErrorMessage(null);
      setIsSaving(false);
    }
  }
  async function handleSave() {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `/dashboard/branches/${encodeURIComponent(branchCode)}/areas/${areaId}/edit`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description: nextDescription,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      const message = payload?.message ?? "Unable to update area right now.";

      if (!response.ok) {
        setErrorMessage(message);
        toast.error(message);
        return;
      }

      onUpdated?.(nextDescription.trim() ? nextDescription.trim() : null);
      toast.success(message);
      handleOpenChange(false);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      const message = "Unable to update area right now. Please check your connection and try again.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <Button
        className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
      >
        Edit
      </Button>

      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Area</DialogTitle>
            <DialogDescription>
              Update the editable area details for {areaCode}. Area Code stays read-only here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Area Code: {areaCode}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`edit-area-description-${areaId}`}>Description</Label>
              <textarea
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
                id={`edit-area-description-${areaId}`}
                onChange={(event) => setNextDescription(event.target.value)}
                placeholder="Barangays: Bool, Mansasa, Dampas"
                value={nextDescription}
              />
            </div>

            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          </div>

          <DialogFooter>
            <Button disabled={isSaving} onClick={() => handleOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSaving || !hasChanges} onClick={() => void handleSave()} type="button">
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
