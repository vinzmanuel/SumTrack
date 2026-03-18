"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isValidEmailAddress, isValidPhilippineMobile, normalizeAccountContactNo } from "@/app/dashboard/account-field-validation";
import type {
  ManagedCollectorReassignmentRequiredPayload,
  ManagedUserDetail,
  ManagedUserMutationErrorPayload,
} from "@/app/dashboard/manage-user-accounts/types";

type EditFormState = {
  roleId: string;
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  contactNo: string;
  branchId: string;
  branchIds: string[];
  areaId: string;
};

function toFormState(detail: ManagedUserDetail): EditFormState {
  return {
    roleId: String(detail.roleId),
    email: detail.email ?? "",
    firstName: detail.firstName,
    middleName: detail.middleName,
    lastName: detail.lastName,
    contactNo: detail.contactNo ?? "",
    branchId: detail.currentBranchId !== null ? String(detail.currentBranchId) : "",
    branchIds: detail.currentBranchAssignments.map((item) => String(item.branchId)),
    areaId: detail.currentAreaId !== null ? String(detail.currentAreaId) : "",
  };
}

function branchLabel(branch: { branchName: string; branchCode?: string }) {
  return branch.branchCode ? `${branch.branchCode} - ${branch.branchName}` : branch.branchName;
}

export function ManagedUserAccountEditModal({
  mode = "full",
  onOpenChange,
  onSaved,
  onReassignmentRequired,
  open,
  userId,
}: {
  mode?: "full" | "staffing";
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  onReassignmentRequired: (
    blocked: ManagedCollectorReassignmentRequiredPayload,
    retryAction: () => Promise<void>,
  ) => void;
  open: boolean;
  userId: string | null;
}) {
  const [detail, setDetail] = useState<ManagedUserDetail | null>(null);
  const [formState, setFormState] = useState<EditFormState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [auditorBranchToAdd, setAuditorBranchToAdd] = useState("");
  const [showAuditorBranchPicker, setShowAuditorBranchPicker] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setDetail(null);
      setFormState(null);
      setErrorMessage(null);
      setIsLoading(false);
      setIsSaving(false);
      setIsConfirmOpen(false);
      setAuditorBranchToAdd("");
      setShowAuditorBranchPicker(false);
    }

    onOpenChange(nextOpen);
  }

  useEffect(() => {
    if (!open || !userId) {
      return;
    }

    const controller = new AbortController();
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch(`/dashboard/manage-user-accounts/${userId}/data`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load account details.");
        }

        const payload = (await response.json()) as ManagedUserDetail;
        setDetail(payload);
        setFormState(toFormState(payload));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setErrorMessage("Unable to load account details right now.");
        toast.error("Unable to load account details right now.");
      } finally {
        setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [open, userId]);

  const roleOptions = useMemo(() => {
    const options = detail?.editableRoleOptions ?? [];

    if (mode !== "staffing") {
      return options;
    }

    return options.filter((item) =>
      item.roleName === "Auditor" ||
      item.roleName === "Branch Manager" ||
      item.roleName === "Secretary" ||
      item.roleName === "Collector",
    );
  }, [detail?.editableRoleOptions, mode]);
  const selectedRole = useMemo(() => {
    if (!detail || !formState) {
      return null;
    }

    return (
      roleOptions.find((item) => String(item.roleId) === formState.roleId) ?? {
        roleId: detail.roleId,
        roleName: detail.roleName,
      }
    );
  }, [detail, formState, roleOptions]);

  const selectedRoleName = selectedRole?.roleName ?? detail?.roleName ?? "";
  const showRoleSelector = Boolean(detail?.canEditRole && roleOptions.length > 0);
  const showCollectorBranchSelector =
    Boolean(detail?.canEditBranchAssignment) && selectedRoleName === "Collector";
  const showSingleBranchSelector =
    Boolean(detail?.canEditBranchAssignment) &&
    (selectedRoleName === "Secretary" || selectedRoleName === "Branch Manager");
  const showAuditorBranchSelector =
    Boolean(detail?.canEditAuditorBranchAssignments) && selectedRoleName === "Auditor";
  const showAreaAssignmentControl = Boolean(detail?.canEditAreaAssignment) && selectedRoleName === "Collector";
  const visibleAreaOptions =
    detail && formState
      ? detail.editableAreaOptions.filter((item) =>
          formState.branchId ? String(item.branchId ?? "") === formState.branchId : false,
        )
      : [];
  const selectedAuditorBranches =
    detail && formState
      ? detail.editableBranchOptions.filter((item) => formState.branchIds.includes(String(item.branchId)))
      : [];
  const availableAuditorBranches =
    detail && formState
      ? detail.editableBranchOptions.filter((item) => !formState.branchIds.includes(String(item.branchId)))
      : [];
  const requiresContactNo = selectedRoleName === "Borrower" || selectedRoleName === "Collector";

  useEffect(() => {
    if (!showAuditorBranchSelector) {
      setShowAuditorBranchPicker(false);
      setAuditorBranchToAdd("");
    }
  }, [showAuditorBranchSelector]);

  function updateRole(value: string) {
    setFormState((previous) => {
      if (!previous || !detail) {
        return previous;
      }

      const nextRoleName =
        roleOptions.find((item) => String(item.roleId) === value)?.roleName ?? detail.roleName;

      if (nextRoleName === "Auditor") {
        return {
          ...previous,
          roleId: value,
          branchId: "",
          areaId: "",
          branchIds:
            previous.branchIds.length > 0
              ? previous.branchIds
              : previous.branchId
                ? [previous.branchId]
                : previous.branchIds,
        };
      }

      if (nextRoleName === "Collector") {
        return {
          ...previous,
          roleId: value,
          branchIds: [],
          branchId:
            previous.branchId ||
            previous.branchIds[0] ||
            (detail.currentBranchId !== null ? String(detail.currentBranchId) : ""),
          areaId: previous.areaId,
        };
      }

      if (nextRoleName === "Secretary" || nextRoleName === "Branch Manager") {
        return {
          ...previous,
          roleId: value,
          branchIds: [],
          branchId:
            previous.branchId ||
            previous.branchIds[0] ||
            (detail.currentBranchId !== null ? String(detail.currentBranchId) : ""),
          areaId: "",
        };
      }

      return {
        ...previous,
        roleId: value,
        branchId: "",
        branchIds: [],
        areaId: "",
      };
    });
  }

  function addAuditorBranch() {
    if (!auditorBranchToAdd) {
      return;
    }

    setFormState((previous) =>
      previous && !previous.branchIds.includes(auditorBranchToAdd)
        ? { ...previous, branchIds: [...previous.branchIds, auditorBranchToAdd] }
        : previous,
    );
    setAuditorBranchToAdd("");
    setShowAuditorBranchPicker(false);
  }

  function removeAuditorBranch(branchId: string) {
    setFormState((previous) =>
      previous
        ? { ...previous, branchIds: previous.branchIds.filter((value) => value !== branchId) }
        : previous,
    );
  }

  function validateForm() {
    if (!formState || !detail) {
      return "Unable to load account details.";
    }

    if (mode === "full" && !formState.firstName.trim()) {
      return "First name is required.";
    }

    if (mode === "full" && !formState.lastName.trim()) {
      return "Last name is required.";
    }

    if (mode === "staffing" && selectedRoleName === "Collector" && !formState.contactNo) {
      return "Collector role requires a contact number. Update the contact details in Manage User Accounts first.";
    }

    if (requiresContactNo && !formState.contactNo) {
      return "Contact number is required for this account.";
    }

    if (formState.contactNo && !isValidPhilippineMobile(formState.contactNo)) {
      return "Enter a valid PH mobile number starting with 09.";
    }

    if (formState.email && !isValidEmailAddress(formState.email)) {
      return "Enter a valid email address.";
    }

    if ((showCollectorBranchSelector || showSingleBranchSelector) && !formState.branchId) {
      return "Branch assignment is required for this role.";
    }

    if (showAreaAssignmentControl && !formState.areaId) {
      return "Area assignment is required for collector accounts.";
    }

    if (showAuditorBranchSelector && formState.branchIds.length === 0) {
      return "Auditor accounts must have at least one branch assignment.";
    }

    return null;
  }

  async function performSave() {
    if (!userId || !formState || !detail) {
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      setIsConfirmOpen(false);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setIsConfirmOpen(false);

    const response = await fetch(`/dashboard/manage-user-accounts/${userId}/update`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...formState,
        branchIds: formState.branchIds,
      }),
    });
    const payload = (await response.json().catch(() => null)) as ManagedUserMutationErrorPayload | null;

    if (!response.ok) {
      setIsSaving(false);
      if (payload?.errorType === "reassignment_required" && payload.reassignmentRequired && payload.collectorId) {
        setErrorMessage(payload.message ?? "Live loans need reassignment before this change can continue.");
        onReassignmentRequired(payload as ManagedCollectorReassignmentRequiredPayload, performSave);
        return;
      }

      const message = payload?.message ?? "Unable to update this account right now.";
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    setIsSaving(false);
    toast.success(`Updated ${detail.fullName}.`);
    handleOpenChange(false);
    onSaved();
  }

  function handleRequestSave() {
    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setIsConfirmOpen(true);
  }

  const confirmationLines = [
    selectedRoleName ? `Role: ${selectedRoleName}` : null,
    showCollectorBranchSelector || showSingleBranchSelector
      ? `Branch: ${
          detail?.editableBranchOptions.find((item) => String(item.branchId) === formState?.branchId)?.branchName ?? "None"
        }`
      : null,
    showAreaAssignmentControl
      ? `Area: ${
          detail?.editableAreaOptions.find((item) => String(item.areaId) === formState?.areaId)?.areaCode ?? "None"
        }`
      : null,
    showAuditorBranchSelector
      ? `Audited Branches: ${selectedAuditorBranches.map((item) => branchLabel(item)).join(", ") || "None"}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <>
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{mode === "staffing" ? "Edit Branch Staffing" : "Edit User Account"}</DialogTitle>
            <DialogDescription>
              {mode === "staffing"
                ? "Update the branch staffing controls for this account. Username, company ID, password, and profile details stay in their dedicated flows."
                : "Update the allowed profile fields for this user account."}
            </DialogDescription>
          </DialogHeader>

          {isLoading || !formState || !detail ? (
            <div className="space-y-3">
              <div className="h-10 animate-pulse rounded-md bg-muted" />
              <div className="h-10 animate-pulse rounded-md bg-muted" />
              <div className="h-10 animate-pulse rounded-md bg-muted" />
            </div>
          ) : (
            <div className="space-y-5">
              {mode === "full" ? (
                <>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Name Details</p>
                      <p className="text-xs text-muted-foreground">Keep the user&apos;s legal name fields up to date.</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-first-name">First Name</Label>
                        <Input
                          id="edit-first-name"
                          required
                          onChange={(event) =>
                            setFormState((previous) =>
                              previous ? { ...previous, firstName: event.target.value } : previous,
                            )
                          }
                          value={formState.firstName}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-middle-name">Middle Name</Label>
                        <Input
                          id="edit-middle-name"
                          onChange={(event) =>
                            setFormState((previous) =>
                              previous ? { ...previous, middleName: event.target.value } : previous,
                            )
                          }
                          value={formState.middleName}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-last-name">Last Name</Label>
                        <Input
                          id="edit-last-name"
                          required
                          onChange={(event) =>
                            setFormState((previous) =>
                              previous ? { ...previous, lastName: event.target.value } : previous,
                            )
                          }
                          value={formState.lastName}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Contact Details</p>
                      <p className="text-xs text-muted-foreground">
                        Contact number stays required for Collector and Borrower accounts.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-email">Email</Label>
                        <Input
                          id="edit-email"
                          onChange={(event) =>
                            setFormState((previous) => (previous ? { ...previous, email: event.target.value } : previous))
                          }
                          type="email"
                          value={formState.email}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-contact-no">Contact Number</Label>
                        <Input
                          id="edit-contact-no"
                          inputMode="numeric"
                          maxLength={11}
                          onChange={(event) =>
                            setFormState((previous) =>
                              previous
                                ? { ...previous, contactNo: normalizeAccountContactNo(event.target.value) }
                                : previous,
                            )
                          }
                          placeholder="09XXXXXXXXX"
                          value={formState.contactNo}
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-md border bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
                  This branch edit flow only covers staffing controls: role, branch assignment, and area assignment.
                </div>
              )}

              {showRoleSelector ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Role</p>
                    <p className="text-xs text-muted-foreground">
                      Borrower accounts stay locked. Other roles only show the transitions this editor can actually use.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-role">Role</Label>
                      <Select onValueChange={updateRole} value={formState.roleId}>
                        <SelectTrigger id="edit-role" className="w-full">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((item) => (
                            <SelectItem key={String(item.roleId)} value={String(item.roleId)}>
                              {item.roleName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {detail.roleName === "Collector" &&
                      detail.editableRoleOptions.some((item) => item.roleName === "Secretary") ? (
                        <p className="text-xs text-muted-foreground">
                          This editor can only promote this collector to secretary in this flow.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {showCollectorBranchSelector ||
              showSingleBranchSelector ||
              showAreaAssignmentControl ||
              showAuditorBranchSelector ? (
                <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Assignment Controls</p>
                    <p className="text-xs text-muted-foreground">
                      {mode === "staffing"
                        ? "Only staffing-related controls are available here. Profile fields stay in Manage User Accounts."
                        : "The fields below adapt to the selected role so the required assignment inputs are always visible."}
                    </p>
                  </div>

                  {showCollectorBranchSelector || showSingleBranchSelector ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-branch-assignment">
                          {selectedRoleName === "Collector" ? "Branch" : "Branch Assignment"}
                        </Label>
                        <Select
                          onValueChange={(value) =>
                            setFormState((previous) =>
                              previous
                                ? {
                                    ...previous,
                                    branchId: value,
                                    areaId: selectedRoleName === "Collector" ? "" : previous.areaId,
                                  }
                                : previous,
                            )
                          }
                          value={formState.branchId || undefined}
                        >
                          <SelectTrigger id="edit-branch-assignment" className="w-full">
                            <SelectValue placeholder="Select branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {detail.editableBranchOptions.map((item) => (
                              <SelectItem key={String(item.branchId)} value={String(item.branchId)}>
                                {branchLabel(item)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {showAreaAssignmentControl ? (
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-area-assignment">Area</Label>
                          <Select
                            disabled={!formState.branchId}
                            onValueChange={(value) =>
                              setFormState((previous) => (previous ? { ...previous, areaId: value } : previous))
                            }
                            value={formState.areaId || undefined}
                          >
                            <SelectTrigger id="edit-area-assignment" className="w-full">
                              <SelectValue placeholder={formState.branchId ? "Select area" : "Select branch first"} />
                            </SelectTrigger>
                            <SelectContent>
                              {visibleAreaOptions.map((item) => (
                                <SelectItem key={String(item.areaId)} value={String(item.areaId)}>
                                  {item.areaCode}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {showAuditorBranchSelector ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Audited Branches</p>
                        <p className="text-xs text-muted-foreground">
                          Auditor jurisdiction is multi-branch. Remove branches with the close action or add another one below.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {selectedAuditorBranches.length > 0 ? (
                          selectedAuditorBranches.map((branch) => (
                            <Badge
                              className="flex items-center gap-1.5 border-blue-200 bg-blue-50 px-2 py-1 text-blue-700"
                              key={String(branch.branchId)}
                              variant="outline"
                            >
                              <span>{branchLabel(branch)}</span>
                              <button
                                aria-label={`Remove ${branchLabel(branch)}`}
                                className="rounded-full p-0.5 transition hover:bg-blue-100"
                                onClick={() => removeAuditorBranch(String(branch.branchId))}
                                type="button"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No branches selected yet.</p>
                        )}
                      </div>

                      <div className="space-y-2 rounded-md border bg-background p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            onClick={() => setShowAuditorBranchPicker((previous) => !previous)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            <Plus className="mr-1 h-4 w-4" />
                            Add Branch
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            Existing branch assignments are excluded from the add list.
                          </p>
                        </div>

                        {showAuditorBranchPicker ? (
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                            <Select onValueChange={setAuditorBranchToAdd} value={auditorBranchToAdd}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a branch to add" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableAuditorBranches.map((branch) => (
                                  <SelectItem key={String(branch.branchId)} value={String(branch.branchId)}>
                                    {branchLabel(branch)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              disabled={!auditorBranchToAdd}
                              onClick={addAuditorBranch}
                              size="sm"
                              type="button"
                            >
                              <Plus className="mr-1 h-4 w-4" />
                              Add
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Editing {detail.fullName} ({detail.status}) in {detail.scopeLabel}
              </div>
            </div>
          )}

          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

          <DialogFooter>
            <Button disabled={isSaving} onClick={() => handleOpenChange(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={isLoading || isSaving || !formState}
              onClick={handleRequestSave}
              type="button"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={setIsConfirmOpen} open={isConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply these account changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Review the structural updates below before we save them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 text-sm">
            <p className="font-medium">{detail?.fullName ?? "Selected account"}</p>
            {confirmationLines.map((line) => (
              <p key={line} className="text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={isSaving}
              onClick={(event) => {
                event.preventDefault();
                void performSave();
              }}
            >
              {isSaving ? "Saving..." : "I am sure"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
