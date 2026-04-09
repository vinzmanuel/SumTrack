"use client";

import { cloneElement, isValidElement, useMemo, useState, useTransition, type MouseEvent as ReactMouseEvent, type ReactElement } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DeleteFlowResult =
  | { ok: true }
  | {
      ok: false;
      message?: string | null;
      closeDialogs?: boolean;
    };

type DestructiveDeleteFlowProps = {
  triggerLabel?: string;
  triggerSize?: "sm" | "default";
  triggerClassName?: string;
  trigger?: ReactElement<{ onClick?: (event: ReactMouseEvent<HTMLElement>) => void }>;
  title: string;
  description: string;
  itemLabel: string;
  itemValue: string;
  actionPhrase: string;
  warningText: string;
  finalTitle: string;
  finalDescription: string;
  finalActionLabel: string;
  onExecute: () => Promise<DeleteFlowResult>;
};

type DeletePhase = "closed" | "typed" | "final";

function normalizeConfirmationValue(value: string) {
  return value.trim();
}

function ConfirmationField(props: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2.5">
      <span className="block text-sm font-medium leading-6 text-zinc-200">{props.label}</span>
      <Input
        autoComplete="off"
        className="h-12 rounded-xl border-white/12 bg-black/35 px-4 text-sm text-white placeholder:text-zinc-500 focus-visible:border-red-400/60 focus-visible:ring-red-500/20"
        onChange={(event) => props.onChange(event.target.value)}
        placeholder={props.placeholder}
        spellCheck={false}
        value={props.value}
      />
    </label>
  );
}

export function DestructiveDeleteFlow({
  triggerLabel = "Delete",
  triggerSize = "sm",
  triggerClassName,
  trigger,
  title,
  description,
  itemLabel,
  itemValue,
  actionPhrase,
  warningText,
  finalTitle,
  finalDescription,
  finalActionLabel,
  onExecute,
}: DestructiveDeleteFlowProps) {
  const [phase, setPhase] = useState<DeletePhase>("closed");
  const [typedItemValue, setTypedItemValue] = useState("");
  const [typedActionPhrase, setTypedActionPhrase] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const itemValuePrompt = useMemo(() => `To confirm, type "${itemValue}"`, [itemValue]);
  const actionPhrasePrompt = useMemo(() => `To confirm, type "${actionPhrase}"`, [actionPhrase]);
  const isTypedStepReady =
    normalizeConfirmationValue(typedItemValue) === itemValue &&
    normalizeConfirmationValue(typedActionPhrase) === actionPhrase;

  function resetFlowState() {
    setTypedItemValue("");
    setTypedActionPhrase("");
    setErrorMessage(null);
  }

  function openTypedStep() {
    resetFlowState();
    setPhase("typed");
  }

  function closeAll() {
    if (isPending) {
      return;
    }

    resetFlowState();
    setPhase("closed");
  }

  function goToFinalStep() {
    if (!isTypedStepReady || isPending) {
      return;
    }

    setErrorMessage(null);
    setPhase("final");
  }

  function returnToTypedStep() {
    if (isPending) {
      return;
    }

    setPhase("typed");
  }

  function handleExecute() {
    setErrorMessage(null);

    startTransition(async () => {
      const result = await onExecute();

      if (result.ok || result.closeDialogs) {
        resetFlowState();
        setPhase("closed");
        return;
      }

      setErrorMessage(result.message ?? "Unable to complete this delete request right now.");
    });
  }

  return (
    <>
      {isValidElement(trigger) ? (
        cloneElement(trigger, {
          onClick: (event: ReactMouseEvent<HTMLElement>) => {
            trigger.props.onClick?.(event);
            if (!event.defaultPrevented) {
              openTypedStep();
            }
          },
        })
      ) : (
        <Button
          className={triggerClassName ?? "bg-destructive text-white hover:bg-destructive/90"}
          onClick={openTypedStep}
          size={triggerSize}
          type="button"
        >
          {triggerLabel}
        </Button>
      )}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            closeAll();
          }
        }}
        open={phase === "typed"}
      >
        <AlertDialogContent className="max-w-[36rem] overflow-hidden border border-white/10 bg-[#09090b] p-0 text-white shadow-2xl shadow-black/60">
          <AlertDialogHeader className="gap-4 px-7 pb-6 pt-7 text-left">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-red-200">
                <TriangleAlert className="size-5" />
              </div>
              <div className="space-y-3">
                <AlertDialogTitle className="text-3xl font-semibold tracking-tight text-white">
                  {title}
                </AlertDialogTitle>
                <AlertDialogDescription className="max-w-xl text-sm leading-7 text-zinc-300">
                  {description}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="border-y border-white/10 bg-white/[0.03] px-7 py-6">
            <div className="space-y-5">
              <ConfirmationField
                label={itemValuePrompt}
                onChange={setTypedItemValue}
                placeholder={itemLabel}
                value={typedItemValue}
              />
              <ConfirmationField
                label={actionPhrasePrompt}
                onChange={setTypedActionPhrase}
                placeholder={actionPhrase}
                value={typedActionPhrase}
              />
            </div>
          </div>

          <div className="space-y-4 px-7 py-6">
            <div className="rounded-2xl border border-red-500/20 bg-red-500/12 px-4 py-3 text-sm text-red-100">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <p className="leading-6">{warningText}</p>
              </div>
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {errorMessage}
              </div>
            ) : null}
          </div>

          <AlertDialogFooter className="border-t border-white/10 bg-black/30 px-7 py-5 sm:flex-row sm:items-center sm:justify-between">
            <AlertDialogCancel
              className="border-white/12 bg-transparent text-zinc-100 hover:bg-white/6 hover:text-white"
              disabled={isPending}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              className="min-w-40 rounded-xl bg-red-600 text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-950 disabled:text-red-200"
              disabled={!isTypedStepReady || isPending}
              onClick={goToFinalStep}
              type="button"
            >
              Continue
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            returnToTypedStep();
          }
        }}
        open={phase === "final"}
      >
        <AlertDialogContent className="max-w-[30rem] border border-red-500/20 bg-[#09090b] p-0 text-white shadow-2xl shadow-black/70">
          <div className="space-y-5 px-7 pb-6 pt-7">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-red-200">
                {isPending ? <Loader2 className="size-5 animate-spin" /> : <TriangleAlert className="size-5" />}
              </div>
              <div className="space-y-3">
                <AlertDialogTitle className="text-2xl font-semibold tracking-tight text-white">
                  {finalTitle}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-7 text-zinc-300">
                  {finalDescription}
                </AlertDialogDescription>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">{itemLabel}</p>
              <p className="mt-2 text-base font-semibold text-zinc-50">{itemValue}</p>
            </div>

            {errorMessage ? (
              <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {errorMessage}
              </div>
            ) : null}
          </div>

          <AlertDialogFooter className="border-t border-white/10 bg-black/30 px-7 py-5 sm:flex-row sm:items-center sm:justify-between">
            <AlertDialogCancel
              className="border-white/12 bg-transparent text-zinc-100 hover:bg-white/6 hover:text-white"
              disabled={isPending}
            >
              Back
            </AlertDialogCancel>
            <Button
              className="min-w-44 rounded-xl bg-red-600 text-white hover:bg-red-500"
              disabled={isPending}
              onClick={handleExecute}
              type="button"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                finalActionLabel
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
