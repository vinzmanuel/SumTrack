import type { AnalyticsChartModel, AnalyticsDateRangeKey } from "@/components/analytics/types";

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

export type ExpenseAnalyticsMetricSummary = {
  totalCollections: number;
  expenseToCollectionsRatio: number | null;
  daysWithExpenses: number;
  averageExpensePerActiveDay: number;
  largestExpenseAmount: number;
  largestExpenseCategory: string | null;
  largestExpenseDate: string | null;
  topThreeExpenseShare: number;
  highestSpendDayAmount: number;
  highestSpendDayDate: string | null;
  topCategory: string | null;
  topCategoryShare: number;
  totalFixedSpend: number;
  totalVariableSpend: number;
  fixedSpendShare: number;
  variableSpendShare: number;
  totalRecurringSpend: number;
  totalAdHocSpend: number;
  recurringSpendShare: number;
  adHocSpendShare: number;
  totalSalarySpend: number;
  salaryShare: number;
  totalUtilitySpend: number;
  utilityShare: number;
  miscellaneousSpend: number;
  miscellaneousShare: number;
  miscellaneousCount: number;
};

export type ExpenseGroupedSpendSummary = {
  label: string;
  amount: number;
  share: number;
  expenseCount: number;
  categories: string[];
};

export type ExpenseSpendStructureData = {
  fixed: ExpenseGroupedSpendSummary;
  variable: ExpenseGroupedSpendSummary;
  recurring: ExpenseGroupedSpendSummary;
  adHoc: ExpenseGroupedSpendSummary;
};

export type ExpenseSalaryRhythmRow = {
  bucketKey: string;
  bucketLabel: string;
  midMonthAmount: number;
  monthEndAmount: number;
  midMonthCount: number;
  monthEndCount: number;
  deltaAmount: number;
};

export type ExpenseSalaryRhythmData = {
  totalAmount: number;
  share: number;
  midMonthTotal: number;
  monthEndTotal: number;
  midMonthCount: number;
  monthEndCount: number;
  monthEndHigherMonths: number;
  chart: AnalyticsChartModel;
  rows: ExpenseSalaryRhythmRow[];
};

export type ExpenseUtilitiesData = {
  totalAmount: number;
  share: number;
  electricityAmount: number;
  waterAmount: number;
  electricityShare: number;
  waterShare: number;
  chart: AnalyticsChartModel;
};

export type ExpenseMiscDescriptionItem = {
  label: string;
  amount: number;
  count: number;
};

export type ExpenseMiscellaneousData = {
  totalAmount: number;
  share: number;
  count: number;
  overuseFlag: boolean;
  topDescriptions: ExpenseMiscDescriptionItem[];
};

export type ExpenseBranchMixItem = {
  key: string;
  label: string;
  amount: number;
  expenseCount: number;
  share: number;
  expenseToCollectionsRatio: number | null;
  topCategory: string | null;
  fixedShare: number;
  variableShare: number;
  recurringShare: number;
  adHocShare: number;
  salaryShare: number;
  utilityShare: number;
  miscellaneousShare: number;
  disciplineLabel: string;
};

export type ExpenseTopDriver = {
  expenseId: number;
  branchName: string;
  category: string;
  description: string | null;
  amount: number;
  expenseDate: string;
};

export type ExpenseBranchComparisonItem = {
  key: string;
  label: string;
  amount: number;
  expenseCount: number;
  share: number;
  expenseToCollectionsRatio: number | null;
  topCategory: string | null;
};

export type ExpenseHighestSpendDayItem = {
  key: string;
  label: string;
  amount: number;
  expenseCount: number;
  share: number;
};

export type ExpenseBranchComparisonData = {
  title: string;
  description: string;
  items: ExpenseBranchComparisonItem[];
  emptyMessage: string;
};

export type ExpenseHighestSpendDaysData = {
  title: string;
  description: string;
  items: ExpenseHighestSpendDayItem[];
  emptyMessage: string;
};

export type ExpenseAnalyticsData = {
  summary: ExpenseAnalyticsMetricSummary;
  structure: ExpenseSpendStructureData;
  salaryRhythm: ExpenseSalaryRhythmData;
  utilities: ExpenseUtilitiesData;
  miscellaneous: ExpenseMiscellaneousData;
  trend: AnalyticsChartModel;
  topDrivers: ExpenseTopDriver[];
  branchMix: ExpenseBranchMixItem[];
  supportMode: "branch-comparison" | "highest-spend-days";
  branchComparison: ExpenseBranchComparisonData;
  highestSpendDays: ExpenseHighestSpendDaysData;
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
  analytics: ExpenseAnalyticsData;
};
