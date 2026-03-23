import type { DashboardAuthContext } from "@/app/dashboard/auth";

export type BorrowersPageProps = {
  searchParams?: Promise<{
    branchId?: string;
    areaId?: string;
    query?: string;
    page?: string;
  }>;
};

export type BorrowerDetailTabKey = "profile" | "loan-history" | "documents";

export type BorrowerRiskLabel = "Okay" | "Warning" | "Risky";
export type BorrowerRiskAiTone = "neutral" | "mixed" | "concerning" | "severe";
export type BorrowerRiskAiConfidence = "low" | "medium" | "high";
export type BorrowerRiskSignalKind =
  | "income_instability"
  | "avoidance"
  | "health_issue"
  | "family_emergency"
  | "work_disruption"
  | "repeated_promises"
  | "other";

export type BorrowerRiskSignal = {
  signal: BorrowerRiskSignalKind;
  evidence: string;
};

export type BorrowerRiskLoanMix = {
  active: number;
  overdue: number;
  completed: number;
  archived: number;
  abandoned: number;
};

export type BorrowerRiskMetrics = {
  totalLoans: number;
  totalCollectionEntries: number;
  totalNormalPayments: number;
  totalMissedPayments: number;
  missedPaymentRatio: number;
  loansWithMissedPayments: number;
  mostRecentMissedPaymentDate: string | null;
  missedPaymentsLast30Days: number;
  missedPaymentsLast90Days: number;
  currentLoanMix: BorrowerRiskLoanMix;
};

export type BorrowerRiskScoreBreakdown = {
  missedPaymentCount: number;
  missedPaymentRatio: number;
  recency: number;
  loanDistress: number;
  aiNoteSeverity: number;
  total: number;
};

export type BorrowerRiskAiResult = {
  status: "success" | "skipped_no_notes" | "unavailable";
  summary: string;
  overallTone: BorrowerRiskAiTone | null;
  severityScore: number | null;
  confidence: BorrowerRiskAiConfidence | null;
  riskSignals: BorrowerRiskSignal[];
  mitigatingSignals: string[];
  notesAnalyzedCount: number;
  message: string | null;
};

export type BorrowerRiskAssessmentResult = {
  label: BorrowerRiskLabel;
  score: number;
  explanation: string;
  disclaimer: string;
  metrics: BorrowerRiskMetrics;
  scoreBreakdown: BorrowerRiskScoreBreakdown;
  aiAnalysis: BorrowerRiskAiResult;
};

export type BorrowersListFilters = {
  requestedBranchId: number | null;
  requestedAreaId: number | null;
  searchQuery: string;
  page: number;
};

export type BorrowerBranchOption = {
  branch_id: number;
  branch_name: string;
};

export type BorrowerAreaOption = {
  area_id: number;
  area_code: string;
};

export type BorrowerListRow = {
  userId: string;
  companyId: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  areaCode: string;
  branchName: string;
  branchCode: string | null;
  contactNumber: string | null;
};

export type BorrowersStaffScope = {
  view: "staff";
  roleName: DashboardAuthContext["roleName"];
  selectedBranchId: number | null;
  requestedAreaId: number | null;
  allowedBranchIds: number[];
  canChooseBranch: boolean;
  allBranchLabel: string;
  scopeMessage: string;
  searchQuery: string;
  page: number;
};

export type BorrowersAccessState =
  | BorrowersStaffScope
  | {
      view: "unauthenticated";
      message: string;
    }
  | {
      view: "forbidden";
      message: string;
    }
  | {
      view: "scope_error";
      message: string;
    };

export type BorrowersPageData = {
  branches: BorrowerBranchOption[];
  areas: BorrowerAreaOption[];
  borrowers: BorrowerListRow[];
  selectedAreaId: number | null;
  page: number;
  pageSize: number;
  totalCount: number;
};
