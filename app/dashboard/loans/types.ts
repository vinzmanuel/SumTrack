import type { DashboardAuthContext } from "@/app/dashboard/auth";

export type LoansPageProps = {
  searchParams?: Promise<{
    branchId?: string;
    status?: string;
    query?: string;
    page?: string;
  }>;
};

export type LoansListFilters = {
  requestedBranchId: number | null;
  status: LoanStatusFilter;
  searchQuery: string;
  page: number;
};

export type LoanStatusFilter = "all" | "Active" | "Overdue" | "Completed" | "Archived";

export type LoanBranchOption = {
  branch_id: number;
  branch_name: string;
};

export type LoanListRow = {
  loanId: number;
  loanCode: string;
  borrowerId: string;
  borrowerName: string;
  branchId: number;
  branchName: string;
  collectorId: string | null;
  collectorName: string;
  principal: number;
  interest: number;
  startDate: string;
  dueDate: string;
  status: string;
};

export type StaffLoansScope = {
  view: "staff";
  roleName: DashboardAuthContext["roleName"];
  selectedBranchId: number | null;
  allowedBranchIds: number[];
  canChooseBranchFilter: boolean;
  canCreateLoan: boolean;
  status: LoanStatusFilter;
  searchQuery: string;
  page: number;
};

export type LoansPageAccessState =
  | StaffLoansScope
  | {
      view: "collector_redirect";
    }
  | {
      view: "borrower_redirect";
    }
  | {
      view: "forbidden";
      message: string;
    };

export type StaffLoansPageData = {
  branchOptions: LoanBranchOption[];
  loans: LoanListRow[];
  page: number;
  pageSize: number;
  totalCount: number;
};
