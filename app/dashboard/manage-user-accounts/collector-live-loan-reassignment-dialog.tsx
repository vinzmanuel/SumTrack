"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  ManagedCollectorReassignmentPreview,
  ManagedCollectorReassignmentRequiredPayload,
  ManagedCollectorReassignmentResult,
  ManagedUserMutationErrorPayload,
} from "@/app/dashboard/manage-user-accounts/types";

export type CollectorReassignmentRequest = {
  blocked: ManagedCollectorReassignmentRequiredPayload;
  retryAction: () => Promise<void>;
};

function buildPreviewUrl(blocked: ManagedCollectorReassignmentRequiredPayload) {
  const params = new URLSearchParams();
  params.set("actionType", blocked.actionType);

  if (blocked.nextRole) {
    params.set("nextRole", blocked.nextRole);
  }

  if (typeof blocked.nextBranchId === "number") {
    params.set("nextBranchId", String(blocked.nextBranchId));
  }

  if (typeof blocked.nextAreaId === "number") {
    params.set("nextAreaId", String(blocked.nextAreaId));
  }

  return `/dashboard/manage-user-accounts/${blocked.collectorId}/reassign-loans?${params.toString()}`;
}

function describeAction(actionType: ManagedCollectorReassignmentRequiredPayload["actionType"]) {
  if (actionType === "role_change") return "This role change needs a replacement collector first.";
  if (actionType === "branch_reassignment") return "These live loans need a replacement collector in the same branch first.";
  if (actionType === "area_reassignment") return "These live loans need a replacement collector in the same area first.";
  if (actionType === "deactivate") return "This collector must hand off live loans before deactivation.";
  return "This collector must hand off live loans before deletion.";
}

export function CollectorLiveLoanReassignmentDialog({
  onOpenChange,
  request,
}: {
  onOpenChange: (open: boolean) => void;
  request: CollectorReassignmentRequest | null;
}) {
  const [preview, setPreview] = useState<ManagedCollectorReassignmentPreview | null>(null);
  const [selectedCollectorId, setSelectedCollectorId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const open = Boolean(request);

  useEffect(() => {
    if (!request) {
      setPreview(null);
      setSelectedCollectorId("");
      setErrorMessage(null);
      setIsLoading(false);
      setIsSubmitting(false);
      return;
    }

    const controller = new AbortController();

    void (async () => {
      setPreview(null);
      setSelectedCollectorId("");
      setErrorMessage(null);
      setIsLoading(true);

      try {
        const response = await fetch(buildPreviewUrl(request.blocked), {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | ManagedCollectorReassignmentPreview
          | ManagedUserMutationErrorPayload
          | null;

        if (!response.ok || !payload || !("collectorName" in payload)) {
          throw new Error(payload?.message ?? "Unable to load reassignment options right now.");
        }

        setPreview(payload);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Unable to load reassignment options right now.";
        setErrorMessage(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [request]);

  const canSubmit = Boolean(preview && selectedCollectorId && !isLoading && !isSubmitting);
  const selectedCollectorSummary = useMemo(
    () => preview?.candidates.find((item) => item.userId === selectedCollectorId) ?? null,
    [preview, selectedCollectorId],
  );

  async function handleConfirm() {
    if (!request || !preview || !selectedCollectorId) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const response = await fetch(`/dashboard/manage-user-accounts/${request.blocked.collectorId}/reassign-loans`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        actionType: request.blocked.actionType,
        replacementCollectorId: selectedCollectorId,
        nextRole: request.blocked.nextRole ?? null,
        nextBranchId: request.blocked.nextBranchId ?? null,
        nextAreaId: request.blocked.nextAreaId ?? null,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | ManagedCollectorReassignmentResult
      | ManagedUserMutationErrorPayload
      | null;

    if (!response.ok || !payload || !("reassignedLoanCount" in payload)) {
      const message =
        payload && "message" in payload ? payload.message ?? "Unable to reassign live loans right now." : "Unable to reassign live loans right now.";
      setErrorMessage(message);
      toast.error(message);
      setIsSubmitting(false);
      return;
    }

    toast.success(
      payload.reassignedLoanCount > 0
        ? `Reassigned ${payload.reassignedLoanCount} live loans to ${payload.replacementCollectorName}.`
        : "No live loans remained to move. Continuing with the original action.",
    );

    onOpenChange(false);
    setIsSubmitting(false);
    await request.retryAction();
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Reassign Live Loans First</DialogTitle>
          <DialogDescription>
            Move the live loans to another eligible collector, then we can finish the original change.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !preview ? (
          <div className="space-y-3">
            <div className="h-12 animate-pulse rounded-md bg-muted" />
            <div className="h-20 animate-pulse rounded-md bg-muted" />
            <div className="h-10 animate-pulse rounded-md bg-muted" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm font-medium">{preview.collectorName}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {preview.collectorCompanyId} • {preview.currentBranchCode ?? "Unassigned branch"}
                {preview.currentAreaCode ? ` • ${preview.currentAreaCode}` : ""}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border bg-background px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Active
                  </p>
                  <p className="mt-1 text-lg font-semibold">{preview.activeLoanCount}</p>
                </div>
                <div className="rounded-md border bg-background px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Overdue
                  </p>
                  <p className="mt-1 text-lg font-semibold">{preview.overdueLoanCount}</p>
                </div>
                <div className="rounded-md border bg-background px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Live Loans
                  </p>
                  <p className="mt-1 text-lg font-semibold">{preview.totalLiveLoanCount}</p>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">{describeAction(preview.actionType)}</p>
              <p className="text-sm text-muted-foreground">{preview.candidateScopeLabel}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="replacement-collector">
                Replacement Collector
              </label>
              <Select onValueChange={setSelectedCollectorId} value={selectedCollectorId}>
                <SelectTrigger id="replacement-collector" className="w-full">
                  <SelectValue
                    placeholder={
                      preview.candidates.length > 0
                        ? "Select a replacement collector"
                        : "No eligible replacement collectors found"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {preview.candidates.map((candidate) => (
                    <SelectItem key={candidate.userId} value={candidate.userId}>
                      {candidate.fullName} ({candidate.companyId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCollectorSummary ? (
                <p className="text-sm text-muted-foreground">
                  {selectedCollectorSummary.branchCode} • {selectedCollectorSummary.areaCode}
                </p>
              ) : null}
            </div>
          </div>
        )}

        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

        <DialogFooter>
          <Button disabled={isSubmitting} onClick={() => onOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={handleConfirm} type="button">
            {isSubmitting ? "Reassigning..." : "Reassign Live Loans"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
