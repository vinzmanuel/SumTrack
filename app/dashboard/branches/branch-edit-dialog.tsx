"use client";

import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BranchEditDialog({
  branchAddress,
  branchCode,
  branchName,
  triggerLabel = "Edit",
}: {
  branchAddress: string;
  branchCode: string;
  branchName: string;
  triggerLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(branchName);
  const [address, setAddress] = useState(branchAddress);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasChanges = useMemo(
    () => name.trim() !== branchName.trim() || address.trim() !== branchAddress.trim(),
    [address, branchAddress, branchName, name],
  );

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName(branchName);
      setAddress(branchAddress);
      setErrorMessage(null);
      setIsSaving(false);
    }
    setOpen(nextOpen);
  }

  async function handleSave() {
    if (!name.trim()) {
      setErrorMessage("Branch name is required.");
      return;
    }

    if (!address.trim()) {
      setErrorMessage("Branch address is required.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const response = await fetch(`/dashboard/branches/${encodeURIComponent(branchCode)}/edit`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        branchName: name,
        branchAddress: address,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    const message = payload?.message ?? "Unable to update branch details right now.";

    if (!response.ok) {
      setIsSaving(false);
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    toast.success(message);
    handleOpenChange(false);
    router.refresh();
  }

  return (
    <>
      <Button
        className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
      >
        {triggerLabel}
      </Button>

      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Branch Details</DialogTitle>
            <DialogDescription>
              Update the editable branch details for {branchName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Branch Code: {branchCode}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch-name">Branch Name</Label>
              <Input id="branch-name" onChange={(event) => setName(event.target.value)} value={name} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="branch-address">Branch Address</Label>
              <Input id="branch-address" onChange={(event) => setAddress(event.target.value)} value={address} />
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
