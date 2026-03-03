"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { createExpenseAction } from "@/app/dashboard/expenses/create/actions";
import { initialCreateExpenseState } from "@/app/dashboard/expenses/create/state";

const EXPENSE_CATEGORIES = [
  "Rent",
  "Electricity",
  "Water",
  "Transportation",
  "Lunch",
  "Salary",
  "Miscellaneous",
] as const;

type CreateExpenseFormProps = {
  branchName: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Saving..." : "Save Expense"}
    </Button>
  );
}

function getTodayDateString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export function CreateExpenseForm({ branchName }: CreateExpenseFormProps) {
  const [state, formAction] = useActionState(createExpenseAction, initialCreateExpenseState);
  const formRef = useRef<HTMLFormElement>(null);

  const [expenseCategory, setExpenseCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [expenseDate, setExpenseDate] = useState(getTodayDateString());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isConfirmedSubmit, setIsConfirmedSubmit] = useState(false);
  const amountDisplay = formatMoneyDisplay(amountRaw);
  const amountPreview = amountDisplay ? `\u20B1${amountDisplay}` : "";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isConfirmedSubmit) {
      setIsConfirmedSubmit(false);
      return;
    }

    event.preventDefault();
    setIsConfirmOpen(true);
  }

  function handleConfirmCreate() {
    setIsConfirmOpen(false);
    setIsConfirmedSubmit(true);
    formRef.current?.requestSubmit();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Expense Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4" onSubmit={handleSubmit} ref={formRef}>
            <input name="amount" type="hidden" value={amountRaw} />
            <div className="space-y-2">
              <Label>Branch</Label>
              <Input readOnly value={branchName} />
            </div>

            <div className="space-y-2">
              <Label>Expense Category</Label>
              <Select onValueChange={setExpenseCategory} value={expenseCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select expense category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input name="expense_category" type="hidden" value={expenseCategory} />
              {state.fieldErrors?.expense_category ? (
                <p className="text-sm text-destructive">{state.fieldErrors.expense_category}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description
                {expenseCategory === "Miscellaneous" ? (
                  <span className="ml-1 text-destructive">*</span>
                ) : null}
              </Label>
              <textarea
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                id="description"
                name="description"
                onChange={(event) => setDescription(event.target.value)}
                placeholder={
                  expenseCategory === "Miscellaneous"
                    ? "Describe the actual miscellaneous expense"
                    : "Optional description"
                }
                value={description}
              />
              {expenseCategory === "Miscellaneous" ? (
                <p className="text-xs text-muted-foreground">
                  For Miscellaneous, description is required and should specify the exact expense.
                </p>
              ) : null}
              {state.fieldErrors?.description ? (
                <p className="text-sm text-destructive">{state.fieldErrors.description}</p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <div className="relative">
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    ₱
                  </span>
                  <Input
                    className="pl-7"
                    id="amount"
                    inputMode="decimal"
                    onChange={(event) => setAmountRaw(sanitizeNumericInput(event.target.value))}
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
                <Label htmlFor="expense_date">Expense Date</Label>
                <Input
                  id="expense_date"
                  name="expense_date"
                  onChange={(event) => setExpenseDate(event.target.value)}
                  type="date"
                  value={expenseDate}
                />
                {state.fieldErrors?.expense_date ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.expense_date}</p>
                ) : null}
              </div>
            </div>

            {state.status === "error" && state.message ? (
              <p className="text-sm text-destructive">{state.message}</p>
            ) : null}

            <SubmitButton />
          </form>

          <Dialog onOpenChange={setIsConfirmOpen} open={isConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Expense Entry</DialogTitle>
                <DialogDescription>
                  Please review the expense details before saving.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Branch:</span> {branchName || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Category:</span> {expenseCategory || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Description:</span> {description || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Amount:</span> {amountPreview || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Expense Date:</span> {expenseDate || "N/A"}
                </p>
              </div>

              <DialogFooter>
                <Button onClick={() => setIsConfirmOpen(false)} type="button" variant="outline">
                  Cancel
                </Button>
                <Button onClick={handleConfirmCreate} type="button">
                  Confirm Save Expense
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {state.status === "success" && state.result ? (
        <Card>
          <CardHeader>
            <CardTitle>Expense Saved</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Branch:</span> {state.result.branchName}
            </p>
            <p>
              <span className="font-medium">Category:</span> {state.result.expenseCategory}
            </p>
            <p>
              <span className="font-medium">Description:</span> {state.result.description}
            </p>
            <p>
              <span className="font-medium">Amount:</span> {formatMoney(state.result.amount)}
            </p>
            <p>
              <span className="font-medium">Expense Date:</span> {state.result.expenseDate}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

