"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CollectorProfilePanel } from "@/app/dashboard/collectors/collector-profile-panel";
import type { CollectorProfileData } from "@/app/dashboard/collectors/types";

export function CollectorModal({
  collector,
  open,
  profileHref,
  onOpenChange,
}: {
  collector: CollectorProfileData | null;
  open: boolean;
  profileHref: string;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>{collector?.fullName ?? "Collector Profile"}</DialogTitle>
          <DialogDescription>Collector performance profile</DialogDescription>
        </DialogHeader>
        {collector ? (
          <CollectorProfilePanel
            data={collector}
            onClose={() => onOpenChange(false)}
            profileHref={profileHref}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
