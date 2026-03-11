import type { DashboardAuthContext } from "@/app/dashboard/auth";
import type { DashboardChartAccessState } from "@/app/dashboard/dashboard-chart-types";
import type { AnalyticsSelectOption, AnalyticsSeriesDefinition } from "@/components/analytics/types";

const dashboardSeries: Record<"collections" | "expenses" | "incentives", AnalyticsSeriesDefinition> = {
  collections: {
    key: "collections",
    label: "Collections",
    color: "#22c55e",
  },
  expenses: {
    key: "expenses",
    label: "Expenses",
    color: "#f59e0b",
  },
  incentives: {
    key: "incentives",
    label: "Incentives",
    color: "#818cf8",
  },
};

function toBranchOptions(
  options: Array<{ branchId: number; branchName: string }>,
  allLabel: string,
): AnalyticsSelectOption[] {
  return [
    { value: "all", label: allLabel },
    ...options.map((option) => ({
      value: String(option.branchId),
      label: option.branchName,
    })),
  ];
}

export function resolveDashboardChartConfig(
  auth: DashboardAuthContext,
  branchOptions: Array<{ branchId: number; branchName: string }>,
  scopedBranchIds: number[],
): DashboardChartAccessState {
  if (auth.roleName === "Borrower") {
    return { view: "none" };
  }

  if (auth.roleName === "Admin") {
    return {
      view: "ready",
      roleName: auth.roleName,
      variant: "management",
      title: "Operational Overview",
      description: "Collections, expenses, and incentives trend",
      branchFilterLabel: "Branch",
      canChooseBranch: true,
      branchOptions: toBranchOptions(branchOptions, "All branches"),
      scopedBranchIds,
      series: [dashboardSeries.collections, dashboardSeries.expenses, dashboardSeries.incentives],
    };
  }

  if (auth.roleName === "Auditor") {
    return {
      view: "ready",
      roleName: auth.roleName,
      variant: "management",
      title: "Operational Overview",
      description: "Collections, expenses, and incentives trend",
      branchFilterLabel: "Assigned Branch",
      canChooseBranch: true,
      branchOptions: toBranchOptions(branchOptions, "All assigned branches"),
      scopedBranchIds,
      series: [dashboardSeries.collections, dashboardSeries.expenses, dashboardSeries.incentives],
    };
  }

  if (auth.roleName === "Branch Manager") {
    return {
      view: "ready",
      roleName: auth.roleName,
      variant: "management",
      title: "Operational Overview",
      description: "Collections, expenses, and incentives trend",
      branchFilterLabel: null,
      canChooseBranch: false,
      branchOptions: [],
      scopedBranchIds,
      series: [dashboardSeries.collections, dashboardSeries.expenses, dashboardSeries.incentives],
    };
  }

  if (auth.roleName === "Secretary") {
    return {
      view: "ready",
      roleName: auth.roleName,
      variant: "secretary",
      title: "Collections Overview",
      description: "Branch collections trend",
      branchFilterLabel: null,
      canChooseBranch: false,
      branchOptions: [],
      scopedBranchIds,
      series: [dashboardSeries.collections],
    };
  }

  if (auth.roleName === "Collector") {
    return {
      view: "ready",
      roleName: auth.roleName,
      variant: "collector",
      title: "My Collections Overview",
      description: "Your collections trend",
      branchFilterLabel: null,
      canChooseBranch: false,
      branchOptions: [],
      scopedBranchIds: [],
      series: [
        {
          ...dashboardSeries.collections,
          label: "My Collections",
        },
      ],
    };
  }

  return { view: "none" };
}
