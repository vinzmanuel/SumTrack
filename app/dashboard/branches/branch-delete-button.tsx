"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DestructiveDeleteFlow } from "@/app/dashboard/_components/destructive-delete-flow";

export function BranchDeleteButton({
  branchCode,
  branchName,
}: {
  branchCode: string;
  branchName: string;
}) {
  const router = useRouter();

  async function handleConfirm() {
    const response = await fetch(`/dashboard/branches/${encodeURIComponent(branchCode)}/delete`, {
      method: "POST",
      credentials: "same-origin",
    });

    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    const message = payload?.message ?? "Unable to delete this branch right now.";

    if (!response.ok) {
      toast.error(message);
      return { ok: false as const, message };
    }

    toast.success(message);
    router.push("/dashboard/branches");
    router.refresh();
    return { ok: true as const };
  }

  return (
    <DestructiveDeleteFlow
      actionPhrase="delete branch"
      description={`This will permanently delete ${branchName} and only succeeds when the branch no longer has employees, borrowers, live loans, areas, or linked operational records.`}
      finalActionLabel="Delete branch permanently"
      finalDescription={`This is the final checkpoint before ${branchName} is removed from SumTrack. Once confirmed, the delete request will run immediately.`}
      finalTitle="Are you certain you want to delete this branch?"
      itemLabel="Branch code"
      itemValue={branchCode}
      onExecute={handleConfirm}
      title="Delete Branch"
      triggerClassName="bg-red-600 text-white hover:bg-red-700 hover:text-white"
      triggerLabel="Delete"
      warningText={`Deleting ${branchName} cannot be undone.`}
    />
  );
}
