import type { DashboardAuthContext } from "@/app/dashboard/auth";
import type {
  LoanListTab,
  LoanStatusFilter,
  LoansListFilters,
  LoansPageAccessState,
} from "@/app/dashboard/loans/types";

function toPositiveInt(value: string | undefined) {
  return /^\d+$/.test(String(value ?? "")) ? Number(value) : null;
}

function normalizePageSize(value: string | undefined) {
  const numeric = toPositiveInt(value);
  if (numeric === 10 || numeric === 20 || numeric === 50) {
    return numeric;
  }

  return 20;
}

function normalizeSearchQuery(value: string | undefined) {
  return String(value ?? "").trim().slice(0, 100);
}

function normalizeTab(value: string | undefined, legacyStatusValue: string | undefined): LoanListTab {
  const rawValue = String(value ?? legacyStatusValue ?? "").trim();

  if (rawValue === "archived" || rawValue === "Archived") {
    return "archived";
  }

  return "active";
}

function normalizeStatus(value: string | undefined, tab: LoanListTab): LoanStatusFilter {
  const rawValue = String(value ?? "").trim();
  const activeStatuses: LoanStatusFilter[] = ["all", "Active", "Overdue", "Completed"];
  const archivedStatuses: LoanStatusFilter[] = ["all", "Archived", "Abandoned"];
  const allowed = tab === "archived" ? archivedStatuses : activeStatuses;

  if (allowed.includes(rawValue as LoanStatusFilter)) {
    return rawValue as LoanStatusFilter;
  }

  return "all";
}

export function parseLoansListFilters(params: Awaited<LoansPageProps["searchParams"]>): LoansListFilters {
  const tab = normalizeTab((params as { tab?: string } | undefined)?.tab, params?.status);

  return {
    requestedBranchId: toPositiveInt(params?.branchId),
    tab,
    status: normalizeStatus(params?.status, tab),
    searchQuery: normalizeSearchQuery(params?.query),
    page: Math.max(toPositiveInt(params?.page) ?? 1, 1),
    pageSize: normalizePageSize(params?.pageSize),
  };
}

type LoansPageProps = {
  searchParams?: Promise<{
    branchId?: string;
    tab?: string;
    status?: string;
    query?: string;
    page?: string;
    pageSize?: string;
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
    tab: filters.tab,
    status: filters.status,
    searchQuery: filters.searchQuery,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}
