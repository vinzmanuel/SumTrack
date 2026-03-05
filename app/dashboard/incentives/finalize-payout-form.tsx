"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { finalizeIncentivePayoutAction } from "@/app/dashboard/incentives/actions";
import { initialFinalizeIncentiveState } from "@/app/dashboard/incentives/state";

type FinalizePayoutFormProps = {
  branchId: number;
  month: string;
  canFinalize: boolean;
  lockReason?: string;
  hidden?: boolean;
};

export function FinalizePayoutForm({
  branchId,
  month,
  canFinalize,
  lockReason,
  hidden = false,
}: FinalizePayoutFormProps) {
  const [state, formAction] = useActionState(
    finalizeIncentivePayoutAction,
    initialFinalizeIncentiveState,
  );
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  if (hidden) {
    return null;
  }

  function SubmitButton() {
    const { pending } = useFormStatus();
    return (
      <Button className="active:scale-[0.98]" disabled={!canFinalize || pending} type="submit">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {pending ? "Finalizing..." : "Finalize & Export"}
      </Button>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input name="branch_id" type="hidden" value={String(branchId)} />
      <input name="month" type="hidden" value={month} />

      <SubmitButton />

      {!canFinalize && lockReason ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">{lockReason}</p>
      ) : null}

      {state.status === "error" && state.message ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}

      {state.status === "success" && state.message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{state.message}</p>
      ) : null}
    </form>
  );
}
