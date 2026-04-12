import type { LoanListRow, LoanStatusFilter } from "@/app/dashboard/loans/types";

export type BorrowerLoansFilters = {
  status: LoanStatusFilter;
  query: string;
  page: number;
  pageSize: number;
};

export type BorrowerLoansPageData = {
  loans: LoanListRow[];
  page: number;
  pageSize: number;
  totalCount: number;
};

