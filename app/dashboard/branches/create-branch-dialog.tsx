"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { buildBranchCode, normalizeBranchCodeInput } from "@/app/dashboard/branches/branch-code";
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

export function CreateBranchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [provinceName, setProvinceName] = useState("");
  const [provinceCode, setProvinceCode] = useState("");
  const [municipalityName, setMunicipalityName] = useState("");
  const [municipalityCode, setMunicipalityCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const generatedBranchCode = useMemo(
    () => buildBranchCode(provinceCode, municipalityCode),
    [municipalityCode, provinceCode],
  );

  function resetForm() {
    setProvinceName("");
    setProvinceCode("");
    setMunicipalityName("");
    setMunicipalityCode("");
    setBranchName("");
    setBranchAddress("");
    setErrorMessage(null);
    setIsSubmitting(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  }

  async function handleCreate() {
    setIsSubmitting(true);
    setErrorMessage(null);

    const response = await fetch("/dashboard/branches/create", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provinceName,
        provinceCode,
        municipalityName,
        municipalityCode,
        branchName,
        branchAddress,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { message?: string; branchCode?: string }
      | null;
    const message = payload?.message ?? "Unable to create branch right now.";

    if (!response.ok || !payload?.branchCode) {
      setIsSubmitting(false);
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    toast.success(message);
    handleOpenChange(false);
    router.push(
      `/dashboard/branches/${encodeURIComponent(payload.branchCode)}?source=branches&returnTo=${encodeURIComponent("/dashboard/branches")}`,
    );
    router.refresh();
  }

  return (
    <>
      <Button
        className="bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Plus className="h-4 w-4" />
        Create Branch
      </Button>

      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Branch</DialogTitle>
            <DialogDescription>
              Set the branch location identity carefully. The province and municipality codes generate the branch code used in downstream records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Choose the province and municipality codes carefully. Once this branch code starts being used in operational records, it becomes structural identity rather than a casual label.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-branch-province-name">Province Name</Label>
                <Input
                  id="create-branch-province-name"
                  onChange={(event) => setProvinceName(event.target.value)}
                  value={provinceName}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-branch-province-code">Province Code</Label>
                <Input
                  id="create-branch-province-code"
                  maxLength={20}
                  onChange={(event) => setProvinceCode(normalizeBranchCodeInput(event.target.value))}
                  placeholder="BHL"
                  value={provinceCode}
                />
                <p className="text-xs text-muted-foreground">
                  Use 2 to 20 uppercase letters or numbers only.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-branch-municipality-name">Municipality / City Name</Label>
                <Input
                  id="create-branch-municipality-name"
                  onChange={(event) => setMunicipalityName(event.target.value)}
                  value={municipalityName}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-branch-municipality-code">Municipality / City Code</Label>
                <Input
                  id="create-branch-municipality-code"
                  maxLength={20}
                  onChange={(event) => setMunicipalityCode(normalizeBranchCodeInput(event.target.value))}
                  placeholder="TGB"
                  value={municipalityCode}
                />
                <p className="text-xs text-muted-foreground">
                  This combines with the province code to generate the permanent branch code.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div className="space-y-1.5">
                <Label htmlFor="create-branch-name">Branch Name</Label>
                <Input
                  id="create-branch-name"
                  onChange={(event) => setBranchName(event.target.value)}
                  value={branchName}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-branch-generated-code">Branch Code</Label>
                <Input
                  disabled
                  id="create-branch-generated-code"
                  value={generatedBranchCode || "Will generate from codes"}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-branch-address">Branch Address</Label>
              <textarea
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
                id="create-branch-address"
                onChange={(event) => setBranchAddress(event.target.value)}
                value={branchAddress}
              />
            </div>

            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          </div>

          <DialogFooter>
            <Button disabled={isSubmitting} onClick={() => handleOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button disabled={isSubmitting} onClick={() => void handleCreate()} type="button">
              {isSubmitting ? "Creating..." : "Create Branch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
