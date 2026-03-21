"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
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
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary";
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, formAction] = useActionState(
    generateOperationalDocumentAction,
    initialGenerateOperationalDocumentState,
  );
  const lastToastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.status === "idle" || !state.message) {
      return;
    }

    const nextToastKey = `${state.status}:${state.message}`;
    if (lastToastKeyRef.current === nextToastKey) {
      return;
    }

    lastToastKeyRef.current = nextToastKey;

    if (state.status === "success") {
      toast.success(state.message);
      return;
    }

    toast.error(state.message);
  }, [state.message, state.status]);

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
      {state.status === "success" && state.result ? (
        <Link
          className="inline-flex text-xs font-medium text-emerald-700 underline underline-offset-4 hover:text-emerald-800"
          href={`/dashboard/reports/${state.result.reportId}`}
        >
          View saved document
        </Link>
      ) : null}
    </div>
  );
}
