"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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

export function BranchCreateAreaDialog({ branchCode }: { branchCode: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [areaNo, setAreaNo] = useState("");
  const [description, setDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const derivedAreaCode = useMemo(
    () => (/^[0-9]{2}$/.test(areaNo.trim()) ? `${branchCode}-${areaNo.trim()}` : ""),
    [areaNo, branchCode],
  );

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setAreaNo("");
      setDescription("");
      setErrorMessage(null);
      setIsSaving(false);
    }
  }

  async function handleCreate() {
    if (!/^[0-9]{2}$/.test(areaNo.trim())) {
      setErrorMessage("Area No. must use exactly two digits.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const response = await fetch(`/dashboard/branches/${encodeURIComponent(branchCode)}/areas/create`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        areaNo,
        description,
      }),
    });

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    const message = payload?.message ?? "Unable to create area right now.";

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
        className="bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
      >
        <Plus className="h-4 w-4" />
        Create Area
      </Button>

      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Area</DialogTitle>
            <DialogDescription>
              Add a new area record under branch {branchCode}. Collector assignment stays outside this flow.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[140px_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="create-area-no">Area No.</Label>
                <Input
                  id="create-area-no"
                  maxLength={2}
                  onChange={(event) => setAreaNo(event.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder="01"
                  value={areaNo}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-area-code-preview">Area Code</Label>
                <Input
                  disabled
                  id="create-area-code-preview"
                  value={derivedAreaCode || "Will derive from branch code + area no."}
                />
                <p className="text-xs text-muted-foreground">
                  Area Code is derived automatically from the branch code and area number.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-area-description">Description</Label>
              <textarea
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
                id="create-area-description"
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Barangays: Bool, Mansasa, Dampas"
                value={description}
              />
            </div>

            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          </div>

          <DialogFooter>
            <Button disabled={isSaving} onClick={() => handleOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSaving} onClick={() => void handleCreate()} type="button">
              {isSaving ? "Creating..." : "Create Area"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
