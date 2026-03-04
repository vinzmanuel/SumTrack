"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

  return (
    <form action={formAction} className="space-y-2">
      <input name="branch_id" type="hidden" value={String(branchId)} />
      <input name="month" type="hidden" value={month} />

      <Button disabled={!canFinalize} type="submit">
        Finalize &amp; Export
      </Button>

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
