import type { AnalyticsDateRangeKey } from "@/components/analytics/types";

export type ExpensesPageProps = {
  searchParams?: Promise<{
    branch?: string;
    month?: string;
    range?: string;
    from?: string;
    to?: string;
    category?: string;
    page?: string;
    pageSize?: string;
  }>;
};

export type ExpenseBranchOption = {
  branch_id: number;
  branch_name: string;
};

export type ExpenseListRow = {
  expenseId: number;
  branchName: string;
  category: string;
  description: string | null;
  amount: number;
  expenseDate: string;
  recordedByRoleName: string | null;
  recordedByFirstName: string | null;
  recordedByMiddleName: string | null;
  recordedByLastName: string | null;
  recordedByUsername: string | null;
  recordedByCompanyId: string | null;
  recordedAt: string | null;
};

export type ExpenseBreakdownMode = "branch" | "category";

export type ExpenseBreakdownRow = {
  key: string;
  label: string;
  amount: number;
  expenseCount: number;
  share: number;
  fill: string;
};

export type ExpensesFiltersState = {
  selectedBranchRaw: string;
  selectedRange: AnalyticsDateRangeKey;
  fromRaw: string;
  toRaw: string;
  selectedCategory: string;
  page: number;
  pageSize: number;
  dateRange: {
    start: string;
    end: string;
    label: string;
    granularity: "day" | "month";
  };
};

export type ExpensesFilterInput = {
  branch: string;
  range: AnalyticsDateRangeKey;
  from: string;
  to: string;
  category: string;
  page: number;
  pageSize: number;
};

export type ExpensesPageAccessState =
  | {
      view: "forbidden";
      message: string;
    }
  | {
      view: "branch_error";
      message: string;
    }
  | {
      view: "ready";
      isAdmin: boolean;
      isBranchManager: boolean;
      isAuditor: boolean;
      canChooseBranch: boolean;
      canCreateExpense: boolean;
      selectedBranchRaw: string;
      selectedRange: AnalyticsDateRangeKey;
      fromRaw: string;
      toRaw: string;
      selectedCategory: string;
      page: number;
      pageSize: number;
      dateRange: {
        start: string;
        end: string;
        label: string;
        granularity: "day" | "month";
      };
      fixedBranchName: string | null;
      resolvedBranchId: number | null;
      assignedBranchIds: number[];
    };

export type ExpensesResultsData = {
  expenses: ExpenseListRow[];
  totalExpenses: number;
  totalAmount: number;
  page: number;
  pageSize: number;
  breakdownMode: ExpenseBreakdownMode;
  breakdownRows: ExpenseBreakdownRow[];
};
