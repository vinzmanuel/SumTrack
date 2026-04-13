import type { DashboardAuthContext } from "@/app/dashboard/auth";
import type { AnalyticsChartModel } from "@/components/analytics/types";

export type DashboardScope =
  | { kind: "all_branches" }
  | { kind: "branches"; branchIds: number[] }
  | { kind: "collector"; collectorId: string }
  | { kind: "borrower"; borrowerId: string };

export type DashboardOverviewVariant =
  | "management"
  | "secretary"
  | "collector"
  | "borrower"
  | "none";

export type DashboardOverviewState = {
  auth: DashboardAuthContext;
  roleName: DashboardAuthContext["roleName"];
  scope: DashboardScope | null;
  variant: DashboardOverviewVariant;
};

export type OverviewMetrics = {
  collectionsThisMonth: number;
  expensesThisMonth: number;
  activeLoans: number;
  overdueLoans: number;
  outstandingBalance: number;
  borrowerCount: number;
};

export type SecretaryMetrics = {
  loansCreatedThisMonth: number;
  borrowersAddedThisMonth: number;
};

export type CollectorMetrics = {
  assignedLoansCount: number;
  missedPaymentsCount: number;
};

export type BorrowerOverview = {
  currentLoanCode: string;
  loanStatus: string;
  outstandingBalance: number;
  latestPayment: number;
  lastPaymentDate: string;
  nextDueDate: string;
  hasActiveOrOverdueLoan: boolean;
  collectorContact: BorrowerCollectorContact | null;
};

export type BorrowerCollectorContact = {
  collectorName: string;
  collectorCompanyId: string;
  contactNumber: string | null;
  areaLabel: string;
  branchName: string;
  branchLocation: string;
  branchAddress: string;
  hasMultipleActiveCollectors: boolean;
};

export type DashboardOverviewData =
  | {
      variant: "management";
      overview: OverviewMetrics;
      widgets: {
        branchRankChart?: DashboardSecondaryChartWidget;
      };
    }
  | {
      variant: "secretary";
      overview: OverviewMetrics;
      secretary: SecretaryMetrics;
    }
  | {
      variant: "collector";
      overview: OverviewMetrics;
      collector: CollectorMetrics;
    }
  | {
      variant: "borrower";
      borrower: BorrowerOverview;
    }
  | {
      variant: "none";
    };

export type DashboardMiniListItem = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
};

export type DashboardMiniListWidget = {
  id: string;
  title: string;
  description: string;
  emptyMessage: string;
  items: DashboardMiniListItem[];
};

export type DashboardSecondaryChartWidget = {
  id: string;
  title: string;
  description: string;
  chart: AnalyticsChartModel;
};
