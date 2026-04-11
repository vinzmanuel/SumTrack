"use client";

import { Check } from "lucide-react";
import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { UI_CONTROL_CLASS_NAME, UI_SURFACE_CLASS_NAME } from "@/app/dashboard/_components/ui-patterns";
import { Button } from "@/components/ui/button";
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
import type { ExpenseBranchOption } from "@/app/dashboard/expenses/types";
import { cn } from "@/lib/utils";

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
  branchId?: number | null;
  branchName?: string | null;
  branchOptions?: ExpenseBranchOption[];
  canChooseBranch?: boolean;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      className="h-11 rounded-md bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700 hover:text-white dark:bg-green-500/60 dark:text-white dark:hover:bg-green-500/80 dark:hover:text-white"
      disabled={pending}
      type="submit"
    >
      {pending ? "Saving..." : "Save Expense"}
    </Button>
  );
}

function Field({
  children,
  className,
  invalid = false,
}: {
  children: ReactNode;
  className?: string;
  invalid?: boolean;
}) {
  return (
    <div
      className={cn(
        "space-y-2 data-[invalid=true]:[&_label]:text-destructive",
        className,
      )}
      data-invalid={invalid || undefined}
    >
      {children}
    </div>
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

export function CreateExpenseForm({
  branchId = null,
  branchName = null,
  branchOptions = [],
  canChooseBranch = false,
}: CreateExpenseFormProps) {
  const [state, formAction] = useActionState(createExpenseAction, initialCreateExpenseState);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedSubmitRef = useRef(false);

  const [selectedBranchId, setSelectedBranchId] = useState(branchId ? String(branchId) : "");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [expenseDate, setExpenseDate] = useState(getTodayDateString());
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);
  const amountDisplay = formatMoneyDisplay(amountRaw);
  const amountPreview = amountDisplay ? `\u20B1${amountDisplay}` : "";
  const selectedBranchName =
    canChooseBranch
      ? branchOptions.find((option) => String(option.branch_id) === selectedBranchId)?.branch_name ?? "N/A"
      : branchName ?? "N/A";

  useEffect(() => {
    if (state.status !== "success" || !state.result) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      confirmedSubmitRef.current = false;
      setIsConfirmOpen(false);
      setIsSuccessOpen(true);
      setExpenseCategory("");
      setDescription("");
      setAmountRaw("");
      setExpenseDate(getTodayDateString());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [state.result, state.status]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmedSubmitRef.current) {
      confirmedSubmitRef.current = false;
      return;
    }

    event.preventDefault();
    setIsConfirmOpen(true);
  }

  function handleConfirmCreate() {
    setIsConfirmOpen(false);
    confirmedSubmitRef.current = true;
    formRef.current?.requestSubmit();
  }

  return (
    <div className="space-y-4">
      <div className={UI_SURFACE_CLASS_NAME}>
        <form action={formAction} className="space-y-4 px-4 py-4 md:px-5" onSubmit={handleSubmit} ref={formRef}>
          <section className="space-y-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight text-foreground md:text-[1.05rem]">
                Expense Details
              </h2>
              <p className="text-sm text-muted-foreground">
                Capture the branch, category, amount, and expense date before saving this record.
              </p>
            </div>
            <input name="amount" type="hidden" value={amountRaw} />
            <input name="branch_id" type="hidden" value={canChooseBranch ? selectedBranchId : String(branchId ?? "")} />
            {canChooseBranch ? (
              <Field invalid={Boolean(state.fieldErrors?.branch_id)}>
                <Label>Branch</Label>
                <Select onValueChange={setSelectedBranchId} value={selectedBranchId}>
                  <SelectTrigger
                    aria-invalid={Boolean(state.fieldErrors?.branch_id) || undefined}
                    className={`${UI_CONTROL_CLASS_NAME} w-full`}
                  >
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branchOptions.map((option) => (
                      <SelectItem key={option.branch_id} value={String(option.branch_id)}>
                        {option.branch_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {state.fieldErrors?.branch_id ? (
                  <p className="text-sm text-destructive" data-slot="field-error">{state.fieldErrors.branch_id}</p>
                ) : null}
              </Field>
            ) : (
              <Field>
                <Label>Branch</Label>
                <Input className={UI_CONTROL_CLASS_NAME} readOnly value={branchName ?? "N/A"} />
              </Field>
            )}

            <Field invalid={Boolean(state.fieldErrors?.expense_category)}>
              <Label>Expense Category</Label>
              <Select onValueChange={setExpenseCategory} value={expenseCategory}>
                <SelectTrigger
                  aria-invalid={Boolean(state.fieldErrors?.expense_category) || undefined}
                  className={`${UI_CONTROL_CLASS_NAME} w-full`}
                >
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
                <p className="text-sm text-destructive" data-slot="field-error">{state.fieldErrors.expense_category}</p>
              ) : null}
            </Field>

            <Field invalid={Boolean(state.fieldErrors?.description)}>
              <Label htmlFor="description">
                Description
                {expenseCategory === "Miscellaneous" ? (
                  <span className="ml-1 text-destructive">*</span>
                ) : null}
              </Label>
              <textarea
                aria-invalid={Boolean(state.fieldErrors?.description) || undefined}
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
                <p className="text-sm text-destructive" data-slot="field-error">{state.fieldErrors.description}</p>
              ) : null}
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field invalid={Boolean(state.fieldErrors?.amount)}>
                <Label htmlFor="amount">Amount</Label>
                <div className="relative">
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    ₱
                  </span>
                  <Input
                    aria-invalid={Boolean(state.fieldErrors?.amount) || undefined}
                    className={`${UI_CONTROL_CLASS_NAME} pl-7`}
                    id="amount"
                    inputMode="decimal"
                    onChange={(event) => setAmountRaw(sanitizeNumericInput(event.target.value))}
                    placeholder="0"
                    type="text"
                    value={amountDisplay}
                  />
                </div>
                {state.fieldErrors?.amount ? (
                  <p className="text-sm text-destructive" data-slot="field-error">{state.fieldErrors.amount}</p>
                ) : null}
              </Field>

              <Field invalid={Boolean(state.fieldErrors?.expense_date)}>
                <Label htmlFor="expense_date">Expense Date</Label>
                <Input
                  aria-invalid={Boolean(state.fieldErrors?.expense_date) || undefined}
                  className={UI_CONTROL_CLASS_NAME}
                  id="expense_date"
                  name="expense_date"
                  onChange={(event) => setExpenseDate(event.target.value)}
                  type="date"
                  value={expenseDate}
                />
                {state.fieldErrors?.expense_date ? (
                  <p className="text-sm text-destructive" data-slot="field-error">{state.fieldErrors.expense_date}</p>
                ) : null}
              </Field>
            </div>

          </section>

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
                  <span className="font-medium">Branch:</span> {selectedBranchName}
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

          <Dialog onOpenChange={setIsSuccessOpen} open={isSuccessOpen}>
            <DialogContent className="border-emerald-200 bg-background shadow-xl dark:border-emerald-500/25 sm:max-w-md">
              <DialogHeader className="items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm dark:bg-emerald-500/85">
                  <Check className="size-8 stroke-[3]" />
                </div>
                <DialogTitle className="text-2xl font-semibold text-foreground">Expense Saved</DialogTitle>
                <DialogDescription className="max-w-sm text-base text-muted-foreground">
                  {state.message ?? "The expense entry was saved successfully."}
                </DialogDescription>
              </DialogHeader>

              {state.result ? (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-100">
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
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
      </div>
    </div>
  );
}

