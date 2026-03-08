import type { DashboardAuthContext } from "@/app/dashboard/auth";

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
};

export type DashboardOverviewData =
  | {
      variant: "management";
      overview: OverviewMetrics;
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
