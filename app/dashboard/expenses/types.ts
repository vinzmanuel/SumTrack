export type ExpensesPageProps = {
  searchParams?: Promise<{
    branch?: string;
    month?: string;
    category?: string;
    page?: string;
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
  recordedByUsername: string | null;
  recordedByCompanyId: string | null;
  recordedAt: string | null;
};

export type ExpensesFiltersState = {
  selectedBranchRaw: string;
  selectedMonthRaw: string;
  selectedCategory: string;
  page: number;
  monthRange: {
    start: string;
    end: string;
  } | null;
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
      selectedMonthRaw: string;
      selectedCategory: string;
      page: number;
      monthRange: {
        start: string;
        end: string;
      } | null;
      fixedBranchName: string | null;
      resolvedBranchId: number | null;
      assignedBranchIds: number[];
    };

export type ExpensesPageData = {
  branches: ExpenseBranchOption[];
  expenses: ExpenseListRow[];
  totalExpenses: number;
  totalAmount: number;
  page: number;
  pageSize: number;
};
