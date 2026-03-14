"use client";

import { useActionState, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createAccountAction } from "@/app/dashboard/create-account/actions";
import { initialCreateAccountState, type CreateAccountState } from "@/app/dashboard/create-account/state";

type RoleOption = {
  role_id: string | number;
  role_name: string;
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

type AccountCategory = "Employee" | "Borrower";

type CreateAccountFormProps = {
  roles: RoleOption[];
  branches: BranchOption[];
  areas: AreaOption[];
  borrowerOnly?: boolean;
  fixedBranchId?: string | null;
};

const EMPLOYEE_ROLE_NAMES = ["Admin", "Auditor", "Branch Manager", "Secretary", "Collector"];
const BRANCH_ONLY_ROLE_NAMES = ["Branch Manager", "Secretary"];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="active:scale-[0.98]" disabled={pending} type="submit">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending ? "Creating..." : "Create account"}
    </Button>
  );
}

type FieldLabelProps = {
  children: string;
  htmlFor?: string;
  required?: boolean;
};

function FieldLabel({ children, htmlFor, required = false }: FieldLabelProps) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      {required ? <span className="ml-1 text-destructive">*</span> : null}
    </Label>
  );
}

function buildAccountDetailsLines(result: NonNullable<CreateAccountState["result"]>) {
  const lines = [
    "SumTrack Account Details",
    "",
    `Account Category: ${result.accountCategory}`,
    `Created Role: ${result.role}`,
    `Full Name: ${result.fullName}`,
    `Company ID: ${result.companyId}`,
    `Username: ${result.username}`,
    `Created User UID: ${result.userId}`,
    `Temporary Password: ${result.temporaryPassword}`,
  ];

  if (result.assignedBranch) {
    lines.push(`Assigned Branch: ${result.assignedBranch}`);
  }
  if (result.assignedArea) {
    lines.push(`Assigned Area: ${result.assignedArea}`);
  }
  if (result.assignedBranches.length > 0) {
    lines.push(`Assigned Branches: ${result.assignedBranches.join(", ")}`);
  }
  lines.push(`Status: ${result.status}`);
  if (result.contactNo) {
    lines.push(`Contact Number: ${result.contactNo}`);
  }
  if (result.email) {
    lines.push(`Email: ${result.email}`);
  }
  if (result.address) {
    lines.push(`Address: ${result.address}`);
  }

  return lines;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function CreateAccountForm({
  roles,
  branches,
  areas,
  borrowerOnly = false,
  fixedBranchId = null,
}: CreateAccountFormProps) {
  const [state, formAction] = useActionState(createAccountAction, initialCreateAccountState);
  const formRef = useRef<HTMLFormElement>(null);

  const [accountCategory, setAccountCategory] = useState<AccountCategory>(borrowerOnly ? "Borrower" : "Employee");
  const [roleId, setRoleId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [singleBranchId, setSingleBranchId] = useState(fixedBranchId ?? "");
  const [areaId, setAreaId] = useState("");
  const [auditorBranchIds, setAuditorBranchIds] = useState<string[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isConfirmedSubmit, setIsConfirmedSubmit] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const borrowerRole = useMemo(
    () => roles.find((role) => role.role_name === "Borrower") ?? null,
    [roles],
  );
  const employeeRoles = useMemo(
    () => roles.filter((role) => EMPLOYEE_ROLE_NAMES.includes(role.role_name)),
    [roles],
  );

  const borrowerRoleId = borrowerRole ? String(borrowerRole.role_id) : "";
  const hasSelectedEmployeeRole = employeeRoles.some((role) => String(role.role_id) === roleId);
  const effectiveRoleId =
    accountCategory === "Borrower"
      ? borrowerRoleId
      : hasSelectedEmployeeRole
        ? roleId
        : employeeRoles[0]
          ? String(employeeRoles[0].role_id)
          : "";

  const selectedRole =
    employeeRoles.find((role) => String(role.role_id) === effectiveRoleId) ?? null;
  const selectedRoleName = selectedRole?.role_name ?? "";

  const showRoleSelector = !borrowerOnly && accountCategory === "Employee";
  const showBorrowerFields = accountCategory === "Borrower";
  const requiresContactNo = accountCategory === "Borrower" || (showRoleSelector && selectedRoleName === "Collector");
  const showAuditorBranchSelector = showRoleSelector && selectedRoleName === "Auditor";
  const showAreaFlow =
    accountCategory === "Borrower" ||
    (showRoleSelector && selectedRoleName === "Collector");
  const showBranchOnlySelector =
    showRoleSelector && BRANCH_ONLY_ROLE_NAMES.includes(selectedRoleName);

  const areaOptions = useMemo(
    () => areas.filter((item) => String(item.branch_id) === singleBranchId),
    [areas, singleBranchId],
  );

  const selectedSingleBranchName =
    branches.find((item) => String(item.branch_id) === singleBranchId)?.branch_name ?? "";
  const selectedAreaCode = areaOptions.find((item) => String(item.area_id) === areaId)?.area_code ?? "";
  const selectedAuditorBranchNames = branches
    .filter((item) => auditorBranchIds.includes(String(item.branch_id)))
    .map((item) => item.branch_name);

  function handleCategoryChange(value: AccountCategory) {
    if (borrowerOnly) {
      setAccountCategory("Borrower");
      return;
    }

    setAccountCategory(value);
    setCopyStatus("");
    setAreaId("");
    setSingleBranchId(fixedBranchId ?? "");
    setAuditorBranchIds([]);
    setContactNo("");

    if (value === "Employee" && !hasSelectedEmployeeRole) {
      setRoleId(employeeRoles[0] ? String(employeeRoles[0].role_id) : "");
    }
  }

  function handleRoleChange(value: string) {
    if (borrowerOnly) {
      return;
    }

    const nextRoleName =
      employeeRoles.find((role) => String(role.role_id) === value)?.role_name ?? "";
    setRoleId(value);
    setCopyStatus("");
    setAreaId("");
    setSingleBranchId(fixedBranchId ?? "");
    setAuditorBranchIds([]);
    if (nextRoleName !== "Collector") {
      setContactNo("");
    }
  }

  function handleBranchChange(value: string) {
    if (borrowerOnly && fixedBranchId) {
      setSingleBranchId(fixedBranchId);
      return;
    }

    setSingleBranchId(value);
    setAreaId("");
  }

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

  async function handleCopy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus("Copy failed.");
    }
  }

  function buildAccountDetailsText(result: NonNullable<CreateAccountState["result"]>) {
    return buildAccountDetailsLines(result).join("\n");
  }

  function handlePrintSlip() {
    if (!state.result) return;

    const lines = buildAccountDetailsLines(state.result);
    const printableBody = lines.map((line) => escapeHtml(line)).join("<br />");
    const printWindow = window.open("", "_blank", "width=700,height=800");

    if (!printWindow) {
      setCopyStatus("Unable to open print window.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>SumTrack Account Slip</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            .slip { border: 1px solid #ccc; border-radius: 8px; padding: 20px; max-width: 560px; }
            h1 { margin: 0 0 14px; font-size: 20px; }
            .content { line-height: 1.6; font-size: 14px; white-space: normal; }
          </style>
        </head>
        <body>
          <div class="slip">
            <h1>SumTrack Account Slip</h1>
            <div class="content">${printableBody}</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4" onSubmit={handleSubmit} ref={formRef}>
            <input name="account_category" type="hidden" value={accountCategory} />
            <input name="role_id" type="hidden" value={effectiveRoleId} />
            <input name="branch_id" type="hidden" value={singleBranchId} />
            <input name="area_id" type="hidden" value={areaId} />

            {!borrowerOnly ? (
              <div className="space-y-2">
                <FieldLabel required>Account Category</FieldLabel>
                <Select onValueChange={handleCategoryChange} value={accountCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select account category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Employee">Employee</SelectItem>
                    <SelectItem value="Borrower">Borrower</SelectItem>
                  </SelectContent>
                </Select>
                {state.fieldErrors?.account_category ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.account_category}</p>
                ) : null}
              </div>
            ) : null}

            {showRoleSelector ? (
              <div className="space-y-2">
                <FieldLabel required>Role</FieldLabel>
                <Select onValueChange={handleRoleChange} value={effectiveRoleId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeRoles.map((role) => (
                      <SelectItem key={String(role.role_id)} value={String(role.role_id)}>
                        {role.role_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {state.fieldErrors?.role_id ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.role_id}</p>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <FieldLabel htmlFor="first_name" required>
                  First Name
                </FieldLabel>
                <Input
                  id="first_name"
                  name="first_name"
                  onChange={(event) => setFirstName(event.target.value)}
                  value={firstName}
                />
                {state.fieldErrors?.first_name ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.first_name}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="middle_name">Middle Name</FieldLabel>
                <Input
                  id="middle_name"
                  name="middle_name"
                  onChange={(event) => setMiddleName(event.target.value)}
                  value={middleName}
                />
                {state.fieldErrors?.middle_name ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.middle_name}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="last_name" required>
                  Last Name
                </FieldLabel>
                <Input
                  id="last_name"
                  name="last_name"
                  onChange={(event) => setLastName(event.target.value)}
                  value={lastName}
                />
                {state.fieldErrors?.last_name ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.last_name}</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-sm">Username will be set to the generated Company ID.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                New accounts are created as active, and a temporary password will be generated automatically.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel htmlFor="contact_no" required={requiresContactNo}>
                  Contact Number
                </FieldLabel>
                <Input
                  id="contact_no"
                  inputMode="numeric"
                  maxLength={11}
                  name="contact_no"
                  onChange={(event) =>
                    setContactNo(event.target.value.replace(/\D/g, "").slice(0, 11))
                  }
                  pattern="[0-9]*"
                  placeholder="09XXXXXXXXX"
                  value={contactNo}
                />
                {state.fieldErrors?.contact_no ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.contact_no}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  type="email"
                  value={email}
                />
                {state.fieldErrors?.email ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.email}</p>
                ) : null}
              </div>
            </div>

            {showAreaFlow ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel required>Branch</FieldLabel>
                  <Select
                    disabled={Boolean(fixedBranchId)}
                    onValueChange={handleBranchChange}
                    value={singleBranchId}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((item) => (
                        <SelectItem key={String(item.branch_id)} value={String(item.branch_id)}>
                          {item.branch_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {state.fieldErrors?.branch_id ? (
                    <p className="text-sm text-destructive">{state.fieldErrors.branch_id}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <FieldLabel required>Area</FieldLabel>
                  <Select disabled={!singleBranchId} onValueChange={setAreaId} value={areaId}>
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={
                          singleBranchId ? "Select area" : "Select branch first"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {areaOptions.map((item) => (
                        <SelectItem key={String(item.area_id)} value={String(item.area_id)}>
                          {item.area_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {state.fieldErrors?.area_id ? (
                    <p className="text-sm text-destructive">{state.fieldErrors.area_id}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {showBorrowerFields ? (
              <div className="space-y-2">
                  <FieldLabel htmlFor="address" required>
                    Address
                  </FieldLabel>
                  <Input
                    id="address"
                    name="address"
                    onChange={(event) => setAddress(event.target.value)}
                    value={address}
                  />
                  {state.fieldErrors?.address ? (
                    <p className="text-sm text-destructive">{state.fieldErrors.address}</p>
                  ) : null}
              </div>
            ) : null}

            {showBranchOnlySelector ? (
              <div className="space-y-2">
                <FieldLabel required>Branch</FieldLabel>
                <Select
                  disabled={Boolean(fixedBranchId)}
                  onValueChange={handleBranchChange}
                  value={singleBranchId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((item) => (
                      <SelectItem key={String(item.branch_id)} value={String(item.branch_id)}>
                        {item.branch_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {state.fieldErrors?.branch_id ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.branch_id}</p>
                ) : null}
              </div>
            ) : null}

            {showAuditorBranchSelector ? (
              <div className="space-y-2">
                <FieldLabel required>Assigned Branches (Select one or more)</FieldLabel>
                <div className="space-y-2 rounded-md border p-3">
                  {branches.map((item) => (
                    <label className="flex items-center gap-2 text-sm" key={String(item.branch_id)}>
                      <input
                        checked={auditorBranchIds.includes(String(item.branch_id))}
                        className="h-4 w-4"
                        name="branch_ids"
                        onChange={(event) => {
                          const value = String(item.branch_id);
                          setAuditorBranchIds((previous) => {
                            if (event.target.checked) {
                              return previous.includes(value) ? previous : [...previous, value];
                            }
                            return previous.filter((id) => id !== value);
                          });
                        }}
                        type="checkbox"
                        value={String(item.branch_id)}
                      />
                      <span>{item.branch_name}</span>
                    </label>
                  ))}
                </div>
                {state.fieldErrors?.branch_ids ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.branch_ids}</p>
                ) : null}
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
                <DialogTitle>Confirm Account Creation</DialogTitle>
                <DialogDescription>Review details before creating the account.</DialogDescription>
              </DialogHeader>

              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Account Category:</span> {accountCategory}
                </p>
                <p>
                  <span className="font-medium">Role:</span>{" "}
                  {accountCategory === "Borrower" ? "Borrower" : selectedRoleName || "N/A"}
                </p>
                <p>
                  <span className="font-medium">Full Name:</span>{" "}
                  {[firstName, middleName, lastName].filter(Boolean).join(" ") || "N/A"}
                </p>
                {singleBranchId && selectedSingleBranchName ? (
                  <p>
                    <span className="font-medium">Branch:</span> {selectedSingleBranchName}
                  </p>
                ) : null}
                {areaId && selectedAreaCode ? (
                  <p>
                    <span className="font-medium">Area:</span> {selectedAreaCode}
                  </p>
                ) : null}
                {showAuditorBranchSelector && selectedAuditorBranchNames.length > 0 ? (
                  <p>
                    <span className="font-medium">Assigned Branches:</span>{" "}
                    {selectedAuditorBranchNames.join(", ")}
                  </p>
                ) : null}
                {contactNo ? (
                  <p>
                    <span className="font-medium">Contact Number:</span> {contactNo}
                  </p>
                ) : null}
                {accountCategory === "Borrower" ? (
                  <p>
                    <span className="font-medium">Address:</span> {address || ""}
                  </p>
                ) : null}
                {email ? (
                  <p>
                    <span className="font-medium">Email:</span> {email}
                  </p>
                ) : null}
              </div>

              <DialogFooter>
                <Button onClick={() => setIsConfirmOpen(false)} type="button" variant="outline">
                  Cancel
                </Button>
                <Button className="active:scale-[0.98]" onClick={handleConfirmCreate} type="button">
                  Confirm Create Account
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {state.status === "success" && state.result ? (
        <Card>
          <CardHeader>
            <CardTitle>Account Created</CardTitle>
            <CardAction className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleCopy(buildAccountDetailsText(state.result!), "Account details")}
                size="sm"
                type="button"
                variant="outline"
              >
                Copy All Account Details
              </Button>
              <Button onClick={handlePrintSlip} size="sm" type="button" variant="outline">
                Print Account Slip
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="font-medium">Account Category:</span> {state.result.accountCategory}
            </p>
            <p>
              <span className="font-medium">Created Role:</span> {state.result.role}
            </p>
            <p>
              <span className="font-medium">Full Name:</span> {state.result.fullName}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <p>
                <span className="font-medium">Company ID:</span> {state.result.companyId}
              </p>
              <Button
                onClick={() => handleCopy(state.result!.companyId, "Company ID")}
                size="xs"
                type="button"
                variant="outline"
              >
                Copy Company ID
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p>
                <span className="font-medium">Username:</span> {state.result.username}
              </p>
              <Button
                onClick={() => handleCopy(state.result!.username, "Username")}
                size="xs"
                type="button"
                variant="outline"
              >
                Copy Username
              </Button>
            </div>
            <p>
              <span className="font-medium">Created User UID:</span> {state.result.userId}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <p>
                <span className="font-medium">Temporary Password:</span>{" "}
                {showPassword ? state.result.temporaryPassword : "**************"}
              </p>
              <Button
                onClick={() => setShowPassword((previous) => !previous)}
                size="xs"
                type="button"
                variant="outline"
              >
                {showPassword ? "Hide" : "Show"}
              </Button>
              <Button
                onClick={() => handleCopy(state.result!.temporaryPassword, "Password")}
                size="xs"
                type="button"
                variant="outline"
              >
                Copy Password
              </Button>
            </div>

            {state.result.assignedBranch ? (
              <p>
                <span className="font-medium">Assigned Branch:</span> {state.result.assignedBranch}
              </p>
            ) : null}
            {state.result.assignedArea ? (
              <p>
                <span className="font-medium">Assigned Area:</span> {state.result.assignedArea}
              </p>
            ) : null}
            {state.result.assignedBranches.length > 0 ? (
              <p>
                <span className="font-medium">Assigned Branches:</span>{" "}
                {state.result.assignedBranches.join(", ")}
              </p>
            ) : null}
            {state.result.contactNo ? (
              <p>
                <span className="font-medium">Contact Number:</span> {state.result.contactNo}
              </p>
            ) : null}
            {state.result.email ? (
              <p>
                <span className="font-medium">Email:</span> {state.result.email}
              </p>
            ) : null}
            <p>
              <span className="font-medium">Status:</span> {state.result.status}
            </p>
            {state.result.address ? (
              <p>
                <span className="font-medium">Address:</span> {state.result.address}
              </p>
            ) : null}
            {copyStatus ? <p className="text-muted-foreground text-xs">{copyStatus}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
