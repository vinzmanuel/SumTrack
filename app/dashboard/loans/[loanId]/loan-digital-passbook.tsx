"use client";

import { Fragment, useActionState, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "@/components/ui/sonner";
import { createCollectionAction } from "@/app/dashboard/loans/[loanId]/actions";
import { initialLoanDetailState, type CollectionHistoryRow } from "@/app/dashboard/loans/[loanId]/state";

type LoanDetailFormProps = {
  loanId: string;
  assignedCollectorLabel: string;
  initialCollections: CollectionHistoryRow[];
  totalPayable: number;
  canRecordCollections: boolean;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="active:scale-[0.98]" disabled={pending} type="submit">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending ? "Saving..." : "Record Collection"}
    </Button>
  );
}

function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function sanitizeNumericInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const firstDotIndex = cleaned.indexOf(".");
  if (firstDotIndex === -1) {
    return cleaned;
  }

  const intPart = cleaned.slice(0, firstDotIndex);
  const decimalPart = cleaned.slice(firstDotIndex + 1).replace(/\./g, "");
  return `${intPart}.${decimalPart}`;
}

function formatMoneyDisplay(rawValue: string) {
  if (!rawValue) {
    return "";
  }

  const [intPartRaw, decimalPartRaw] = rawValue.split(".");
  const intPart = intPartRaw || "0";
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (decimalPartRaw === undefined) {
    return formattedInt;
  }

  return `${formattedInt}.${decimalPartRaw}`;
}

function getTodayDateString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sortCollections(rows: CollectionHistoryRow[]) {
  return [...rows].sort((a, b) => {
    if (a.collectionDate !== b.collectionDate) {
      return a.collectionDate.localeCompare(b.collectionDate);
    }

    return a.collectionId.localeCompare(b.collectionId, undefined, { numeric: true });
  });
}

function buildExpandedCollectionDetails(row: CollectionHistoryRow) {
  return [
    { label: "Collection Code", value: row.collectionCode },
    { label: "Collector", value: row.collectorName },
    { label: "Encoded By", value: row.encodedByName },
  ];
}

function ExpandedDetailRows(props: {
  details: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="space-y-3">
      {props.details.map((detail) => (
        <div
          className="grid items-start gap-x-6 gap-y-1 border-b border-border/50 pb-3 last:border-b-0 last:pb-0 md:grid-cols-[160px_minmax(0,1fr)]"
          key={`${detail.label}-${detail.value}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 md:pt-1">
            {detail.label}
          </p>
          <p className="text-sm leading-6 text-foreground">{detail.value}</p>
        </div>
      ))}
    </div>
  );
}

export function LoanDetailForm({
  loanId,
  assignedCollectorLabel,
  initialCollections,
  totalPayable,
  canRecordCollections,
}: LoanDetailFormProps) {
  const [state, formAction] = useActionState(createCollectionAction, initialLoanDetailState);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedSubmitRef = useRef(false);
  const lastToastKeyRef = useRef<string | null>(null);
  const successToastIdRef = useRef<string | number | null>(null);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [collectionDate, setCollectionDate] = useState(getTodayDateString());
  const [missedPayment, setMissedPayment] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [localNoteError, setLocalNoteError] = useState("");
  const [expandedCollectionId, setExpandedCollectionId] = useState<string | null>(null);
  const amountDisplay = formatMoneyDisplay(amount);
  const amountPreview = amountDisplay ? `\u20B1${amountDisplay}` : "";

  const historyRows = useMemo(() => {
    const byId = new Map<string, CollectionHistoryRow>();

    initialCollections.forEach((row) => {
      byId.set(row.collectionId, row);
    });

    (state.appendedRows ?? []).forEach((row) => {
      byId.set(row.collectionId, row);
    });

    return sortCollections(Array.from(byId.values()));
  }, [initialCollections, state.appendedRows]);

  const historyWithBalance = useMemo(() => {
    const accumulator = historyRows.reduce<{
      runningPaid: number;
      rows: Array<CollectionHistoryRow & { outstandingBalance: number }>;
    }>(
      (state, row) => {
        const nextRunningPaid = state.runningPaid + row.amount;

        return {
          runningPaid: nextRunningPaid,
          rows: [
            ...state.rows,
            {
              ...row,
              outstandingBalance: Math.max(totalPayable - nextRunningPaid, 0),
            },
          ],
        };
      },
      { runningPaid: 0, rows: [] },
    );

    return accumulator.rows;
  }, [historyRows, totalPayable]);

  const noteFieldError =
    localNoteError || (missedPayment && !note.trim() ? "Note is required for missed payment." : "") || "";

  function resetCollectionForm() {
    setAmount("");
    setNote("");
    setCollectionDate(getTodayDateString());
    setMissedPayment(false);
    setLocalNoteError("");
    setIsConfirmOpen(false);
    confirmedSubmitRef.current = false;
  }

  useEffect(() => {
    return () => {
      if (successToastIdRef.current !== null) {
        toast.dismiss(successToastIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state.status === "idle" || !state.message) {
      return;
    }

    const nextToastKey = `${state.status}:${state.result?.collectionCode ?? state.message}`;
    if (lastToastKeyRef.current === nextToastKey) {
      return;
    }

    lastToastKeyRef.current = nextToastKey;

    if (state.status === "success") {
      if (successToastIdRef.current !== null) {
        toast.dismiss(successToastIdRef.current);
      }

      successToastIdRef.current = toast.success(state.message, {
        closeButton: true,
        duration: Infinity,
      });

      const timeoutId = window.setTimeout(() => {
        setIsFormOpen(false);
        resetCollectionForm();
        router.refresh();
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    toast.error(state.message);
  }, [router, state.message, state.result?.collectionCode, state.status]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmedSubmitRef.current) {
      confirmedSubmitRef.current = false;
      return;
    }

    if (missedPayment && !note.trim()) {
      event.preventDefault();
      setLocalNoteError("Note is required for missed payment.");
      return;
    }

    setLocalNoteError("");
    event.preventDefault();
    setIsConfirmOpen(true);
  }

  function handleConfirmSubmit() {
    setIsConfirmOpen(false);
    confirmedSubmitRef.current = true;
    formRef.current?.requestSubmit();
  }

  function toggleMissedPayment(nextValue: boolean) {
    setMissedPayment(nextValue);
    if (nextValue) {
      setAmount("0");
    } else {
      setAmount("");
      setLocalNoteError("");
    }
  }

  function openCollectionForm() {
    resetCollectionForm();
    setIsFormOpen(true);
  }

  const collectionForm = (
    <form action={formAction} className="space-y-4" onSubmit={handleSubmit} ref={formRef}>
      <input name="loan_id" type="hidden" value={loanId} />
      <input name="amount" type="hidden" value={amount} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <div className="relative">
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
              {"\u20B1"}
            </span>
            <Input
              className="pl-7"
              disabled={missedPayment}
              id="amount"
              inputMode="decimal"
              onChange={(event) => setAmount(sanitizeNumericInput(event.target.value))}
              placeholder="0"
              type="text"
              value={amountDisplay}
            />
          </div>
          {state.fieldErrors?.amount ? (
            <p className="text-sm text-destructive">{state.fieldErrors.amount}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="collection_date">Collection Date</Label>
          <Input
            id="collection_date"
            name="collection_date"
            onChange={(event) => setCollectionDate(event.target.value)}
            type="date"
            value={collectionDate}
          />
          {state.fieldErrors?.collection_date ? (
            <p className="text-sm text-destructive">{state.fieldErrors.collection_date}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">
          Note
          {missedPayment ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>
        <textarea
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          id="note"
          name="note"
          onChange={(event) => {
            setNote(event.target.value);
            if (localNoteError || state.fieldErrors?.note) {
              setLocalNoteError("");
            }
          }}
          placeholder={missedPayment ? "Reason for missed payment" : "Optional note"}
          value={note}
        />
        {noteFieldError || state.fieldErrors?.note ? (
          <p className="text-sm text-destructive">{noteFieldError || state.fieldErrors?.note}</p>
        ) : null}
      </div>

      <input type="hidden" name="missed_payment" value={missedPayment ? "on" : ""} />

      <label className="flex items-center gap-2 text-sm">
        <input
          checked={missedPayment}
          className="h-4 w-4"
          onChange={(event) => toggleMissedPayment(event.target.checked)}
          type="checkbox"
        />
        <span>Missed Payment</span>
      </label>

      {state.status === "error" && state.message ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}

      <SubmitButton />
    </form>
  );

  return (
    <div className="space-y-6">
      {canRecordCollections ? (
        <Dialog onOpenChange={setIsFormOpen} open={isFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Collection</DialogTitle>
              <DialogDescription>Record a payment or missed payment for this loan.</DialogDescription>
            </DialogHeader>
            {collectionForm}
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog onOpenChange={setIsConfirmOpen} open={isConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Collection Entry</DialogTitle>
            <DialogDescription>Please review the details before saving this collection.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Collector:</span> {assignedCollectorLabel || "N/A"}
            </p>
            <p>
              <span className="font-medium">Amount:</span>{" "}
              {missedPayment ? "Missed Payment (\u20B10.00)" : amountPreview || "N/A"}
            </p>
            <p>
              <span className="font-medium">Collection Date:</span> {collectionDate || "N/A"}
            </p>
            {note ? (
              <p>
                <span className="font-medium">Note:</span> {note}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button onClick={() => setIsConfirmOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button className="active:scale-[0.98]" onClick={handleConfirmSubmit} type="button">
              Confirm Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Digital Passbook</CardTitle>
            <CardDescription>
              Click a row to reveal the collection code, collector, and encoder details.
            </CardDescription>
          </div>
          <CardAction>
            {canRecordCollections ? (
              <Button
                className="bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]"
                onClick={openCollectionForm}
                size="sm"
                type="button"
              >
                <Plus className="h-4 w-4" />
                Record Collection
              </Button>
            ) : null}
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {historyWithBalance.length === 0 ? (
            <p className="text-sm text-muted-foreground">No collections recorded yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/70">
              <div className="overflow-auto">
              <table className="min-w-245 w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-40" />
                  <col className="w-40" />
                  <col className="w-40" />
                  <col className="w-40" />
                  <col />
                  <col className="w-27" />
                </colgroup>
                <thead>
                  <tr className="border-b text-left">
                    <th className="border-r border-border/70 px-3 py-2.5 font-medium">Date</th>
                    <th className="border-r border-border/70 px-3 py-2.5 font-medium">Principal + Interest</th>
                    <th className="border-r border-border/70 px-3 py-2.5 font-medium">Outstanding Balance</th>
                    <th className="border-r border-border/70 px-3 py-2.5 font-medium">Amount</th>
                    <th className="border-r border-border/70 px-3 py-2.5 font-medium">Note</th>
                    <th className="w-28 px-3 py-2.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {historyWithBalance.map((row) => {
                    const isExpanded = expandedCollectionId === row.collectionId;
                    const isMissedPaymentNote = row.amount === 0 && Boolean(row.note?.trim());

                    return (
                      <Fragment key={row.collectionId}>
                        <tr
                          aria-expanded={isExpanded}
                          className="cursor-pointer border-b transition-colors hover:bg-muted/30"
                          onClick={() =>
                            setExpandedCollectionId((current) =>
                              current === row.collectionId ? null : row.collectionId,
                            )
                          }
                        >
                          <td className="border-r border-border/70 px-3 py-3">{row.collectionDate}</td>
                          <td className="border-r border-border/70 px-3 py-3">{formatMoney(totalPayable)}</td>
                          <td className="border-r border-border/70 px-3 py-3">{formatMoney(row.outstandingBalance)}</td>
                          <td className="border-r border-border/70 px-3 py-3">{formatMoney(row.amount)}</td>
                          <td className="border-r border-border/70 px-3 py-3 whitespace-normal wrap-break-word">
                            <span className={isMissedPaymentNote ? "font-medium text-destructive" : ""}>
                              {row.note || "-"}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                              {isExpanded ? (
                                <>
                                  Hide details <ChevronUp className="h-3.5 w-3.5" />
                                </>
                              ) : (
                                <>
                                  View details <ChevronDown className="h-3.5 w-3.5" />
                                </>
                              )}
                            </span>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr className="border-b bg-muted/15">
                            <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={6}>
                              <div className="px-1 py-1">
                                <ExpandedDetailRows details={buildExpandedCollectionDetails(row)} />
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
