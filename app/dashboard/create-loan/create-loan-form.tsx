"use client";

import { useActionState, useMemo, useRef, useState, type FormEvent } from "react";
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
import { createLoanAction } from "@/app/dashboard/create-loan/actions";
import { initialCreateLoanState } from "@/app/dashboard/create-loan/state";

type BorrowerOption = {
  user_id: string;
  label: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
};

type BranchOption = {
  branch_id: string | number;
  branch_name: string;
};

type CreateLoanFormProps = {
  borrowers: BorrowerOption[];
  branches: BranchOption[];
};

const TERM_OPTIONS = [
  { label: "1 month", value: 1 },
  { label: "2 months", value: 2 },
  { label: "3 months", value: 3 },
  { label: "4 months", value: 4 },
  { label: "6 months", value: 6 },
];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Creating..." : "Create Loan"}
    </Button>
  );
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonthsToDate(dateString: string, months: number) {
  if (!dateString) {
    return "";
  }

  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) {
    return "";
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function getDateDiffDays(startDate: string, dueDate: string) {
  if (!startDate || !dueDate) {
    return null;
  }

  const start = new Date(`${startDate}T00:00:00Z`);
  const due = new Date(`${dueDate}T00:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) {
    return null;
  }

  const diff = Math.ceil((due.getTime() - start.getTime()) / 86400000);
  return diff > 0 ? diff : null;
}

export function CreateLoanForm({ borrowers, branches }: CreateLoanFormProps) {
  const [state, formAction] = useActionState(createLoanAction, initialCreateLoanState);
  const formRef = useRef<HTMLFormElement>(null);

  const defaultStartDate = useMemo(() => formatDateInput(new Date()), []);
  const defaultTermMonths = "1";
  const defaultDueDate = useMemo(
    () => addMonthsToDate(defaultStartDate, Number(defaultTermMonths)),
    [defaultStartDate],
  );

  const [borrowerId, setBorrowerId] = useState("");
  const [borrowerSearch, setBorrowerSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [termMonths, setTermMonths] = useState(defaultTermMonths);
  const [principal, setPrincipal] = useState("");
  const [interest, setInterest] = useState("");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isConfirmedSubmit, setIsConfirmedSubmit] = useState(false);

  const selectedBorrower = useMemo(
    () => borrowers.find((borrower) => borrower.user_id === borrowerId) ?? null,
    [borrowerId, borrowers],
  );

  const selectedBranch = useMemo(
    () => branches.find((branch) => String(branch.branch_id) === branchId) ?? null,
    [branchId, branches],
  );

  const filteredBorrowers = useMemo(() => {
  const query = borrowerSearch.trim().toLowerCase();

  if (!query) {
    return [];
  }

  return borrowers
    .map((borrower) => {
      const firstName = (borrower.first_name ?? "").toLowerCase().trim();
      const lastName = (borrower.last_name ?? "").toLowerCase().trim();
      const fullName = `${firstName} ${lastName}`.trim();
      const fullNameWords = fullName.split(/\s+/).filter(Boolean);

      const startsWithFirst = firstName.startsWith(query);
      const startsWithLast = lastName.startsWith(query);
      const startsWithAnyWord = fullNameWords.some((word) => word.startsWith(query));
      const includesFullName = fullName.includes(query);

      let score = 0;

      if (query.length === 1) {
        // strict matching for single-letter searches
        if (startsWithFirst) score = 5;
        else if (startsWithLast) score = 4;
        else if (startsWithAnyWord) score = 3;
      } else {
        // looser matching for longer searches
        if (startsWithFirst) score = 5;
        else if (startsWithLast) score = 4;
        else if (startsWithAnyWord) score = 3;
        else if (includesFullName) score = 2;
      }

      return { borrower, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.borrower.label.localeCompare(b.borrower.label))
    .slice(0, 10)
    .map((item) => item.borrower);
  }, [borrowerSearch, borrowers]);

  const parsedPrincipal = Number(principal);
  const parsedInterest = Number(interest);
  const durationDays = getDateDiffDays(startDate, dueDate);
  const totalPayable =
    Number.isFinite(parsedPrincipal) && parsedPrincipal >= 0 && Number.isFinite(parsedInterest)
      ? parsedPrincipal + (parsedPrincipal * parsedInterest) / 100
      : null;
  const estimatedDailyPayment =
    totalPayable !== null && durationDays ? totalPayable / durationDays : null;
  const shouldShowBorrowerSuggestions = borrowerSearch.trim().length > 0 && borrowerId === "";

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

  function handleBorrowerSelect(nextBorrowerId: string) {
    const nextBorrower = borrowers.find((borrower) => borrower.user_id === nextBorrowerId);
    setBorrowerId(nextBorrowerId);
    setBorrowerSearch(nextBorrower?.label ?? "");
  }

  function handleTermChange(value: string) {
    setTermMonths(value);

    const months = Number(value);
    if (!startDate || !Number.isFinite(months) || months <= 0) {
      return;
    }

    const nextDueDate = addMonthsToDate(startDate, months);
    if (nextDueDate) {
      setDueDate(nextDueDate);
    }
  }

  function handleStartDateChange(value: string) {
    setStartDate(value);

    const months = Number(termMonths);
    if (!value || !Number.isFinite(months) || months <= 0) {
      return;
    }

    const nextDueDate = addMonthsToDate(value, months);
    if (nextDueDate) {
      setDueDate(nextDueDate);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Loan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={formAction}
            className="space-y-4"
            onSubmit={handleSubmit}
            ref={formRef}
          >
            <input name="borrower_id" type="hidden" value={borrowerId} />
            <input name="branch_id" type="hidden" value={branchId} />

            <div className="space-y-2">
              <Label htmlFor="borrower_search">Borrower Search</Label>
              <Input
                id="borrower_search"
                onChange={(event) => {
                  setBorrowerSearch(event.target.value);
                  setBorrowerId("");
                }}
                placeholder="Type borrower name"
                value={borrowerSearch}
              />
              {shouldShowBorrowerSuggestions ? (
                <div className="max-h-52 overflow-auto rounded-md border p-1">
                  {filteredBorrowers.length > 0 ? (
                    filteredBorrowers.map((borrower) => (
                      <button
                        className="hover:bg-accent w-full rounded-sm px-2 py-1 text-left text-sm"
                        key={borrower.user_id}
                        onClick={() => handleBorrowerSelect(borrower.user_id)}
                        type="button"
                      >
                        {borrower.label}
                      </button>
                    ))
                  ) : (
                    <p className="text-muted-foreground px-2 py-1 text-sm">No borrowers found.</p>
                  )}
                </div>
              ) : null}
              {state.fieldErrors?.borrower_id ? (
                <p className="text-sm text-destructive">{state.fieldErrors.borrower_id}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Branch</Label>
              <Select onValueChange={setBranchId} value={branchId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={String(branch.branch_id)} value={String(branch.branch_id)}>
                      {branch.branch_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.fieldErrors?.branch_id ? (
                <p className="text-sm text-destructive">{state.fieldErrors.branch_id}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Loan Term</Label>
              <Select onValueChange={handleTermChange} value={termMonths}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select loan term" />
                </SelectTrigger>
                <SelectContent>
                  {TERM_OPTIONS.map((term) => (
                    <SelectItem key={term.value} value={String(term.value)}>
                      {term.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="principal">Principal</Label>
                <Input
                  id="principal"
                  min="0"
                  name="principal"
                  onChange={(event) => setPrincipal(event.target.value)}
                  step="0.01"
                  type="number"
                  value={principal}
                />
                {state.fieldErrors?.principal ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.principal}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="interest">Interest</Label>
                <div className="relative">
                  <Input
                    className="pr-8"
                    id="interest"
                    min="0"
                    name="interest"
                    onChange={(event) => setInterest(event.target.value)}
                    step="0.01"
                    type="number"
                    value={interest}
                  />
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm">
                    %
                  </span>
                </div>
                {state.fieldErrors?.interest ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.interest}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  name="start_date"
                  onChange={(event) => handleStartDateChange(event.target.value)}
                  type="date"
                  value={startDate}
                />
                {state.fieldErrors?.start_date ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.start_date}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  name="due_date"
                  onChange={(event) => setDueDate(event.target.value)}
                  type="date"
                  value={dueDate}
                />
                {state.fieldErrors?.due_date ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.due_date}</p>
                ) : null}
              </div>
            </div>

            {estimatedDailyPayment !== null && totalPayable !== null && durationDays ? (
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm">
                  <span className="font-medium">Total Payable:</span> {formatMoney(totalPayable)}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Loan Duration in Days:</span> {durationDays}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Estimated Daily Payment:</span>{" "}
                  {formatMoney(estimatedDailyPayment)}
                </p>
              </div>
            ) : null}

            {state.status === "error" && state.message ? (
              <p className="text-sm text-destructive">{state.message}</p>
            ) : null}

            <SubmitButton />
          </form>

          <Dialog onOpenChange={setIsConfirmOpen} open={isConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Loan Creation</DialogTitle>
                <DialogDescription>
                  Please review the loan details before confirming.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Borrower:</span> {selectedBorrower?.label || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Branch:</span>{" "}
                  {selectedBranch?.branch_name || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Principal:</span> {principal || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Interest:</span> {interest || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Start Date:</span> {startDate || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Due Date:</span> {dueDate || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Status:</span> Active
                </p>
              </div>

              <DialogFooter>
                <Button onClick={() => setIsConfirmOpen(false)} type="button" variant="outline">
                  Cancel
                </Button>
                <Button onClick={handleConfirmCreate} type="button">
                  Confirm Create Loan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {state.status === "success" && state.result ? (
        <Card>
          <CardHeader>
            <CardTitle>Loan Created</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Loan ID:</span> {state.result.loanId}
            </p>
            <p>
              <span className="font-medium">Borrower:</span> {state.result.borrowerName}
            </p>
            <p>
              <span className="font-medium">Branch:</span> {state.result.branchName}
            </p>
            <p>
              <span className="font-medium">Principal:</span> {state.result.principal}
            </p>
            <p>
              <span className="font-medium">Interest:</span> {state.result.interest}
            </p>
            <p>
              <span className="font-medium">Start Date:</span> {state.result.startDate}
            </p>
            <p>
              <span className="font-medium">Due Date:</span> {state.result.dueDate}
            </p>
            <p>
              <span className="font-medium">Status:</span> {state.result.status}
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
