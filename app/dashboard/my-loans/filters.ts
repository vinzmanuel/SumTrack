import type { LoanStatusFilter } from "@/app/dashboard/loans/types";
import type { BorrowerLoansFilters } from "@/app/dashboard/my-loans/types";

const DEFAULT_PAGE_SIZE = 20;
const ALLOWED_PAGE_SIZES = new Set([10, 20, 50]);

function normalizeStatus(value: string | undefined): LoanStatusFilter {
  return value === "Active" ||
    value === "Overdue" ||
    value === "Completed" ||
    value === "Archived" ||
    value === "Abandoned"
    ? value
    : "all";
}

function normalizeQuery(value: string | undefined) {
  return String(value ?? "").trim().slice(0, 100);
}

function parsePositiveInt(value: string | undefined) {
  return /^\d+$/.test(String(value ?? "")) ? Number(value) : null;
}

export function parseBorrowerLoansFilters(params: {
  loanStatus?: string;
  loanQuery?: string;
  loansPage?: string;
  pageSize?: string;
}): BorrowerLoansFilters {
  const requestedPageSize = parsePositiveInt(params.pageSize);
  const pageSize =
    requestedPageSize && ALLOWED_PAGE_SIZES.has(requestedPageSize)
      ? requestedPageSize
      : DEFAULT_PAGE_SIZE;

  return {
    status: normalizeStatus(params.loanStatus),
    query: normalizeQuery(params.loanQuery),
    page: Math.max(parsePositiveInt(params.loansPage) ?? 1, 1),
    pageSize,
  };
}

