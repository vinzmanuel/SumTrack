"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DestructiveDeleteFlow } from "@/app/dashboard/_components/destructive-delete-flow";

export function LoanDeleteButton({
  loanId,
  loanCode,
  redirectHref,
  size = "sm",
}: {
  loanId: number;
  loanCode: string;
  redirectHref?: string;
  size?: "sm" | "default";
}) {
  const router = useRouter();

  async function performDelete() {
    const response = await fetch(`/dashboard/loans/${loanId}/delete`, {
      method: "POST",
      credentials: "same-origin",
    });
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    const message = payload?.message ?? "Unable to delete this loan right now.";

    if (!response.ok) {
      toast.error(message);
      return { ok: false as const, message };
    }

    toast.success(message);

    if (redirectHref) {
      router.push(redirectHref);
      router.refresh();
      return { ok: true as const };
    }

    router.refresh();
    return { ok: true as const };
  }

  return (
    <DestructiveDeleteFlow
      actionPhrase="delete loan"
      description="This is only allowed for Admin and only when the loan has no recorded collections. If the loan has uploaded documents, they will be removed together with the loan record."
      finalActionLabel="Delete loan permanently"
      finalDescription={`This is the last destructive checkpoint before ${loanCode} is permanently deleted from SumTrack.`}
      finalTitle="Are you certain you want to delete this loan?"
      itemLabel="Loan code"
      itemValue={loanCode}
      onExecute={performDelete}
      title="Delete Loan"
      triggerClassName="bg-destructive text-white hover:bg-destructive/90"
      triggerLabel="Delete"
      triggerSize={size}
      warningText={`Deleting ${loanCode} cannot be undone.`}
    />
  );
}
