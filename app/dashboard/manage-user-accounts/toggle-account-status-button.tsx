"use client";

import { cloneElement, isValidElement, useEffect, useMemo, useState, useTransition, type MouseEvent as ReactMouseEvent, type ReactElement } from "react";
import { AlertTriangle } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  ManagedCollectorReassignmentRequiredPayload,
  ManagedUserDetail,
  ManagedUserMutationErrorPayload,
} from "@/app/dashboard/manage-user-accounts/types";

const EMPTY_BRANCH_OPTIONS: ManagedUserDetail["editableBranchOptions"] = [];
const EMPTY_AREA_OPTIONS: ManagedUserDetail["editableAreaOptions"] = [];

function branchLabel(branch: { branchName: string; branchCode?: string }) {
  return branch.branchCode ? `${branch.branchCode} - ${branch.branchName}` : branch.branchName;
}

export function ToggleAccountStatusButton({
  currentStatus,
  onStatusChanged,
  onReassignmentRequired,
  userId,
  userLabel,
  trigger,
}: {
  currentStatus: "active" | "inactive";
  onStatusChanged: () => void;
  onReassignmentRequired: (
    blocked: ManagedCollectorReassignmentRequiredPayload,
    retryAction: () => Promise<void>,
  ) => void;
  userId: string;
  userLabel: string;
  trigger?: ReactElement<{ onClick?: (event: ReactMouseEvent<HTMLElement>) => void }>;
}) {
  const [open, setOpen] = useState(false);
  const [reactivationOpen, setReactivationOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [detail, setDetail] = useState<ManagedUserDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [roleId, setRoleId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [areaId, setAreaId] = useState("");
  const nextStatus = currentStatus === "active" ? "inactive" : "active";
  const actionLabel = currentStatus === "active" ? "Deactivate" : "Reactivate";

  const defaultTriggerClassName =
    currentStatus === "active"
      ? "bg-amber-500 text-white hover:bg-amber-600"
      : "bg-emerald-600 text-white hover:bg-emerald-700";

  function renderTrigger(onOpen: () => void) {
    if (isValidElement(trigger)) {
        return cloneElement(trigger, {
        onClick: (event: ReactMouseEvent<HTMLElement>) => {
          trigger.props.onClick?.(event);
          if (!event.defaultPrevented) {
            onOpen();
          }
        },
      });
    }

    return (
      <Button
        className={defaultTriggerClassName}
        onClick={onOpen}
        size="sm"
        type="button"
      >
        {actionLabel}
      </Button>
    );
  }

  useEffect(() => {
    if (!reactivationOpen || currentStatus !== "inactive") {
      return;
    }

    const controller = new AbortController();
    void (async () => {
      setIsLoadingDetail(true);
      setErrorMessage(null);

      try {
        const detailUrl = `/dashboard/manage-user-accounts/${userId}/data?status=${currentStatus}`;
        const response = await fetch(detailUrl, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load reactivation details.");
        }

        const payload = (await response.json()) as ManagedUserDetail;
        setDetail(payload);
        setRoleId(String(payload.roleId));
        setBranchId("");
        setBranchIds([]);
        setAreaId("");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        const message = "Unable to load reactivation details right now.";
        setErrorMessage(message);
        toast.error(message);
      } finally {
        setIsLoadingDetail(false);
      }
    })();

    return () => controller.abort();
  }, [currentStatus, reactivationOpen, userId]);

  const roleOptions = useMemo(() => {
    if (!detail) {
      return [];
    }

    const currentRoleOption = { roleId: detail.roleId, roleName: detail.roleName };
    const hasCurrentRole = detail.editableRoleOptions.some((item) => item.roleId === detail.roleId);
    return hasCurrentRole ? detail.editableRoleOptions : [currentRoleOption, ...detail.editableRoleOptions];
  }, [detail]);
  const selectedRole =
    roleOptions.find((item) => String(item.roleId ?? "") === roleId) ??
    (detail ? { roleId: detail.roleId, roleName: detail.roleName } : null);
  const selectedRoleName = selectedRole?.roleName ?? detail?.roleName ?? "";
  const allBranchOptions = detail?.editableBranchOptions ?? EMPTY_BRANCH_OPTIONS;
  const branchOptions = useMemo(() => {
    if (selectedRoleName === "Branch Manager") {
      return allBranchOptions.filter((item) => !item.hasActiveBranchManager);
    }

    if (selectedRoleName === "Auditor") {
      return allBranchOptions.filter((item) => !item.hasActiveAuditor);
    }

    return allBranchOptions;
  }, [allBranchOptions, selectedRoleName]);
  const areaOptions = detail?.editableAreaOptions ?? EMPTY_AREA_OPTIONS;
  const lastHeldBranchLabel =
    detail?.lastHeldBranchAssignments.map((item) => item.branchCode || item.branchName).join(", ") ?? "";
  const needsSingleBranchAssignment = selectedRoleName === "Branch Manager" || selectedRoleName === "Secretary";
  const needsAuditorBranchAssignments = selectedRoleName === "Auditor";
  const needsCollectorAreaAssignment = selectedRoleName === "Collector";
  const showBranchSelect = needsSingleBranchAssignment || needsCollectorAreaAssignment;
  const branchReassignmentLabel =
    selectedRoleName === "Branch Manager" || selectedRoleName === "Auditor"
      ? "Vacant branches for reassignment"
      : "Branch";
  const selectedBranchId = showBranchSelect ? branchId : "";
  const filteredAreaOptions = useMemo(
    () => areaOptions.filter((item) => (selectedBranchId ? String(item.branchId ?? "") === selectedBranchId : false)),
    [areaOptions, selectedBranchId],
  );
  const selectedAreaOption =
    filteredAreaOptions.find((item) => String(item.areaId) === areaId) ??
    areaOptions.find((item) => String(item.areaId) === areaId) ??
    null;
  const selectedAreaHasCollectorWarning = selectedAreaOption?.hasActiveCollector ?? false;

  async function performStatusChange(payload?: {
    roleId?: number | null;
    branchId?: number | null;
    branchIds?: number[];
    areaId?: number | null;
  }) {
    const response = await fetch(`/dashboard/manage-user-accounts/${userId}/status`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status: nextStatus,
        roleId: payload?.roleId ?? null,
        branchId: payload?.branchId ?? null,
        branchIds: payload?.branchIds ?? [],
        areaId: payload?.areaId ?? null,
      }),
    });
    const responsePayload = (await response.json().catch(() => null)) as ManagedUserMutationErrorPayload | null;

    if (!response.ok) {
      if (responsePayload?.errorType === "reassignment_required" && responsePayload.reassignmentRequired && responsePayload.collectorId) {
        setOpen(false);
        setReactivationOpen(false);
        onReassignmentRequired(responsePayload as ManagedCollectorReassignmentRequiredPayload, () => performStatusChange(payload));
        return;
      }

      const message = responsePayload?.message ?? `Unable to ${actionLabel.toLowerCase()} this account right now.`;
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setOpen(false);
    setReactivationOpen(false);
    toast.success(
      currentStatus === "active"
        ? `${userLabel} was deactivated.`
        : `${userLabel} was reactivated.`,
    );
    onStatusChanged();
  }

  function handleDeactivate() {
    setErrorMessage(null);

    startTransition(async () => {
      await performStatusChange();
    });
  }

  function handleReactivate() {
    if (!detail) {
      return;
    }

    let payload: {
      roleId?: number | null;
      branchId?: number | null;
      branchIds?: number[];
      areaId?: number | null;
    } = {
      roleId: selectedRole?.roleId ?? detail.roleId,
    };

    if (needsSingleBranchAssignment) {
      if (!branchId) {
        setErrorMessage("Select a branch before reactivating this account.");
        return;
      }
      payload = { ...payload, branchId: Number(branchId) };
    } else if (needsAuditorBranchAssignments) {
      if (branchIds.length === 0) {
        setErrorMessage("Select at least one branch before reactivating this auditor.");
        return;
      }
      payload = { ...payload, branchIds: branchIds.map((value) => Number(value)) };
    } else if (needsCollectorAreaAssignment) {
      if (!branchId) {
        setErrorMessage("Select a branch before choosing an area.");
        return;
      }
      if (!areaId) {
        setErrorMessage("Select an area before reactivating this collector.");
        return;
      }
      payload = { ...payload, branchId: Number(branchId), areaId: Number(areaId) };
    }

    setErrorMessage(null);
    startTransition(async () => {
      await performStatusChange(payload);
    });
  }

  if (currentStatus === "inactive") {
    return (
      <>
        {renderTrigger(() => setReactivationOpen(true))}

        <Dialog onOpenChange={setReactivationOpen} open={reactivationOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Reactivate user account</DialogTitle>
              <DialogDescription>
                Reactivation now includes placement. The account will become active with the assignment you choose here.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-md border bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
                Reactivating {userLabel}
                {detail?.roleName ? ` • ${detail.roleName}` : ""}
              </div>

              {detail ? (
                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">Historical Context</h3>
                    <p className="text-xs text-muted-foreground">
                      These are last-held assignments only. They are not restored automatically.
                    </p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">Last Held Branch / Scope:</span>{" "}
                      {lastHeldBranchLabel || detail.scopeLabel || "Unassigned"}
                    </p>
                    {(detail.lastHeldAreaCode || detail.currentAreaCode) ? (
                      <p>
                        <span className="font-medium">Last Held Area:</span>{" "}
                        {detail.lastHeldAreaCode || detail.currentAreaCode}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {detail && roleOptions.length > 0 ? (
                <div className="space-y-2">
                  <Label>Role for reactivation</Label>
                  <Select
                    onValueChange={(value) => {
                      setRoleId(value);
                      setBranchId("");
                      setBranchIds([]);
                      setAreaId("");
                      setErrorMessage(null);
                    }}
                    value={roleId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((item) => (
                        <SelectItem key={`${item.roleId}-${item.roleName}`} value={String(item.roleId)}>
                          {item.roleName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {isLoadingDetail ? (
                <p className="text-sm text-muted-foreground">Loading reactivation options...</p>
              ) : null}

              {detail && showBranchSelect ? (
                <div className="space-y-2">
                  <Label>{branchReassignmentLabel}</Label>
                  <Select onValueChange={(value) => {
                    setBranchId(value);
                    if (needsCollectorAreaAssignment) {
                      setAreaId("");
                    }
                  }} value={branchId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branchOptions.map((item) => (
                        <SelectItem key={String(item.branchId)} value={String(item.branchId)}>
                          {branchLabel(item)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRoleName === "Branch Manager" && branchOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No vacant branches are available for reassignment right now.
                    </p>
                  ) : null}
                  {selectedRoleName === "Secretary" && branchOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No active branches are available for reassignment right now.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {detail && needsCollectorAreaAssignment ? (
                <div className="space-y-2">
                  <Label>Area</Label>
                  <Select disabled={!branchId} onValueChange={setAreaId} value={areaId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={branchId ? "Select area" : "Select branch first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredAreaOptions.map((item) => (
                        <SelectItem key={String(item.areaId)} value={String(item.areaId)}>
                          {item.areaCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAreaHasCollectorWarning ? (
                    <Alert className="border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-amber-800 dark:text-amber-200">
                        There is already an active collector assigned to this area. Add another collector here only if this is intentional, such as for handoff, replacement, or transition of live loans.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              ) : null}

              {detail && needsAuditorBranchAssignments ? (
                <div className="space-y-2">
                  <Label>Vacant branches for reassignment</Label>
                  <div className="space-y-2 rounded-md border p-3">
                    {branchOptions.map((item) => (
                      <label className="flex items-center gap-2 text-sm" key={String(item.branchId)}>
                        <input
                          checked={branchIds.includes(String(item.branchId))}
                          className="h-4 w-4"
                          onChange={(event) => {
                            const value = String(item.branchId);
                            setBranchIds((previous) => {
                              if (event.target.checked) {
                                return previous.includes(value) ? previous : [...previous, value];
                              }
                              return previous.filter((id) => id !== value);
                            });
                          }}
                          type="checkbox"
                        />
                        <span>{branchLabel(item)}</span>
                      </label>
                    ))}
                  </div>
                  {branchOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No vacant branches are available for auditor reassignment right now.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            </div>

            <DialogFooter>
              <Button disabled={isPending} onClick={() => setReactivationOpen(false)} type="button" variant="outline">
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={isPending || isLoadingDetail}
                onClick={handleReactivate}
                type="button"
              >
                {isPending ? "Reactivating..." : "Reactivate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      {renderTrigger(() => setOpen(true))}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate user account?</AlertDialogTitle>
          <AlertDialogDescription>
            This will mark {userLabel} as inactive, retain the role, and end any current branch or area assignments so the operational slot becomes vacant.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-amber-500 text-white hover:bg-amber-600"
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              handleDeactivate();
            }}
          >
            {isPending ? "Deactivating..." : "Deactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
