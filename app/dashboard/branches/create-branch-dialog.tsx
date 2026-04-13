"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { buildBranchCode, normalizeBranchCodeInput } from "@/app/dashboard/branches/branch-code";
import psgcLocations from "@/lib/data/psgc_official_provinces_municipalities.json";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
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
import { cn } from "@/lib/utils";

type LocationDataset = {
  provinces: Array<{
    name: string;
    municipalities: Array<{
      name: string;
    }>;
  }>;
};

function DialogComboboxContent({
  children,
  container,
}: {
  children: React.ReactNode;
  container: HTMLElement | null;
}) {
  return (
    <ComboboxPrimitive.Portal container={container}>
      <ComboboxPrimitive.Positioner
        align="start"
        className="isolate z-50"
        side="bottom"
        sideOffset={6}
      >
        <ComboboxPrimitive.Popup
          className={cn(
            "group/combobox-content relative max-h-96 w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) overflow-hidden rounded-md bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          )}
          data-slot="combobox-content"
        >
          {children}
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

export function CreateBranchDialog() {
  const locationDataset = psgcLocations as LocationDataset;
  const provinceOptions = useMemo(
    () => locationDataset.provinces.map((province) => province.name),
    [locationDataset.provinces],
  );
  const router = useRouter();
  const [popupContainer, setPopupContainer] = useState<HTMLDivElement | null>(null);
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
  const municipalityOptions = useMemo(() => {
    if (!provinceName) {
      return [];
    }

    const selectedProvince = locationDataset.provinces.find(
      (province) => province.name === provinceName,
    );

    return selectedProvince?.municipalities.map((municipality) => municipality.name) ?? [];
  }, [locationDataset.provinces, provinceName]);

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

  function handleProvinceChange(nextProvince: string | null) {
    const normalizedProvince = nextProvince ?? "";
    setProvinceName(normalizedProvince);
    setMunicipalityName("");
  }

  function handleMunicipalityChange(nextMunicipality: string | null) {
    setMunicipalityName(nextMunicipality ?? "");
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
        className="h-11 rounded-md bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700 hover:text-white"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Plus className="h-4 w-4" />
        Create Branch
      </Button>

      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-2xl">
          <div ref={setPopupContainer} />
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
                <Combobox
                  items={provinceOptions}
                  onValueChange={handleProvinceChange}
                  value={provinceName || null}
                >
                  <ComboboxInput
                    className="w-full"
                    placeholder="Select province"
                    showClear
                  />
                  <DialogComboboxContent container={popupContainer}>
                    <ComboboxEmpty>No province found.</ComboboxEmpty>
                    <ComboboxList>
                      {(item) => (
                        <ComboboxItem key={item} value={item}>
                          {item}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </DialogComboboxContent>
                </Combobox>
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
                  Use 2 to 20 uppercase letters, numbers, or hyphens only.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-branch-municipality-name">Municipality / City Name</Label>
                <Combobox
                  items={municipalityOptions}
                  onValueChange={handleMunicipalityChange}
                  value={municipalityName || null}
                >
                  <ComboboxInput
                    className="w-full"
                    disabled={!provinceName}
                    placeholder={provinceName ? "Select municipality / city" : "Select province first"}
                    showClear
                  />
                  <DialogComboboxContent container={popupContainer}>
                    <ComboboxEmpty>
                      {provinceName ? "No municipality found." : "Select a province first."}
                    </ComboboxEmpty>
                    <ComboboxList>
                      {(item) => (
                        <ComboboxItem key={item} value={item}>
                          {item}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </DialogComboboxContent>
                </Combobox>
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
