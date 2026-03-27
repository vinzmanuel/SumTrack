"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  generateOperationalDocumentAction,
} from "@/app/dashboard/reports/actions";
import {
  initialGenerateOperationalDocumentState,
} from "@/app/dashboard/reports/state";
import type { OperationalDocumentTemplateKey } from "@/app/dashboard/reports/types";

function SubmitButton(props: {
  label: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending || props.disabled} size={props.size} type="submit" variant={props.variant}>
      {pending ? "Generating..." : props.label}
    </Button>
  );
}

export function GenerateOperationalDocumentButton(props: {
  templateKey: OperationalDocumentTemplateKey;
  sourceEntityId: number;
  label: string;
  successBehavior?: "stay" | "redirect";
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary";
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    generateOperationalDocumentAction,
    initialGenerateOperationalDocumentState,
  );
  const lastToastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.status === "idle" || !state.message) {
      return;
    }

    const nextToastKey = `${state.status}:${state.result?.reportId ?? state.message}`;
    if (lastToastKeyRef.current === nextToastKey) {
      return;
    }

    lastToastKeyRef.current = nextToastKey;

    if (state.status === "success" && state.result) {
      const reportHref = `/dashboard/reports/${state.result.reportId}`;

      if (props.successBehavior === "redirect") {
        toast.success(`${state.message} Opening report...`);
        router.push(reportHref);
        return;
      }

      toast.success(state.message, {
        action: {
          label: "View report",
          onClick: () => router.push(reportHref),
        },
      });
      return;
    }

    toast.error(state.message);
  }, [props.successBehavior, router, state.message, state.result, state.status]);

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input name="template_key" type="hidden" value={props.templateKey} />
        <input name="source_entity_id" type="hidden" value={String(props.sourceEntityId)} />
        <SubmitButton
          disabled={props.disabled}
          label={props.label}
          size={props.size}
          variant={props.variant}
        />
      </form>
      {props.disabled && props.disabledReason ? (
        <p className="max-w-xs text-xs text-muted-foreground">{props.disabledReason}</p>
      ) : null}
    </div>
  );
}
