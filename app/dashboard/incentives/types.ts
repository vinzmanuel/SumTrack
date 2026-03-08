import type { ExportIncentiveRow } from "@/app/dashboard/incentives/export-print-tools";
import type { HistoricalBatchMeta } from "@/app/dashboard/incentives/history";
import type { IncentiveRow, PayPeriod } from "@/app/dashboard/incentives/lib";

export type IncentivesPageProps = {
  searchParams?: Promise<{
    branch?: string;
    month?: string;
  }>;
};

export type IncentivesBranchOption = {
  branch_id: number;
  branch_name: string;
};

export type IncentivesFiltersState = {
  selectedMonthRaw: string;
  selectedBranchRaw: string;
  payPeriod: PayPeriod | null;
};

export type IncentivesAccessState =
  | {
      view: "unauthenticated";
      message: string;
    }
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
      roleName: "Admin" | "Branch Manager" | "Auditor";
      isAdmin: boolean;
      isBranchManager: boolean;
      isAuditor: boolean;
      selectedMonthRaw: string;
      selectedBranchRaw: string;
      payPeriod: PayPeriod | null;
      branches: IncentivesBranchOption[];
      filterBranches: IncentivesBranchOption[];
      auditorBranchIds: number[];
      fixedBranchName: string | null;
      resolvedBranchId: number | null;
      resolvedBranchName: string | null;
      allAssignedBranchesMode: boolean;
    };

export type LoadedBranchIncentives = {
  collectorRows: IncentiveRow[];
  secretaryRows: IncentiveRow[];
  branchManagerRows: IncentiveRow[];
  branchCollectorAverage: number;
  collectorRuleMissing: boolean;
  secretaryRuleMissing: boolean;
  branchManagerRuleMissing: boolean;
  batchMeta: HistoricalBatchMeta | null;
};

export type IncentivesViewState =
  | {
      kind: "invalid_period";
    }
  | {
      kind: "branch_required";
    }
  | {
      kind: "ready";
      collectorRows: IncentiveRow[];
      secretaryRows: IncentiveRow[];
      branchManagerRows: IncentiveRow[];
      branchCollectorAverage: number;
      collectorRuleMissing: boolean;
      secretaryRuleMissing: boolean;
      branchManagerRuleMissing: boolean;
      batchMeta: HistoricalBatchMeta | null;
      totalEmployees: number;
      totalComputedIncentive: number;
      exportRows: ExportIncentiveRow[];
      periodLabel: string;
      periodStart: string;
      periodEnd: string;
      isFinalized: boolean;
      canFinalize: boolean;
      finalizeLockReason: string;
      finalizedByText: string | null;
      exportFileName: string;
      modeLabel: string;
    };
