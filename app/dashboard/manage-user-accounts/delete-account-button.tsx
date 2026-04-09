"use client";

import { cloneElement, isValidElement, type MouseEvent as ReactMouseEvent, type ReactElement } from "react";
import { toast } from "sonner";
import { DestructiveDeleteFlow } from "@/app/dashboard/_components/destructive-delete-flow";
import type {
  ManagedCollectorReassignmentRequiredPayload,
  ManagedUserMutationErrorPayload,
} from "@/app/dashboard/manage-user-accounts/types";

export function DeleteAccountButton({
  userId,
  userLabel,
  onDeleted,
  onReassignmentRequired,
  trigger,
}: {
  userId: string;
  userLabel: string;
  onDeleted: () => void;
  onReassignmentRequired: (
    blocked: ManagedCollectorReassignmentRequiredPayload,
    retryAction: () => Promise<void>,
  ) => void;
  trigger?: ReactElement<{ onClick?: (event: ReactMouseEvent<HTMLElement>) => void }>;
}) {
  async function performDelete() {
    const response = await fetch(`/dashboard/manage-user-accounts/${userId}/delete`, {
      method: "POST",
      credentials: "same-origin",
    });
    const payload = (await response.json().catch(() => null)) as ManagedUserMutationErrorPayload | null;

    if (!response.ok) {
      if (payload?.errorType === "reassignment_required" && payload.reassignmentRequired && payload.collectorId) {
        onReassignmentRequired(payload as ManagedCollectorReassignmentRequiredPayload, async () => {
          await performDelete();
        });
        return { ok: false as const, closeDialogs: true };
      }

      const message = payload?.message ?? "Unable to delete this account right now.";
      toast.error(message);
      return { ok: false as const, message };
    }

    toast.success(`${userLabel} was deleted.`);
    onDeleted();
    return { ok: true as const };
  }

  return (
    <DestructiveDeleteFlow
      actionPhrase="delete account"
      description={`This will attempt to permanently remove ${userLabel}. Accounts with linked operational records will still be blocked, and collectors with live loans will require reassignment first.`}
      finalActionLabel="Delete account permanently"
      finalDescription={`This is the last destructive checkpoint before ${userLabel} is deleted. If the account is eligible, the deletion request will run immediately.`}
      finalTitle="Are you certain you want to delete this account?"
      itemLabel="Account"
      itemValue={userLabel}
      onExecute={performDelete}
      title="Delete Account"
      trigger={isValidElement(trigger) ? cloneElement(trigger) : undefined}
      warningText={`Deleting ${userLabel} cannot be undone.`}
    />
  );
}
