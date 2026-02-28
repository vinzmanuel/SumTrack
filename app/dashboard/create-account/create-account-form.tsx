"use client";

import { useActionState, useMemo, useRef, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  createAccountAction,
} from "@/app/dashboard/create-account/actions";
import {
  initialCreateAccountState,
  type CreateAccountState,
} from "@/app/dashboard/create-account/state";

type RoleOption = {
  role_id: string | number;
  role_name: string;
};

type BranchOption = {
  branch_id: string | number;
  branch_name: string;
};

type AccountCategory = "Employee" | "Borrower";

type CreateAccountFormProps = {
  roles: RoleOption[];
  branches: BranchOption[];
};

const EMPLOYEE_ROLE_NAMES = [
  "Admin",
  "Auditor",
  "Branch Manager",
  "Secretary",
  "Collector",
];
const SINGLE_BRANCH_ROLE_NAMES = ["Branch Manager", "Secretary", "Collector"];

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Creating..." : "Create account"}
    </Button>
  );
}

function getRoleError(state: CreateAccountState) {
  return state.fieldErrors?.role_id;
}

function buildAccountDetailsLines(result: NonNullable<CreateAccountState["result"]>) {
  const lines = [
    "SumTrack Account Details",
    "",
    `Account Category: ${result.accountCategory}`,
    `Created Role: ${result.role}`,
    `Full Name: ${result.fullName}`,
    `Initial Username: ${result.username}`,
    `Created User UID: ${result.userId}`,
    `Temporary Password: ${result.temporaryPassword}`,
  ];

  if (result.accountCategory === "Employee" && result.assignedBranches.length > 0) {
    lines.push(
      `${result.assignedBranches.length > 1 ? "Assigned Branches" : "Assigned Branch"}: ${result.assignedBranches.join(", ")}`,
    );
  }

  if (result.accountCategory === "Borrower") {
    lines.push(`Contact Number: ${result.contactNumber ?? ""}`);
    lines.push(`Address: ${result.address ?? ""}`);
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

export function CreateAccountForm({ roles, branches }: CreateAccountFormProps) {
  const [state, formAction] = useActionState(createAccountAction, initialCreateAccountState);
  const formRef = useRef<HTMLFormElement>(null);

  const [accountCategory, setAccountCategory] = useState<AccountCategory>("Employee");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [singleBranchId, setSingleBranchId] = useState("");
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

  const [roleId, setRoleId] = useState<string>("");
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
  const selectedRoleName = selectedRole?.role_name;

  const showBorrowerFields = accountCategory === "Borrower";
  const showRoleSelector = accountCategory === "Employee";
  const showSingleBranchSelector =
    showRoleSelector && !!selectedRoleName && SINGLE_BRANCH_ROLE_NAMES.includes(selectedRoleName);
  const showAuditorBranchSelector = showRoleSelector && selectedRoleName === "Auditor";

  const selectedSingleBranchName =
    branches.find((branch) => String(branch.branch_id) === singleBranchId)?.branch_name ?? "";
  const selectedAuditorBranchNames = branches
    .filter((branch) => auditorBranchIds.includes(String(branch.branch_id)))
    .map((branch) => branch.branch_name);

  function handleCategoryChange(value: AccountCategory) {
    setAccountCategory(value);
    setCopyStatus("");

    if (value === "Borrower") {
      setSingleBranchId("");
      setAuditorBranchIds([]);
      return;
    }

    if (!hasSelectedEmployeeRole) {
      setRoleId(employeeRoles[0] ? String(employeeRoles[0].role_id) : "");
    }
  }

  function handleRoleChange(value: string) {
    setRoleId(value);
    setCopyStatus("");

    const role = employeeRoles.find((item) => String(item.role_id) === value)?.role_name;
    if (role === "Auditor") {
      setSingleBranchId("");
      return;
    }

    setAuditorBranchIds([]);
    if (role === "Admin") {
      setSingleBranchId("");
    }
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
    if (!state.result) {
      return;
    }

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
          <form
            action={formAction}
            className="space-y-4"
            onSubmit={handleSubmit}
            ref={formRef}
          >
            <input name="account_category" type="hidden" value={accountCategory} />
            <input name="role_id" type="hidden" value={effectiveRoleId} />
            <input name="branch_id" type="hidden" value={showSingleBranchSelector ? singleBranchId : ""} />

            <div className="space-y-2">
              <Label>Account Category</Label>
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

            {showRoleSelector ? (
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  onValueChange={handleRoleChange}
                  value={effectiveRoleId}
                >
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
                {getRoleError(state) ? (
                  <p className="text-sm text-destructive">{getRoleError(state)}</p>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
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
                <Label htmlFor="last_name">Last Name</Label>
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
              <p className="text-sm">Initial username will be the generated User ID</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A temporary password will be generated automatically.
              </p>
            </div>

            {showBorrowerFields ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact_number">Contact Number</Label>
                  <Input
                    id="contact_number"
                    inputMode="numeric"
                    maxLength={11}
                    name="contact_number"
                    onChange={(event) =>
                      setContactNumber(event.target.value.replace(/\D/g, "").slice(0, 11))
                    }
                    pattern="[0-9]*"
                    value={contactNumber}
                  />
                  {state.fieldErrors?.contact_number ? (
                    <p className="text-sm text-destructive">{state.fieldErrors.contact_number}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
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
              </div>
            ) : null}

            {showSingleBranchSelector ? (
              <div className="space-y-2">
                <Label>Branch (Required)</Label>
                <Select onValueChange={setSingleBranchId} value={singleBranchId}>
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
            ) : null}

            {showAuditorBranchSelector ? (
              <div className="space-y-2">
                <Label>Assigned Branches (Select one or more)</Label>
                <div className="space-y-2 rounded-md border p-3">
                  {branches.map((branch) => (
                    <label
                      key={String(branch.branch_id)}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        checked={auditorBranchIds.includes(String(branch.branch_id))}
                        className="h-4 w-4"
                        name="branch_ids"
                        onChange={(event) => {
                          const value = String(branch.branch_id);
                          setAuditorBranchIds((previous) => {
                            if (event.target.checked) {
                              return previous.includes(value) ? previous : [...previous, value];
                            }
                            return previous.filter((id) => id !== value);
                          });
                        }}
                        type="checkbox"
                        value={String(branch.branch_id)}
                      />
                      <span>{branch.branch_name}</span>
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
                <DialogDescription>
                  Review the details below before creating the account.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Account Category:</span> {accountCategory}
                </p>
                <p>
                  <span className="font-medium">Role:</span>{" "}
                  {accountCategory === "Borrower" ? "Borrower" : selectedRoleName ?? "N/A"}
                </p>
                <p>
                  <span className="font-medium">Full Name:</span>{" "}
                  {[firstName, lastName].filter(Boolean).join(" ") || "N/A"}
                </p>
                {showSingleBranchSelector && selectedSingleBranchName ? (
                  <p>
                    <span className="font-medium">Assigned Branch:</span> {selectedSingleBranchName}
                  </p>
                ) : null}
                {showAuditorBranchSelector && selectedAuditorBranchNames.length > 0 ? (
                  <p>
                    <span className="font-medium">Assigned Branches:</span>{" "}
                    {selectedAuditorBranchNames.join(", ")}
                  </p>
                ) : null}
                {accountCategory === "Borrower" ? (
                  <>
                    <p>
                      <span className="font-medium">Contact Number:</span>{" "}
                      {contactNumber || "N/A"}
                    </p>
                    <p>
                      <span className="font-medium">Address:</span> {address || "N/A"}
                    </p>
                  </>
                ) : null}
              </div>

              <DialogFooter>
                <Button onClick={() => setIsConfirmOpen(false)} type="button" variant="outline">
                  Cancel
                </Button>
                <Button onClick={handleConfirmCreate} type="button">
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
                <span className="font-medium">Initial Username:</span> {state.result.username}
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
                {showPassword ? state.result.temporaryPassword : "••••••••••••"}
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

            {state.result.accountCategory === "Employee" &&
            state.result.assignedBranches.length > 0 ? (
              <p>
                <span className="font-medium">
                  {state.result.assignedBranches.length > 1
                    ? "Assigned Branches"
                    : "Assigned Branch"}
                  :
                </span>{" "}
                {state.result.assignedBranches.join(", ")}
              </p>
            ) : null}

            {state.result.accountCategory === "Borrower" ? (
              <>
                <p>
                  <span className="font-medium">Contact Number:</span>{" "}
                  {state.result.contactNumber ?? ""}
                </p>
                <p>
                  <span className="font-medium">Address:</span> {state.result.address ?? ""}
                </p>
              </>
            ) : null}
            {copyStatus ? <p className="text-muted-foreground text-xs">{copyStatus}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
