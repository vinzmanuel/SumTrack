"use client";

import { useActionState, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
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
  area_id: string | number;
  company_id: string | null;
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

type AreaOption = {
  area_id: string | number;
  branch_id: string | number;
  area_no: string;
  area_code: string;
};

type CollectorOption = {
  user_id: string;
  area_id: string | number;
  label: string;
};

type CreateLoanFormProps = {
  borrowers: BorrowerOption[];
  branches: BranchOption[];
  areas: AreaOption[];
  collectors: CollectorOption[];
  isAdmin: boolean;
  prefilledBorrower?: {
    borrowerId: string;
    branchId: string;
    areaId: string;
    label: string;
  } | null;
};

const DEFAULT_TERM_DAYS = 58;
const STAFF_TERM_OPTIONS = [
  { label: "58 days", value: "58" },
  { label: "60 days", value: "60" },
];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="active:scale-[0.98]" disabled={pending} type="submit">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending ? "Creating..." : "Create Loan"}
    </Button>
  );
}

function formatMoney(value: number) {
  return value.toFixed(2);
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

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToDate(dateString: string, days: number) {
  if (!dateString) {
    return "";
  }

  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) {
    return "";
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
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

export function CreateLoanForm({
  borrowers,
  branches,
  areas,
  collectors,
  isAdmin,
  prefilledBorrower = null,
}: CreateLoanFormProps) {
  const [state, formAction] = useActionState(createLoanAction, initialCreateLoanState);
  const formRef = useRef<HTMLFormElement>(null);

  const defaultStartDate = useMemo(() => formatDateInput(new Date()), []);
  const defaultTermOption = "58";
  const defaultDueDate = useMemo(
    () => addDaysToDate(defaultStartDate, DEFAULT_TERM_DAYS),
    [defaultStartDate],
  );

  const [borrowerId, setBorrowerId] = useState(prefilledBorrower?.borrowerId ?? "");
  const [borrowerSearch, setBorrowerSearch] = useState(prefilledBorrower?.label ?? "");
  const [selectedBranchId, setSelectedBranchId] = useState(prefilledBorrower?.branchId ?? "");
  const [selectedAreaId, setSelectedAreaId] = useState(prefilledBorrower?.areaId ?? "");
  const [collectorId, setCollectorId] = useState("");
  const [termOption, setTermOption] = useState(defaultTermOption);
  const [principalRaw, setPrincipalRaw] = useState("");
  const [interest, setInterest] = useState("");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isConfirmedSubmit, setIsConfirmedSubmit] = useState(false);
  const [isBorrowerLocked, setIsBorrowerLocked] = useState(Boolean(prefilledBorrower));

  const selectedBorrower = useMemo(
    () => borrowers.find((borrower) => borrower.user_id === borrowerId) ?? null,
    [borrowerId, borrowers],
  );

  const selectedBranch = useMemo(
    () => branches.find((branch) => String(branch.branch_id) === selectedBranchId) ?? null,
    [selectedBranchId, branches],
  );

  const areaOptions = useMemo(
    () => areas.filter((area) => String(area.branch_id) === selectedBranchId),
    [areas, selectedBranchId],
  );

  const selectedArea = useMemo(
    () => areaOptions.find((area) => String(area.area_id) === selectedAreaId) ?? null,
    [areaOptions, selectedAreaId],
  );

  const collectorOptions = useMemo(
    () => collectors.filter((collector) => String(collector.area_id) === selectedAreaId),
    [collectors, selectedAreaId],
  );

  const selectedCollector = useMemo(
    () => collectorOptions.find((collector) => collector.user_id === collectorId) ?? null,
    [collectorId, collectorOptions],
  );

  const filteredBorrowers = useMemo(() => {
    const query = borrowerSearch.trim().toLowerCase();
    const areaBorrowers = borrowers.filter(
      (borrower) => String(borrower.area_id) === selectedAreaId,
    );

    if (!query) {
      return [];
    }

    return areaBorrowers
      .map((borrower) => {
        const firstName = (borrower.first_name ?? "").toLowerCase().trim();
        const lastName = (borrower.last_name ?? "").toLowerCase().trim();
        const companyId = (borrower.company_id ?? "").toLowerCase().trim();
        const fullName = `${firstName} ${lastName}`.trim();
        const fullNameWords = fullName.split(/\s+/).filter(Boolean);

        const startsWithFirst = firstName.startsWith(query);
        const startsWithLast = lastName.startsWith(query);
        const startsWithAnyWord = fullNameWords.some((word) => word.startsWith(query));
        const startsWithCompanyId = companyId.startsWith(query);
        const includesFullName = fullName.includes(query);
        const includesCompanyId = companyId.includes(query);

        let score = 0;

        if (query.length === 1) {
          if (startsWithFirst) score = 6;
          else if (startsWithLast) score = 5;
          else if (startsWithCompanyId) score = 4;
          else if (startsWithAnyWord) score = 3;
        } else {
          if (startsWithFirst) score = 6;
          else if (startsWithLast) score = 5;
          else if (startsWithCompanyId) score = 4;
          else if (startsWithAnyWord) score = 3;
          else if (includesCompanyId) score = 2;
          else if (includesFullName) score = 1;
        }

        return { borrower, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.borrower.label.localeCompare(b.borrower.label))
      .slice(0, 10)
      .map((item) => item.borrower);
  }, [borrowerSearch, borrowers, selectedAreaId]);

  const parsedPrincipal = Number(principalRaw);
  const parsedInterest = Number(interest);
  const durationDays = getDateDiffDays(startDate, dueDate);
  const isCustomTerm = isAdmin && termOption === "custom";
  const totalPayable =
    Number.isFinite(parsedPrincipal) && parsedPrincipal >= 0 && Number.isFinite(parsedInterest)
      ? parsedPrincipal + (parsedPrincipal * parsedInterest) / 100
      : null;
  const estimatedDailyPayment =
    totalPayable !== null && durationDays ? totalPayable / durationDays : null;
  const principalDisplay = formatMoneyDisplay(principalRaw);
  const interestSuffixLeft = `calc(0.75rem + ${Math.max(interest.length, 1)}ch)`;
  const shouldShowBorrowerSuggestions =
    !isBorrowerLocked && Boolean(selectedAreaId) && borrowerSearch.trim().length > 0 && borrowerId === "";

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

  function handleBranchChange(nextBranchId: string) {
    setSelectedBranchId(nextBranchId);
    setSelectedAreaId("");
    setBorrowerId("");
    setCollectorId("");
    setBorrowerSearch("");
    setIsBorrowerLocked(false);
  }

  function handleAreaChange(nextAreaId: string) {
    setSelectedAreaId(nextAreaId);
    setBorrowerId("");
    setCollectorId("");
    setBorrowerSearch("");
    setIsBorrowerLocked(false);
  }

  function clearBorrowerPrefill() {
    setIsBorrowerLocked(false);
    setBorrowerId("");
    setBorrowerSearch("");
    setCollectorId("");
  }

  function handleTermChange(value: string) {
    if (!isAdmin && value === "custom") {
      return;
    }

    setTermOption(value);

    if (value === "custom") {
      return;
    }

    const termDays = Number(value);
    if (!startDate || !Number.isFinite(termDays) || termDays <= 0) {
      return;
    }

    const nextDueDate = addDaysToDate(startDate, termDays);
    if (nextDueDate !== "") {
      setDueDate(nextDueDate);
    }
  }

  function handleStartDateChange(value: string) {
    setStartDate(value);

    if (isCustomTerm) {
      return;
    }

    const termDays = Number(termOption);
    if (!value || !Number.isFinite(termDays) || termDays <= 0) {
      return;
    }

    const nextDueDate = addDaysToDate(value, termDays);
    if (nextDueDate !== "") {
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
            <input name="branch_id" type="hidden" value={selectedBranchId} />
            <input name="area_id" type="hidden" value={selectedAreaId} />
            <input name="collector_id" type="hidden" value={collectorId} />
            <input name="principal" type="hidden" value={principalRaw} />
            <input name="interest" type="hidden" value={interest} />
            <input name="term_option" type="hidden" value={termOption} />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select disabled={isBorrowerLocked} onValueChange={handleBranchChange} value={selectedBranchId}>
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
                <Label>Area</Label>
                <Select
                  disabled={!selectedBranchId || isBorrowerLocked}
                  onValueChange={handleAreaChange}
                  value={selectedAreaId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={selectedBranchId ? "Select area" : "Select branch first"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {areaOptions.map((area) => (
                      <SelectItem key={String(area.area_id)} value={String(area.area_id)}>
                        {area.area_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {state.fieldErrors?.area_id ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.area_id}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="borrower_search">Borrower Search</Label>
              <Input
                disabled={!selectedAreaId || isBorrowerLocked}
                id="borrower_search"
                onChange={(event) => {
                  setBorrowerSearch(event.target.value);
                  setBorrowerId("");
                }}
                placeholder={selectedAreaId ? "Type borrower name or company ID" : "Select area first"}
                value={borrowerSearch}
              />
              {isBorrowerLocked ? (
                <Button onClick={clearBorrowerPrefill} size="sm" type="button" variant="outline">
                  Change borrower
                </Button>
              ) : null}
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
              {!selectedAreaId ? (
                <p className="text-muted-foreground text-sm">
                  Select a branch and area before searching for a borrower.
                </p>
              ) : null}
              {state.fieldErrors?.borrower_id ? (
                <p className="text-sm text-destructive">{state.fieldErrors.borrower_id}</p>
              ) : null}
            </div>

            <p className="text-muted-foreground text-sm">
              Loan branch is derived from the selected borrower&apos;s area assignment.
            </p>

            <div className="space-y-2">
              <Label>Collector</Label>
              <Select disabled={!selectedAreaId} onValueChange={setCollectorId} value={collectorId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={selectedAreaId ? "Select collector" : "Select area first"} />
                </SelectTrigger>
                <SelectContent>
                  {collectorOptions.map((collector) => (
                    <SelectItem key={collector.user_id} value={collector.user_id}>
                      {collector.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedAreaId ? (
                <p className="text-muted-foreground text-sm">Select area first to load assigned collectors.</p>
              ) : collectorOptions.length === 0 ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  No active collectors are assigned to this area.
                </p>
              ) : null}
              {state.fieldErrors?.collector_id ? (
                <p className="text-sm text-destructive">{state.fieldErrors.collector_id}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Loan Term</Label>
              <Select onValueChange={handleTermChange} value={termOption}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select loan term" />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_TERM_OPTIONS.map((term) => (
                    <SelectItem key={term.value} value={term.value}>
                      {term.label}
                    </SelectItem>
                  ))}
                  {isAdmin ? <SelectItem value="custom">Custom</SelectItem> : null}
                </SelectContent>
              </Select>
              {state.fieldErrors?.term_option ? (
                <p className="text-sm text-destructive">{state.fieldErrors.term_option}</p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="principal">Principal</Label>
                <div className="relative">
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    ₱
                  </span>
                  <Input
                    className="pl-7"
                    id="principal"
                    inputMode="decimal"
                    onChange={(event) => setPrincipalRaw(sanitizeNumericInput(event.target.value))}
                    placeholder="0"
                    type="text"
                    value={principalDisplay}
                  />
                </div>
                {state.fieldErrors?.principal ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.principal}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="interest">Interest</Label>
                <div className="relative">
                  <Input
                    id="interest"
                    inputMode="decimal"
                    onChange={(event) => setInterest(sanitizeNumericInput(event.target.value))}
                    placeholder="0%"
                    type="text"
                    value={interest}
                  />
                  {interest ? (
                    <span
                      className="text-muted-foreground pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm"
                      style={{ left: interestSuffixLeft }}
                    >
                      %
                    </span>
                  ) : null}
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
                  disabled={!isCustomTerm}
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

            {durationDays ? (
              <p className="text-muted-foreground text-sm">
                <span className="font-medium">Loan Term:</span> {durationDays} days
              </p>
            ) : null}

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
                  <span className="font-medium">Area:</span> {selectedArea?.area_code || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Collector:</span> {selectedCollector?.label || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Principal:</span> {principalDisplay || "N/A"}
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
                  <span className="font-medium">Loan Term:</span> {durationDays ? `${durationDays} days` : "N/A"}
                </p>
                <p>
                  <span className="font-medium">Status:</span> Active
                </p>
              </div>

              <DialogFooter>
                <Button onClick={() => setIsConfirmOpen(false)} type="button" variant="outline">
                  Cancel
                </Button>
                <Button className="active:scale-[0.98]" onClick={handleConfirmCreate} type="button">
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
              <span className="font-medium">Loan Code:</span> {state.result.loanCode}
            </p>
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
              <span className="font-medium">Collector:</span> {state.result.collectorName}
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
              <span className="font-medium">Loan Term:</span> {state.result.termDays} days
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
