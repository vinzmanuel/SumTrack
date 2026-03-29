"use client";

import { useActionState, useEffect } from "react";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { finalizeIncentivePayoutAction } from "@/app/dashboard/incentives/actions";
import { initialFinalizeIncentiveState } from "@/app/dashboard/incentives/state";

type FinalizePayoutFormProps = {
  branchId: number;
  month: string;
  canFinalize: boolean;
  lockReason?: string;
  hidden?: boolean;
  showLockAlert?: boolean;
  inline?: boolean;
};

export function FinalizePayoutForm({
  branchId,
  month,
  canFinalize,
  lockReason,
  hidden = false,
  showLockAlert = true,
  inline = false,
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
      <Button className="w-full sm:w-auto" disabled={!canFinalize || pending} size="sm" type="submit">
        {pending ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
        {pending ? "Finalizing..." : "Finalize & Export"}
      </Button>
    );
  }

  return (
    <form action={formAction} className={inline ? "flex flex-wrap items-center gap-2" : "flex flex-col gap-3"}>
      <input name="branch_id" type="hidden" value={String(branchId)} />
      <input name="month" type="hidden" value={month} />

      <SubmitButton />

      {!canFinalize && lockReason && showLockAlert ? (
        <Alert>
          <CircleAlert className="size-4" />
          <AlertTitle>Finalization locked</AlertTitle>
          <AlertDescription>{lockReason}</AlertDescription>
        </Alert>
      ) : null}

      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <CircleAlert className="size-4" />
          <AlertTitle>Unable to finalize payout</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {state.status === "success" && state.message ? (
        <Alert className="border-emerald-200 bg-emerald-50/70 text-emerald-900">
          <CircleCheck className="size-4" />
          <AlertTitle>Payout finalized</AlertTitle>
          <AlertDescription className="text-emerald-800">{state.message}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
