"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ChevronLeft, ChevronRight, CircleAlert } from "lucide-react";
import { useFormStatus } from "react-dom";
import { getUiRoleBadgeClassName, UI_CONTROL_CLASS_NAME } from "@/app/dashboard/_components/ui-patterns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { upsertIncentiveRuleAction } from "@/app/dashboard/incentives/rules/actions";
import { initialIncentiveRuleFormState } from "@/app/dashboard/incentives/rules/state";

type BranchOption = {
  branch_id: number;
  branch_name: string;
};

type RoleOption = {
  role_id: number;
  role_name: string;
};

type ExistingRule = {
  rule_id: number;
  branch_name: string;
  role_name: string;
  percent_value: string;
  flat_amount: string;
  effective_start: string;
  effective_end: string | null;
  status_label: "Active Now" | "Scheduled Next";
  set_by_role_name: string | null;
  set_by_company_id: string | null;
  set_by_first_name: string | null;
  set_by_middle_name: string | null;
  set_by_last_name: string | null;
};

type IncentiveRulesFormProps = {
  isAdmin: boolean;
  isAuditor: boolean;
  fixedBranch: BranchOption | null;
  branches: BranchOption[];
  manageableRoles: RoleOption[];
  existingRules: ExistingRule[];
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="h-11 rounded-md px-4 text-sm" disabled={pending} type="submit">
      {pending ? "Saving..." : "Save Rule"}
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

function formatRuleSetterName(rule: ExistingRule) {
  const middleInitial = rule.set_by_middle_name?.trim()
    ? `${rule.set_by_middle_name.trim().charAt(0)}.`
    : null;
  const fullName = [rule.set_by_first_name, middleInitial, rule.set_by_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (fullName && rule.set_by_company_id) {
    return `${fullName} (${rule.set_by_company_id})`;
  }

  if (fullName) {
    return fullName;
  }

  if (rule.set_by_company_id) {
    return `Unknown user (${rule.set_by_company_id})`;
  }

  return "Unknown user";
}

export function IncentiveRulesForm({
  isAdmin,
  isAuditor,
  fixedBranch,
  branches,
  manageableRoles,
  existingRules,
}: IncentiveRulesFormProps) {
  const [state, formAction] = useActionState(upsertIncentiveRuleAction, initialIncentiveRuleFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedSubmitRef = useRef(false);

  const [branchId, setBranchId] = useState(isAdmin ? "" : fixedBranch ? String(fixedBranch.branch_id) : "");
  const [roleId, setRoleId] = useState("");
  const [percentValue, setPercentValue] = useState("");
  const [flatAmountRaw, setFlatAmountRaw] = useState("");
  const [rulesBranchFilter, setRulesBranchFilter] = useState("all");
  const [rulesRoleFilter, setRulesRoleFilter] = useState("all");
  const [rulesPage, setRulesPage] = useState(1);
  const [rulesPageSize, setRulesPageSize] = useState(10);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  const selectedBranchName =
    (isAdmin
      ? branches.find((item) => String(item.branch_id) === branchId)?.branch_name
      : fixedBranch?.branch_name) ?? "N/A";
  const selectedRoleName = manageableRoles.find((item) => String(item.role_id) === roleId)?.role_name ?? "N/A";
  const flatAmountDisplay = formatMoneyDisplay(flatAmountRaw);
  const percentSuffixLeft = `calc(0.75rem + ${Math.max(percentValue.length, 1)}ch)`;

  const filteredExistingRules = existingRules.filter((rule) => {
    const branchMatches = rulesBranchFilter === "all" || rule.branch_name === rulesBranchFilter;
    const roleMatches = rulesRoleFilter === "all" || rule.role_name === rulesRoleFilter;
    return branchMatches && roleMatches;
  });
  const RULES_PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
  const totalRulePages = Math.max(Math.ceil(filteredExistingRules.length / rulesPageSize), 1);
  const safeRulesPage = Math.min(rulesPage, totalRulePages);
  const showingFrom = filteredExistingRules.length === 0 ? 0 : (safeRulesPage - 1) * rulesPageSize + 1;
  const showingTo =
    filteredExistingRules.length === 0
      ? 0
      : Math.min(safeRulesPage * rulesPageSize, filteredExistingRules.length);
  const paginatedExistingRules = filteredExistingRules.slice(
    (safeRulesPage - 1) * rulesPageSize,
    safeRulesPage * rulesPageSize,
  );

  useEffect(() => {
    if (state.status !== "success" || !state.result) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      confirmedSubmitRef.current = false;
      setIsConfirmOpen(false);
      setIsSuccessOpen(true);
      setRoleId("");
      setPercentValue("");
      setFlatAmountRaw("");
      if (isAdmin) {
        setBranchId("");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isAdmin, state.result, state.status]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmedSubmitRef.current) {
      confirmedSubmitRef.current = false;
      return;
    }

    event.preventDefault();
    setIsConfirmOpen(true);
  }

  function handleConfirmSave() {
    setIsConfirmOpen(false);
    confirmedSubmitRef.current = true;
    formRef.current?.requestSubmit();
  }

  return (
    <div
      className={
        isAuditor
          ? "grid items-start gap-5"
          : "grid items-start gap-5 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]"
      }
    >
      {!isAuditor ? (
      <Card className="h-fit rounded-md">
        <CardHeader>
          <CardTitle>Rule Editor</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4" onSubmit={handleSubmit} ref={formRef}>
            <input name="branch_id" type="hidden" value={isAdmin ? branchId : fixedBranch ? String(fixedBranch.branch_id) : ""} />
            <input name="role_id" type="hidden" value={roleId} />
            <input name="percent_value" type="hidden" value={percentValue} />
            <input name="flat_amount" type="hidden" value={flatAmountRaw} />

            {isAdmin ? (
              <div className="flex flex-col gap-2">
                <Label>Branch</Label>
                <Select onValueChange={setBranchId} value={branchId}>
                  <SelectTrigger className={`${UI_CONTROL_CLASS_NAME} w-full`}>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Branches</SelectLabel>
                      {branches.map((item) => (
                        <SelectItem key={item.branch_id} value={String(item.branch_id)}>
                          {item.branch_name}
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

            <div className="flex flex-col gap-2">
              <Label>Role</Label>
              <Select onValueChange={setRoleId} value={roleId}>
                <SelectTrigger className={`${UI_CONTROL_CLASS_NAME} w-full`}>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Roles</SelectLabel>
                    {manageableRoles.map((role) => (
                      <SelectItem key={role.role_id} value={String(role.role_id)}>
                        {role.role_name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {state.fieldErrors?.role_id ? (
                <p className="text-sm text-destructive">{state.fieldErrors.role_id}</p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="percent_value">Percent Value</Label>
                <div className="relative">
                  <Input
                    className={UI_CONTROL_CLASS_NAME}
                    id="percent_value"
                    inputMode="decimal"
                    onChange={(event) => setPercentValue(sanitizeNumericInput(event.target.value))}
                    placeholder="0%"
                    type="text"
                    value={percentValue}
                  />
                  {percentValue ? (
                    <span
                      className="text-muted-foreground pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm"
                      style={{ left: percentSuffixLeft }}
                    >
                      %
                    </span>
                  ) : null}
                </div>
                {state.fieldErrors?.percent_value ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.percent_value}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="flat_amount">Flat Amount</Label>
                <div className="relative">
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    {"\u20B1"}
                  </span>
                  <Input
                    className={`${UI_CONTROL_CLASS_NAME} pl-7`}
                    id="flat_amount"
                    inputMode="decimal"
                    onChange={(event) => setFlatAmountRaw(sanitizeNumericInput(event.target.value))}
                    placeholder="0"
                    type="text"
                    value={flatAmountDisplay}
                  />
                </div>
                {state.fieldErrors?.flat_amount ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.flat_amount}</p>
                ) : null}
              </div>
            </div>

            {state.status === "error" && state.message ? (
              <Alert variant="destructive">
                <CircleAlert className="size-4" />
                <AlertTitle>Unable to save rule</AlertTitle>
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}

            <SubmitButton />
          </form>

          <Dialog onOpenChange={setIsConfirmOpen} open={isConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Incentive Rule</DialogTitle>
                <DialogDescription>
                  Changes saved during the current month apply to the next month.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Branch:</span> {selectedBranchName}
                </p>
                <p>
                  <span className="font-medium">Role:</span> {selectedRoleName}
                </p>
                <p>
                  <span className="font-medium">Percent Value:</span> {percentValue || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Flat Amount:</span>{" "}
                  {flatAmountDisplay ? `\u20B1${flatAmountDisplay}` : "N/A"}
                </p>
              </div>

              <DialogFooter>
                <Button className="h-11 rounded-md px-4 text-sm" onClick={() => setIsConfirmOpen(false)} type="button" variant="outline">
                  Cancel
                </Button>
                <Button className="h-11 rounded-md px-4 text-sm" onClick={handleConfirmSave} type="button">
                  Confirm Save Rule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog onOpenChange={setIsSuccessOpen} open={isSuccessOpen}>
            <DialogContent className="border-emerald-200 bg-background shadow-xl sm:max-w-md">
              <DialogHeader className="items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                  <Check className="size-8 stroke-[3]" />
                </div>
                <DialogTitle className="text-2xl font-semibold text-foreground">Rule saved</DialogTitle>
                <DialogDescription className="max-w-sm text-base text-muted-foreground">
                  {state.result
                    ? `${state.result.mode === "created" ? "Created" : "Updated"} ${state.result.roleName} for ${state.result.branchName}.`
                    : state.message ?? "The incentive rule was saved successfully."}
                </DialogDescription>
              </DialogHeader>

              {state.result ? (
                <div className="rounded-md border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-950">
                  <p>
                    <span className="font-medium">Branch:</span> {state.result.branchName}
                  </p>
                  <p>
                    <span className="font-medium">Role:</span> {state.result.roleName}
                  </p>
                  <p>
                    <span className="font-medium">Percent Value:</span> {state.result.percentValue}%
                  </p>
                  <p>
                    <span className="font-medium">Flat Amount:</span> {formatMoney(state.result.flatAmount)}
                  </p>
                  <p>
                    <span className="font-medium">Effective Period:</span> {state.result.periodLabel}
                  </p>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      ) : null}

      <div className="min-w-0 flex flex-col gap-5">
        <Card className="min-w-0 gap-0 overflow-hidden rounded-md py-0">
          <CardHeader className="gap-4 py-5">
            <div className="flex flex-col gap-1">
              <CardTitle>Existing Rules</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review active and upcoming rule versions before editing the next-period configuration.
              </p>
            </div>

            {isAdmin || isAuditor ? (
              <div className="grid gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,220px)]">
                <div className="flex flex-col gap-2">
                  <Select
                    onValueChange={(value) => {
                      setRulesBranchFilter(value);
                      setRulesPage(1);
                    }}
                    value={rulesBranchFilter}
                  >
                    <SelectTrigger id="rules_branch_filter" className={`${UI_CONTROL_CLASS_NAME} w-full`}>
                      <SelectValue placeholder="Filter by branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Branch</SelectLabel>
                        <SelectItem value="all">All branches</SelectItem>
                        {branches.map((item) => (
                          <SelectItem key={item.branch_id} value={item.branch_name}>
                            {item.branch_name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Select
                    onValueChange={(value) => {
                      setRulesRoleFilter(value);
                      setRulesPage(1);
                    }}
                    value={rulesRoleFilter}
                  >
                    <SelectTrigger id="rules_role_filter" className={`${UI_CONTROL_CLASS_NAME} w-full`}>
                      <SelectValue placeholder="Filter by role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Role</SelectLabel>
                        <SelectItem value="all">All roles</SelectItem>
                        {manageableRoles.map((item) => (
                          <SelectItem key={item.role_id} value={item.role_name}>
                            {item.role_name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="p-0">
            {filteredExistingRules.length === 0 ? (
              <div className="m-5 rounded-md border border-dashed bg-muted/20 px-5 py-10 text-center">
                <p className="text-sm font-medium text-foreground">No incentive rules found.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create a rule for the selected branch and role to prepare next period&apos;s payouts.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto border-b border-border/70">
                  <Table className="w-full text-sm [&_td:first-child]:pl-6 [&_th:first-child]:pl-6 [&_td:last-child]:pr-6 [&_th:last-child]:pr-6">
                  <TableHeader>
                    <TableRow className="border-border/70 bg-card">
                      <TableHead>Branch</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Percent Value</TableHead>
                      <TableHead>Flat Amount</TableHead>
                      <TableHead>Effective Start</TableHead>
                      <TableHead>Effective End</TableHead>
                      <TableHead>Set By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedExistingRules.map((rule) => (
                      <TableRow key={rule.rule_id}>
                        <TableCell className="whitespace-normal">{rule.branch_name}</TableCell>
                        <TableCell>{rule.role_name}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              rule.status_label === "Active Now"
                                ? "rounded-md border border-emerald-200 bg-emerald-50 py-1 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                                : "rounded-md border border-amber-200 bg-amber-50 py-1 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                            }
                            variant="outline"
                          >
                            {rule.status_label}
                          </Badge>
                        </TableCell>
                        <TableCell>{(Number(rule.percent_value) || 0).toLocaleString("en-PH")}%</TableCell>
                        <TableCell>{formatMoney(Number(rule.flat_amount) || 0)}</TableCell>
                        <TableCell>{rule.effective_start}</TableCell>
                        <TableCell>{rule.effective_end ?? "Open-ended"}</TableCell>
                        <TableCell className="whitespace-normal">
                          <div className="flex items-center gap-2">
                            <Badge className={getUiRoleBadgeClassName(rule.set_by_role_name ?? undefined)} variant="outline">
                              {rule.set_by_role_name ?? "Unknown"}
                            </Badge>
                            <span>{formatRuleSetterName(rule)}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>

                {filteredExistingRules.length > 0 ? (
                  <div className="px-5 pb-5">
                    <div className="flex flex-col gap-3 text-sm xl:flex-row xl:items-center xl:justify-between">
                      <p className="text-muted-foreground">
                        Showing {showingFrom}-{showingTo} of {filteredExistingRules.length}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 xl:justify-center">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Rows</span>
                          <Select
                            onValueChange={(value) => {
                              setRulesPageSize(Number(value));
                              setRulesPage(1);
                            }}
                            value={String(rulesPageSize)}
                          >
                            <SelectTrigger className={`${UI_CONTROL_CLASS_NAME} w-[84px]`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Rows</SelectLabel>
                                {RULES_PAGE_SIZE_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={String(option)}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="ml-4 flex items-center gap-2">
                          <span className="text-muted-foreground">
                            Page {safeRulesPage} of {totalRulePages}
                          </span>
                          <Button
                            disabled={safeRulesPage <= 1}
                            onClick={() => setRulesPage((current) => Math.max(current - 1, 1))}
                            size="icon"
                            type="button"
                            variant="outline"
                          >
                            <ChevronLeft />
                            <span className="sr-only">Previous page</span>
                          </Button>
                          <Button
                            disabled={safeRulesPage >= totalRulePages}
                            onClick={() => setRulesPage((current) => Math.min(current + 1, totalRulePages))}
                            size="icon"
                            type="button"
                            variant="outline"
                          >
                            <ChevronRight />
                            <span className="sr-only">Next page</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
