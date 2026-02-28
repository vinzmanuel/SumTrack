"use client";

import { useActionState, useMemo, useRef, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCollectionAction } from "@/app/dashboard/loans/[loanId]/actions";
import {
  initialLoanDetailState,
  type CollectionHistoryRow,
} from "@/app/dashboard/loans/[loanId]/state";

type CollectorOption = {
  user_id: string;
  label: string;
};

type LoanDetailFormProps = {
  loanId: string;
  collectors: CollectorOption[];
  initialCollections: CollectionHistoryRow[];
  totalPayable: number;
  estimatedDailyPayment: number | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Saving..." : "Record Collection"}
    </Button>
  );
}

function formatMoney(value: number) {
  return value.toFixed(2);
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

export function LoanDetailForm({
  loanId,
  collectors,
  initialCollections,
  totalPayable,
  estimatedDailyPayment,
}: LoanDetailFormProps) {
  const [state, formAction] = useActionState(createCollectionAction, initialLoanDetailState);
  const formRef = useRef<HTMLFormElement>(null);

  const [collectorId, setCollectorId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [collectionDate, setCollectionDate] = useState(getTodayDateString());
  const [missedPayment, setMissedPayment] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isConfirmedSubmit, setIsConfirmedSubmit] = useState(false);
  const hasCollectors = collectors.length > 0;

  const selectedCollector = useMemo(
    () => collectors.find((collector) => collector.user_id === collectorId) ?? null,
    [collectorId, collectors],
  );

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isConfirmedSubmit) {
      setIsConfirmedSubmit(false);
      return;
    }

    event.preventDefault();
    setIsConfirmOpen(true);
  }

  function handleConfirmSubmit() {
    setIsConfirmOpen(false);
    setIsConfirmedSubmit(true);
    formRef.current?.requestSubmit();
  }

  function toggleMissedPayment(nextValue: boolean) {
    setMissedPayment(nextValue);
    if (nextValue) {
      setAmount("0");
    } else {
      setAmount("");
    }
  }

  const historyWithBalance = useMemo(() => {
    const result = historyRows.reduce<{
      runningPaid: number;
      rows: Array<CollectionHistoryRow & { outstandingBalance: number }>;
    }>(
      (accumulator, row) => {
        const nextRunningPaid = accumulator.runningPaid + row.amount;

        return {
          runningPaid: nextRunningPaid,
          rows: [
            ...accumulator.rows,
            {
              ...row,
              outstandingBalance: totalPayable - nextRunningPaid,
            },
          ],
        };
      },
      { runningPaid: 0, rows: [] },
    );

    return result.rows;
  }, [historyRows, totalPayable]);

  const collectionForm = (
    <form action={formAction} className="space-y-4" onSubmit={handleSubmit} ref={formRef}>
      <input name="loan_id" type="hidden" value={loanId} />
      <input name="collector_id" type="hidden" value={collectorId} />

      <div className="space-y-2">
        <Label>Collector</Label>
        <Select onValueChange={setCollectorId} value={collectorId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select collector" />
          </SelectTrigger>
          <SelectContent>
            {collectors.map((collector) => (
              <SelectItem key={collector.user_id} value={collector.user_id}>
                {collector.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {state.fieldErrors?.collector_id ? (
          <p className="text-sm text-destructive">{state.fieldErrors.collector_id}</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            disabled={missedPayment}
            id="amount"
            min="0"
            name="amount"
            onChange={(event) => setAmount(event.target.value)}
            step="0.01"
            type="number"
            value={amount}
          />
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
        <Label htmlFor="note">Note</Label>
        <textarea
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          id="note"
          name="note"
          onChange={(event) => setNote(event.target.value)}
          placeholder={missedPayment ? "Reason for missed payment" : "Optional note"}
          value={note}
        />
        {state.fieldErrors?.note ? (
          <p className="text-sm text-destructive">{state.fieldErrors.note}</p>
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
      <Dialog onOpenChange={setIsFormOpen} open={isFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Collection</DialogTitle>
            <DialogDescription>Record a payment or missed payment for this loan.</DialogDescription>
          </DialogHeader>
          {hasCollectors ? (
            collectionForm
          ) : (
            <p className="text-sm text-muted-foreground">
              No collectors are assigned to this branch.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setIsConfirmOpen} open={isConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Collection Entry</DialogTitle>
            <DialogDescription>
              Please review the details before saving this collection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Collector:</span> {selectedCollector?.label || "N/A"}
            </p>
            <p>
              <span className="font-medium">Amount:</span>{" "}
              {missedPayment ? "Missed Payment (0.00)" : amount || "N/A"}
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
            <Button onClick={handleConfirmSubmit} type="button">
              Confirm Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {state.status === "success" && state.result ? (
        <Card>
          <CardHeader>
            <CardTitle>Collection Saved</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Collection ID:</span> {state.result.collectionId}
            </p>
            <p>
              <span className="font-medium">Collection Date:</span> {state.result.collectionDate}
            </p>
            <p>
              <span className="font-medium">Amount:</span> {formatMoney(state.result.amount)}
            </p>
            <p>
              <span className="font-medium">Collector:</span> {state.result.collectorName}
            </p>
            {state.result.note ? (
              <p>
                <span className="font-medium">Note:</span> {state.result.note}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Collection History</CardTitle>
          <CardAction>
            <Button
              disabled={!hasCollectors}
              onClick={() => setIsFormOpen(true)}
              size="sm"
              type="button"
            >
              + Add Payment Collection
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {!hasCollectors ? (
            <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
              No collectors are assigned to this branch.
            </p>
          ) : null}
          {historyWithBalance.length === 0 ? (
            <p className="text-muted-foreground text-sm">No collections recorded yet.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-225 text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Principal + Interest</th>
                    <th className="px-2 py-2 font-medium">Daily Payment</th>
                    <th className="px-2 py-2 font-medium">Outstanding Balance</th>
                    <th className="px-2 py-2 font-medium">Amount</th>
                    <th className="px-2 py-2 font-medium">Collector</th>
                    <th className="px-2 py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {historyWithBalance.map((row) => (
                    <tr className="border-b" key={row.collectionId}>
                      <td className="px-2 py-2">{row.collectionDate}</td>
                      <td className="px-2 py-2">{formatMoney(totalPayable)}</td>
                      <td className="px-2 py-2">
                        {estimatedDailyPayment !== null ? formatMoney(estimatedDailyPayment) : "N/A"}
                      </td>
                      <td className="px-2 py-2">{formatMoney(row.outstandingBalance)}</td>
                      <td className="px-2 py-2">{formatMoney(row.amount)}</td>
                      <td className="px-2 py-2">{row.collectorName}</td>
                      <td className="px-2 py-2 text-red-500">{row.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
