import type { DashboardAuthContext } from "@/app/dashboard/auth";
import type { LoansListFilters, LoansPageAccessState } from "@/app/dashboard/loans/types";

function toPositiveInt(value: string | undefined) {
  return /^\d+$/.test(String(value ?? "")) ? Number(value) : null;
}

export function parseLoansListFilters(params: Awaited<LoansPageProps["searchParams"]>): LoansListFilters {
  return {
    requestedBranchId: toPositiveInt(params?.branchId),
  };
}

type LoansPageProps = {
  searchParams?: Promise<{
    branchId?: string;
  }>;
};

export function resolveLoansPageAccess(
  auth: DashboardAuthContext,
  filters: LoansListFilters,
): LoansPageAccessState {
  const role = auth.roleName;

  if (role === "Collector") {
    return { view: "collector_redirect" };
  }

  if (role === "Borrower") {
    return { view: "borrower_redirect" };
  }

  const isAdmin = role === "Admin";
  const isAuditor = role === "Auditor";
  const isBranchScoped = role === "Branch Manager" || role === "Secretary";

  if (!isAdmin && !isAuditor && !isBranchScoped) {
    return {
      view: "forbidden",
      message: "You are not authorized to view loans.",
    };
  }

  let allowedBranchIds: number[] = [];
  if (isBranchScoped) {
    allowedBranchIds = auth.activeBranchId ? [auth.activeBranchId] : [];
  } else if (isAuditor) {
    allowedBranchIds = auth.assignedBranchIds;
  }

  const selectedBranchId = isAdmin
    ? filters.requestedBranchId
    : isAuditor
      ? (filters.requestedBranchId && allowedBranchIds.includes(filters.requestedBranchId)
          ? filters.requestedBranchId
          : null)
      : allowedBranchIds[0] ?? null;

  return {
    view: "staff",
    roleName: role,
    selectedBranchId,
    allowedBranchIds,
    canChooseBranchFilter: isAdmin || isAuditor,
    canCreateLoan: isAdmin || role === "Branch Manager" || role === "Secretary",
  };
}
