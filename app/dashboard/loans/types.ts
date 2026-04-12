import type { DashboardAuthContext } from "@/app/dashboard/auth";
import type { StoredLoanStatus, VisibleLoanStatus } from "@/app/dashboard/loans/loan-state";

export type LoansPageProps = {
  searchParams?: Promise<{
    branchId?: string;
    tab?: string;
    status?: string;
    query?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export type LoansListFilters = {
  requestedBranchId: number | null;
  tab: LoanListTab;
  status: LoanStatusFilter;
  searchQuery: string;
  page: number;
  pageSize: number;
};

export type LoanListTab = "active" | "archived";
export type LoanStatusFilter = "all" | "Active" | "Overdue" | "Completed" | "Archived" | "Abandoned";

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
  storedStatus: StoredLoanStatus;
  visibleStatus: VisibleLoanStatus;
  totalPayable: number;
  totalCollected: number;
  remainingBalance: number;
  collectionCount: number;
  canArchive: boolean;
  canDelete: boolean;
};

export type StaffLoansScope = {
  view: "staff";
  roleName: DashboardAuthContext["roleName"];
  selectedBranchId: number | null;
  allowedBranchIds: number[];
  canChooseBranchFilter: boolean;
  canCreateLoan: boolean;
  tab: LoanListTab;
  status: LoanStatusFilter;
  searchQuery: string;
  page: number;
  pageSize: number;
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
  activeCount: number;
  archivedCount: number;
  page: number;
  pageSize: number;
  totalCount: number;
};
