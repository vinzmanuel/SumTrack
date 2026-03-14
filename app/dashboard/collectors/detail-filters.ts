import type { LoanStatusFilter } from "@/app/dashboard/loans/types";
import type {
  CollectorAssignedLoansFilters,
  CollectorDetailTabKey,
} from "@/app/dashboard/collectors/types";

export function parseCollectorDetailTab(value: string | undefined): CollectorDetailTabKey {
  if (value === "performance" || value === "assigned-loans") {
    return value;
  }

  return "profile";
}

function normalizeStatus(value: string | undefined): LoanStatusFilter {
  return value === "Active" ||
    value === "Overdue" ||
    value === "Completed" ||
    value === "Archived"
    ? value
    : "all";
}

function normalizeQuery(value: string | undefined) {
  return String(value ?? "").trim().slice(0, 100);
}

function parsePositiveInt(value: string | undefined) {
  return /^\d+$/.test(String(value ?? "")) ? Number(value) : null;
}

export function parseCollectorAssignedLoansFilters(params: {
  loanStatus?: string;
  loanQuery?: string;
  loansPage?: string;
}): CollectorAssignedLoansFilters {
  return {
    status: normalizeStatus(params.loanStatus),
    query: normalizeQuery(params.loanQuery),
    page: Math.max(parsePositiveInt(params.loansPage) ?? 1, 1),
  };
}
