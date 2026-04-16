"use client";

import { useActionState, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Calendar as CalendarIcon, ChevronDown, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createLoanAction } from "@/app/dashboard/create-loan/actions";
import {
  calculateCalendarDayDiff,
  calculateScheduledDueDate,
} from "@/app/dashboard/loans/loan-schedule";
import { initialCreateLoanState } from "@/app/dashboard/create-loan/state";
import { UI_CONTROL_CLASS_NAME, UI_SURFACE_CLASS_NAME } from "@/app/dashboard/_components/ui-patterns";
import type {
  AreaOption,
  BorrowerOption,
  BranchOption,
  CollectorOption,
  PrefilledBorrower,
} from "@/app/dashboard/create-loan/types";

type CreateLoanFormProps = {
  borrowers: BorrowerOption[];
  activeLoanBorrowerIds: string[];
  branches: BranchOption[];
  areas: AreaOption[];
  collectors: CollectorOption[];
  isAdmin: boolean;
  canUseCustomTerm: boolean;
  prefilledBorrower?: PrefilledBorrower | null;
};

const DEFAULT_TERM_DAYS = 58;
const MAX_PRINCIPAL = 25_000;
const MAX_INTEREST = 99.99;
const STAFF_TERM_OPTIONS = [
  { label: "58 days", value: "58" },
  { label: "60 days", value: "60" },
];
const CREATE_LOAN_CONTROL_CLASS_NAME = UI_CONTROL_CLASS_NAME;

function SubmitButton({ blocked }: { blocked: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      className="h-11 rounded-md bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700 hover:text-white active:scale-[0.98]"
      disabled={pending || blocked}
      type="submit"
    >
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

function sanitizePrincipalInput(value: string) {
  const sanitized = sanitizeNumericInput(value);
  if (!sanitized) {
    return "";
  }

  const parsed = Number(sanitized);
  if (!Number.isFinite(parsed)) {
    return "";
  }

  return String(Math.min(parsed, MAX_PRINCIPAL));
}

function sanitizeInterestInput(value: string) {
  const sanitized = sanitizeNumericInput(value);
  if (!sanitized) {
    return "";
  }

  const [intPartRaw = "", decimalPartRaw] = sanitized.split(".");
  const intPartDigits = intPartRaw.replace(/\D/g, "").slice(0, 2);
  if (!intPartDigits) {
    return "";
  }

  const decimalPartDigits = (decimalPartRaw ?? "").replace(/\D/g, "").slice(0, 2);
  const normalized = decimalPartDigits ? `${intPartDigits}.${decimalPartDigits}` : intPartDigits;
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return "";
  }

  return String(Math.min(parsed, MAX_INTEREST));
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

function formatDatePreview(value: string) {
  if (!value) {
    return "Select date";
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return new Date(`${year}-${month}-${day}T00:00:00`).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function parseDateParts(value: string) {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return { year, month, day };
}

function toUtcDate(value: string) {
  const parsed = parseDateParts(value);
  if (!parsed) {
    return null;
  }

  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
}

function parseDateInputToDate(value: string) {
  const parsed = parseDateParts(value);
  if (!parsed) {
    return undefined;
  }

  const date = new Date(parsed.year, parsed.month - 1, parsed.day);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getGoodFriday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const easterSunday = new Date(Date.UTC(year, month - 1, day));
  easterSunday.setUTCDate(easterSunday.getUTCDate() - 2);
  return easterSunday;
}

function getBlockedDateReason(value: string) {
  const parsed = parseDateParts(value);
  const date = toUtcDate(value);

  if (!parsed || !date) {
    return null;
  }

  if (date.getUTCDay() === 0) {
    return "Sundays are not allowed for custom terms.";
  }

  const goodFriday = getGoodFriday(parsed.year);
  if (
    goodFriday.getUTCFullYear() === parsed.year &&
    goodFriday.getUTCMonth() + 1 === parsed.month &&
    goodFriday.getUTCDate() === parsed.day
  ) {
    return "Good Friday is not allowed for custom terms.";
  }

  if (parsed.month === 1 && parsed.day === 1) {
    return "New Year's Day is not allowed for custom terms.";
  }

  if (parsed.month === 11 && parsed.day === 1) {
    return "All Saints' Day is not allowed for custom terms.";
  }

  if (parsed.month === 12 && parsed.day === 25) {
    return "Christmas Day is not allowed for custom terms.";
  }

  return null;
}

export function CreateLoanForm({
  borrowers,
  activeLoanBorrowerIds,
  branches,
  areas,
  collectors,
  isAdmin,
  canUseCustomTerm,
  prefilledBorrower = null,
}: CreateLoanFormProps) {
  const [state, formAction] = useActionState(createLoanAction, initialCreateLoanState);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedSubmitRef = useRef(false);
  const defaultBranchId = !isAdmin && branches.length === 1 ? String(branches[0].branch_id) : "";

  const defaultStartDate = useMemo(() => formatDateInput(new Date()), []);
  const defaultTermOption = "58";
  const defaultDueDate = useMemo(
    () =>
      calculateScheduledDueDate({
        startDate: defaultStartDate,
        obligationCount: DEFAULT_TERM_DAYS,
      }) ?? "",
    [defaultStartDate],
  );

  const [borrowerId, setBorrowerId] = useState(prefilledBorrower?.borrowerId ?? "");
  const [selectedBranchId, setSelectedBranchId] = useState(
    prefilledBorrower?.branchId ?? defaultBranchId,
  );
  const [selectedAreaId, setSelectedAreaId] = useState(prefilledBorrower?.areaId ?? "");
  const [collectorId, setCollectorId] = useState("");
  const [termOption, setTermOption] = useState(defaultTermOption);
  const [principalRaw, setPrincipalRaw] = useState("");
  const [interest, setInterest] = useState("");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isDueDateOpen, setIsDueDateOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [successDialogDismissed, setSuccessDialogDismissed] = useState(false);
  const [isBorrowerLocked, setIsBorrowerLocked] = useState(Boolean(prefilledBorrower));

  const selectedBorrower = useMemo(
    () => borrowers.find((borrower) => borrower.user_id === borrowerId) ?? null,
    [borrowerId, borrowers],
  );
  const hasExistingActiveLoan = useMemo(
    () => Boolean(borrowerId && activeLoanBorrowerIds.includes(borrowerId)),
    [activeLoanBorrowerIds, borrowerId],
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

  const areaBorrowerOptions = useMemo(
    () => borrowers.filter((borrower) => String(borrower.area_id) === selectedAreaId),
    [borrowers, selectedAreaId],
  );

  const selectedBorrowerOption = useMemo(
    () => areaBorrowerOptions.find((borrower) => borrower.user_id === borrowerId) ?? null,
    [areaBorrowerOptions, borrowerId],
  );

  const parsedPrincipal = Number(principalRaw);
  const parsedInterest = Number(interest);
  const isCustomTerm = canUseCustomTerm && termOption === "custom";
  const fixedTermDays =
    !isCustomTerm && Number.isFinite(Number(termOption)) ? Number(termOption) : null;
  const durationDays = isCustomTerm ? calculateCalendarDayDiff(startDate, dueDate) : fixedTermDays;
  const totalPayable =
    Number.isFinite(parsedPrincipal) && parsedPrincipal >= 0 && Number.isFinite(parsedInterest)
      ? parsedPrincipal + (parsedPrincipal * parsedInterest) / 100
      : null;
  const estimatedDailyPayment =
    totalPayable !== null && durationDays ? totalPayable / durationDays : null;
  const principalDisplay = formatMoneyDisplay(principalRaw);
  const interestSuffixLeft = `calc(0.75rem + ${Math.max(interest.length, 1)}ch)`;
  const customStartDateBlockedReason = isCustomTerm ? getBlockedDateReason(startDate) : null;
  const customDueDateBlockedReason = isCustomTerm ? getBlockedDateReason(dueDate) : null;
  const hasCustomDateBlockingIssue =
    Boolean(customStartDateBlockedReason) || Boolean(customDueDateBlockedReason);
  const startDateValue = parseDateInputToDate(startDate);
  const dueDateValue = parseDateInputToDate(dueDate);
  const isSuccessOpen = state.status === "success" && Boolean(state.result) && !successDialogDismissed;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (hasExistingActiveLoan) {
      event.preventDefault();
      return;
    }

    if (confirmedSubmitRef.current) {
      confirmedSubmitRef.current = false;
      return;
    }

    event.preventDefault();
    setIsConfirmOpen(true);
  }

  function handleConfirmCreate() {
    setIsConfirmOpen(false);
    setSuccessDialogDismissed(false);
    confirmedSubmitRef.current = true;
    formRef.current?.requestSubmit();
  }

  function handleSuccessDialogOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setSuccessDialogDismissed(false);
      return;
    }

    resetFormAfterSuccessClose();
  }

  function resetFormAfterSuccessClose() {
    confirmedSubmitRef.current = false;
    setIsConfirmOpen(false);
    setIsStartDateOpen(false);
    setIsDueDateOpen(false);
    setSuccessDialogDismissed(true);
    setBorrowerId("");
    setSelectedBranchId(defaultBranchId);
    setSelectedAreaId("");
    setCollectorId("");
    setTermOption(defaultTermOption);
    setPrincipalRaw("");
    setInterest("");
    setStartDate(defaultStartDate);
    setDueDate(defaultDueDate);
    setIsBorrowerLocked(false);
  }

  function handleBranchChange(nextBranchId: string) {
    setSelectedBranchId(nextBranchId);
    setSelectedAreaId("");
    setBorrowerId("");
    setCollectorId("");
    setIsBorrowerLocked(false);
  }

  function handleAreaChange(nextAreaId: string) {
    setSelectedAreaId(nextAreaId);
    setBorrowerId("");
    setCollectorId("");
    setIsBorrowerLocked(false);
  }

  function clearBorrowerPrefill() {
    setIsBorrowerLocked(false);
    setBorrowerId("");
    setCollectorId("");
  }

  function handleTermChange(value: string) {
    if (!canUseCustomTerm && value === "custom") {
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

    const nextDueDate = calculateScheduledDueDate({
      startDate,
      obligationCount: termDays,
    });
    if (nextDueDate) {
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

    const nextDueDate = calculateScheduledDueDate({
      startDate: value,
      obligationCount: termDays,
    });
    if (nextDueDate) {
      setDueDate(nextDueDate);
    }
  }

  return (
    <div className="space-y-6">
      <Card className={UI_SURFACE_CLASS_NAME}>
        <CardHeader>
          <CardTitle>Loan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-5" onSubmit={handleSubmit} ref={formRef}>
            <input name="borrower_id" type="hidden" value={borrowerId} />
            <input name="branch_id" type="hidden" value={selectedBranchId} />
            <input name="area_id" type="hidden" value={selectedAreaId} />
            <input name="collector_id" type="hidden" value={collectorId} />
            <input name="principal" type="hidden" value={principalRaw} />
            <input name="interest" type="hidden" value={interest} />
            <input name="start_date" type="hidden" value={startDate} />
            <input name="due_date" type="hidden" value={dueDate} />
            <input name="term_option" type="hidden" value={termOption} />

            <div className={`grid gap-4 ${isAdmin ? "md:grid-cols-2" : "grid-cols-1"}`}>
              {isAdmin ? (
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <Select disabled={isBorrowerLocked} onValueChange={handleBranchChange} value={selectedBranchId}>
                    <SelectTrigger className={`${CREATE_LOAN_CONTROL_CLASS_NAME} w-full`}>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Branch</SelectLabel>
                        {branches.map((branch) => (
                          <SelectItem key={String(branch.branch_id)} value={String(branch.branch_id)}>
                            {branch.branch_name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {state.fieldErrors?.branch_id ? (
                    <p className="text-sm text-destructive">{state.fieldErrors.branch_id}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Area</Label>
                <Select
                  disabled={!selectedBranchId || isBorrowerLocked}
                  onValueChange={handleAreaChange}
                  value={selectedAreaId}
                >
                  <SelectTrigger className={`${CREATE_LOAN_CONTROL_CLASS_NAME} w-full`}>
                    <SelectValue
                      placeholder={selectedBranchId ? "Select area" : isAdmin ? "Select branch first" : "Branch unavailable"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Area</SelectLabel>
                      {areaOptions.map((area) => (
                        <SelectItem key={String(area.area_id)} value={String(area.area_id)}>
                          {area.area_code}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {state.fieldErrors?.area_id ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.area_id}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="borrower_search">Borrower Search</Label>
              <Combobox
                items={areaBorrowerOptions}
                isItemEqualToValue={(item, value) => item.user_id === value.user_id}
                itemToStringLabel={(item) => item.label}
                itemToStringValue={(item) => item.user_id}
                onValueChange={(nextValue) => {
                  const nextBorrower = (nextValue as BorrowerOption | null) ?? null;
                  setBorrowerId(nextBorrower?.user_id ?? "");
                }}
                value={selectedBorrowerOption}
              >
                <ComboboxInput
                  className={`${CREATE_LOAN_CONTROL_CLASS_NAME} w-full`}
                  disabled={!selectedAreaId || isBorrowerLocked}
                  id="borrower_search"
                  placeholder={selectedAreaId ? "Search borrower name or company ID" : "Select area first"}
                  showClear
                />
                <ComboboxContent className="z-[100] max-h-72">
                  <ComboboxEmpty>No borrowers found.</ComboboxEmpty>
                  <ComboboxList>
                    {(item: BorrowerOption) => (
                      <ComboboxItem key={item.user_id} value={item}>
                        {item.label}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {isBorrowerLocked ? (
                <Button className="h-11 rounded-md px-4" onClick={clearBorrowerPrefill} type="button" variant="outline">
                  Change borrower
                </Button>
              ) : null}
              {!selectedAreaId ? (
                <p className="text-muted-foreground text-sm">
                  {isAdmin ? "Select a branch and area before searching for a borrower." : "Select an area before searching for a borrower."}
                </p>
              ) : null}
              {state.fieldErrors?.borrower_id ? (
                <p className="text-sm text-destructive">{state.fieldErrors.borrower_id}</p>
              ) : null}
              {hasExistingActiveLoan ? (
                <p className="text-sm text-destructive">
                  This borrower already has an active loan. Only one active loan is allowed.
                </p>
              ) : null}
            </div>

            <p className="text-muted-foreground text-sm">
              Loan branch is derived from the selected borrower&apos;s area assignment.
            </p>

            <div className="space-y-2">
              <Label>Collector</Label>
              <Select disabled={!selectedAreaId} onValueChange={setCollectorId} value={collectorId}>
                <SelectTrigger className={`${CREATE_LOAN_CONTROL_CLASS_NAME} w-full`}>
                  <SelectValue placeholder={selectedAreaId ? "Select collector" : "Select area first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Collector</SelectLabel>
                    {collectorOptions.map((collector) => (
                      <SelectItem key={collector.user_id} value={collector.user_id}>
                        {collector.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
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
                <SelectTrigger className={`${CREATE_LOAN_CONTROL_CLASS_NAME} w-full`}>
                  <SelectValue placeholder="Select loan term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Loan Term</SelectLabel>
                    {STAFF_TERM_OPTIONS.map((term) => (
                      <SelectItem key={term.value} value={term.value}>
                        {term.label}
                      </SelectItem>
                    ))}
                    {canUseCustomTerm ? <SelectItem value="custom">Custom</SelectItem> : null}
                  </SelectGroup>
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
                    {"\u20B1"}
                  </span>
                  <Input
                    className={`${CREATE_LOAN_CONTROL_CLASS_NAME} pl-7`}
                    id="principal"
                    inputMode="decimal"
                    onChange={(event) => setPrincipalRaw(sanitizePrincipalInput(event.target.value))}
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
                    className={CREATE_LOAN_CONTROL_CLASS_NAME}
                    id="interest"
                    inputMode="decimal"
                    onChange={(event) => setInterest(sanitizeInterestInput(event.target.value))}
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
                <Popover onOpenChange={setIsStartDateOpen} open={isStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      className={`${CREATE_LOAN_CONTROL_CLASS_NAME} w-full justify-between border-input bg-transparent font-normal text-foreground hover:bg-card`}
                      id="start_date"
                      type="button"
                      variant="outline"
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        <CalendarIcon className="size-4 text-muted-foreground" />
                        <span className="truncate">{formatDatePreview(startDate)}</span>
                      </span>
                      <ChevronDown className="size-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto rounded-md p-0" sideOffset={6}>
                    <Calendar
                      disabled={(date) =>
                        isCustomTerm ? Boolean(getBlockedDateReason(formatDateInput(date))) : false
                      }
                      mode="single"
                      onSelect={(value) => {
                        if (!value) {
                          return;
                        }
                        handleStartDateChange(formatDateInput(value));
                        setIsStartDateOpen(false);
                      }}
                      selected={startDateValue}
                    />
                  </PopoverContent>
                </Popover>
                {state.fieldErrors?.start_date ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.start_date}</p>
                ) : null}
                {customStartDateBlockedReason ? (
                  <p className="text-sm text-destructive">{customStartDateBlockedReason}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Popover onOpenChange={setIsDueDateOpen} open={isDueDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      className={`${CREATE_LOAN_CONTROL_CLASS_NAME} w-full justify-between border-input bg-transparent font-normal text-foreground hover:bg-card`}
                      disabled={!isCustomTerm}
                      id="due_date"
                      type="button"
                      variant="outline"
                    >
                      <span className="inline-flex items-center gap-2 truncate">
                        <CalendarIcon className="size-4 text-muted-foreground" />
                        <span className="truncate">{formatDatePreview(dueDate)}</span>
                      </span>
                      <ChevronDown className="size-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto rounded-md p-0" sideOffset={6}>
                    <Calendar
                      disabled={(date) => {
                        if (!isCustomTerm) {
                          return true;
                        }

                        if (startDateValue && date < startDateValue) {
                          return true;
                        }

                        return Boolean(getBlockedDateReason(formatDateInput(date)));
                      }}
                      mode="single"
                      onSelect={(value) => {
                        if (!value) {
                          return;
                        }
                        setDueDate(formatDateInput(value));
                        setIsDueDateOpen(false);
                      }}
                      selected={dueDateValue}
                    />
                  </PopoverContent>
                </Popover>
                {state.fieldErrors?.due_date ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.due_date}</p>
                ) : null}
                {customDueDateBlockedReason ? (
                  <p className="text-sm text-destructive">{customDueDateBlockedReason}</p>
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

            <SubmitButton blocked={hasExistingActiveLoan || hasCustomDateBlockingIssue} />
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
                  <span className="font-medium">Interest:</span> {interest ? `${interest}%` : "N/A"}
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
                <Button className="h-11 rounded-md px-4" onClick={() => setIsConfirmOpen(false)} type="button" variant="outline">
                  Cancel
                </Button>
                <Button
                  className="h-11 rounded-md px-4 active:scale-[0.98]"
                  disabled={hasExistingActiveLoan}
                  onClick={handleConfirmCreate}
                  type="button"
                >
                  Confirm Create Loan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {state.status === "success" && state.result ? (
        <Dialog onOpenChange={handleSuccessDialogOpenChange} open={isSuccessOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Loan Created</DialogTitle>
              <DialogDescription>
                The loan was created successfully. You can review it now or close this message.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Loan Code:</span> {state.result.loanCode}
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
                <span className="font-medium">Total Term:</span> {state.result.termDays} days
              </p>
            </div>

            <DialogFooter>
              <Button className="h-11 rounded-md" onClick={resetFormAfterSuccessClose} type="button" variant="outline">
                Close
              </Button>
              <Button asChild className="h-11 rounded-md">
                <Link href={`/dashboard/loans/${state.result.loanId}`}>View Loan</Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
