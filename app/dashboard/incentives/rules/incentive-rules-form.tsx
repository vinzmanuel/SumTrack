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
};

type IncentiveRulesFormProps = {
  isAdmin: boolean;
  fixedBranch: BranchOption | null;
  branches: BranchOption[];
  manageableRoles: RoleOption[];
  existingRules: ExistingRule[];
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
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

export function IncentiveRulesForm({
  isAdmin,
  fixedBranch,
  branches,
  manageableRoles,
  existingRules,
}: IncentiveRulesFormProps) {
  const [state, formAction] = useActionState(upsertIncentiveRuleAction, initialIncentiveRuleFormState);
  const formRef = useRef<HTMLFormElement>(null);

  const [branchId, setBranchId] = useState(isAdmin ? "" : fixedBranch ? String(fixedBranch.branch_id) : "");
  const [roleId, setRoleId] = useState("");
  const [percentValue, setPercentValue] = useState("");
  const [flatAmountRaw, setFlatAmountRaw] = useState("");
  const [rulesBranchFilter, setRulesBranchFilter] = useState("all");
  const [rulesRoleFilter, setRulesRoleFilter] = useState("all");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isConfirmedSubmit, setIsConfirmedSubmit] = useState(false);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isConfirmedSubmit) {
      setIsConfirmedSubmit(false);
      return;
    }

    event.preventDefault();
    setIsConfirmOpen(true);
  }

  function handleConfirmSave() {
    setIsConfirmOpen(false);
    setIsConfirmedSubmit(true);
    formRef.current?.requestSubmit();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manage Incentive Rule</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4" onSubmit={handleSubmit} ref={formRef}>
            <input name="branch_id" type="hidden" value={isAdmin ? branchId : fixedBranch ? String(fixedBranch.branch_id) : ""} />
            <input name="role_id" type="hidden" value={roleId} />
            <input name="percent_value" type="hidden" value={percentValue} />
            <input name="flat_amount" type="hidden" value={flatAmountRaw} />

            {isAdmin ? (
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select onValueChange={setBranchId} value={branchId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((item) => (
                      <SelectItem key={item.branch_id} value={String(item.branch_id)}>
                        {item.branch_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {state.fieldErrors?.branch_id ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.branch_id}</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Branch</Label>
                <Input readOnly value={fixedBranch?.branch_name ?? "N/A"} />
              </div>
            )}

            <div className="space-y-2">
              <Label>Role</Label>
              <Select onValueChange={setRoleId} value={roleId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {manageableRoles.map((role) => (
                    <SelectItem key={role.role_id} value={String(role.role_id)}>
                      {role.role_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {state.fieldErrors?.role_id ? (
                <p className="text-sm text-destructive">{state.fieldErrors.role_id}</p>
              ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="percent_value">Percent Value</Label>
                <div className="relative">
                  <Input
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

              <div className="space-y-2">
                <Label htmlFor="flat_amount">Flat Amount</Label>
                <div className="relative">
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
                    {"\u20B1"}
                  </span>
                  <Input
                    className="pl-7"
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
              <p className="text-sm text-destructive">{state.message}</p>
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
                <Button onClick={() => setIsConfirmOpen(false)} type="button" variant="outline">
                  Cancel
                </Button>
                <Button onClick={handleConfirmSave} type="button">
                  Confirm Save Rule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {state.status === "success" && state.result ? (
        <Card>
          <CardHeader>
            <CardTitle>Rule Saved</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Action:</span> {state.result.mode === "created" ? "Created" : "Updated"}
            </p>
            <p>
              <span className="font-medium">Applies To:</span>{" "}
              {state.result.appliesTo === "current_period" ? "Current month" : "Next month"}
            </p>
            <p>
              <span className="font-medium">Period:</span> {state.result.periodLabel}
            </p>
            <p>
              <span className="font-medium">Effective Start:</span> {state.result.effectiveStart}
            </p>
            <p>
              <span className="font-medium">Effective End:</span> {state.result.effectiveEnd ?? "Open-ended"}
            </p>
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
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Existing Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <div className="mb-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rules_branch_filter">Branch Filter</Label>
                <Select onValueChange={setRulesBranchFilter} value={rulesBranchFilter}>
                  <SelectTrigger id="rules_branch_filter" className="w-full">
                    <SelectValue placeholder="Filter by branch" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {branches.map((item) => (
                      <SelectItem key={item.branch_id} value={item.branch_name}>
                        {item.branch_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rules_role_filter">Role Filter</Label>
                <Select onValueChange={setRulesRoleFilter} value={rulesRoleFilter}>
                  <SelectTrigger id="rules_role_filter" className="w-full">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {manageableRoles.map((item) => (
                      <SelectItem key={item.role_id} value={item.role_name}>
                        {item.role_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {filteredExistingRules.length === 0 ? (
            <p className="text-muted-foreground text-sm">No incentive rules found.</p>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-220 text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-2 py-2 font-medium">Branch</th>
                    <th className="px-2 py-2 font-medium">Role</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Percent Value</th>
                    <th className="px-2 py-2 font-medium">Flat Amount</th>
                    <th className="px-2 py-2 font-medium">Effective Start</th>
                    <th className="px-2 py-2 font-medium">Effective End</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExistingRules.map((rule) => (
                    <tr className="border-b" key={rule.rule_id}>
                      <td className="px-2 py-2">{rule.branch_name}</td>
                      <td className="px-2 py-2">{rule.role_name}</td>
                      <td className="px-2 py-2">
                        <span
                          className={rule.status_label === "Active Now"
                            ? "rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800"
                            : "rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800"}
                        >
                          {rule.status_label}
                        </span>
                      </td>
                      <td className="px-2 py-2">{(Number(rule.percent_value) || 0).toLocaleString("en-PH")}%</td>
                      <td className="px-2 py-2">{formatMoney(Number(rule.flat_amount) || 0)}</td>
                      <td className="px-2 py-2">{rule.effective_start}</td>
                      <td className="px-2 py-2">{rule.effective_end ?? "Open-ended"}</td>
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

