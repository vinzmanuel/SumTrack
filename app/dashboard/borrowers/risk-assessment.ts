import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import type { DashboardAuthContext } from "@/app/dashboard/auth";
import {
  type BorrowerRiskAssessmentResult,
  type BorrowerRiskAiResult,
  type BorrowerRiskLabel,
  type BorrowerRiskLoanMix,
  type BorrowerRiskMetrics,
  type BorrowerRiskScoreBreakdown,
} from "@/app/dashboard/borrowers/types";
import { buildLoanComputedState, getManilaTodayDateString } from "@/app/dashboard/loans/loan-state";
import { db } from "@/db";
import { areas, borrower_info, collections, loan_records } from "@/db/schema";
import { analyzeBorrowerMissedPaymentNotes } from "@/lib/ai/gemini";

const RISK_DISCLAIMER =
  "AI-assisted risk analysis only. This is not the final approval decision and should be reviewed alongside borrower payment history and staff judgment.";
const MAX_NOTES_FOR_AI = 12;

type BorrowerRiskAccessResult =
  | { ok: true; borrowerBranchId: number }
  | { ok: false; status: 403 | 404; message: string };

type LoanRiskRow = {
  loan_id: number;
  principal: number | string;
  interest: number | string;
  due_date: string;
  status: string;
  total_collected: number | string;
};

type CollectionRiskRow = {
  collection_id: number;
  loan_id: number;
  amount: number | string;
  note: string | null;
  collection_date: string;
};

function normalizeNumeric(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMissedPaymentNote(value: string | null) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function toDateOnlyString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftDateString(dateString: string, deltaDays: number) {
  const base = new Date(`${dateString}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return toDateOnlyString(base);
}

function isMissedPaymentRow(row: CollectionRiskRow) {
  return normalizeNumeric(row.amount) === 0 && normalizeMissedPaymentNote(row.note).length > 0;
}

function buildLoanMix(rows: LoanRiskRow[], currentDate: string): BorrowerRiskLoanMix {
  return rows.reduce<BorrowerRiskLoanMix>(
    (mix, row) => {
      const visibleStatus = buildLoanComputedState({
        principal: normalizeNumeric(row.principal),
        interest: normalizeNumeric(row.interest),
        totalCollected: normalizeNumeric(row.total_collected),
        dueDate: row.due_date,
        storedStatus: row.status,
        currentDate,
      }).visibleStatus;

      if (visibleStatus === "Active") mix.active += 1;
      if (visibleStatus === "Overdue") mix.overdue += 1;
      if (visibleStatus === "Completed") mix.completed += 1;
      if (visibleStatus === "Archived") mix.archived += 1;
      if (visibleStatus === "Abandoned") mix.abandoned += 1;

      return mix;
    },
    {
      active: 0,
      overdue: 0,
      completed: 0,
      archived: 0,
      abandoned: 0,
    },
  );
}

function selectNotesForAi(missedPayments: CollectionRiskRow[]) {
  const seen = new Set<string>();
  const selected: string[] = [];

  for (const row of missedPayments) {
    const normalized = normalizeMissedPaymentNote(row.note);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    selected.push(normalized);

    if (selected.length >= MAX_NOTES_FOR_AI) {
      break;
    }
  }

  return selected;
}

function buildScoreBreakdown(metrics: BorrowerRiskMetrics, aiAnalysis: BorrowerRiskAiResult): BorrowerRiskScoreBreakdown {
  const missedCountScore =
    metrics.totalMissedPayments === 0
      ? 0
      : metrics.totalMissedPayments <= 2
        ? 10
        : metrics.totalMissedPayments <= 5
          ? 20
          : 30;

  const missedRatioPercentage = metrics.missedPaymentRatio * 100;
  const missedRatioScore =
    missedRatioPercentage < 10 ? 0 : missedRatioPercentage < 25 ? 8 : missedRatioPercentage < 40 ? 14 : 20;

  const recencyScore =
    metrics.missedPaymentsLast30Days > 0 ? 15 : metrics.missedPaymentsLast90Days > 0 ? 8 : 0;

  const loanDistressScore =
    metrics.currentLoanMix.abandoned > 0 ? 25 : metrics.currentLoanMix.overdue > 0 ? 15 : 0;

  const aiNoteSeverityScore =
    aiAnalysis.status === "success" ? Math.max(0, Math.min(10, aiAnalysis.severityScore ?? 0)) : 0;

  const total =
    missedCountScore + missedRatioScore + recencyScore + loanDistressScore + aiNoteSeverityScore;

  return {
    missedPaymentCount: missedCountScore,
    missedPaymentRatio: missedRatioScore,
    recency: recencyScore,
    loanDistress: loanDistressScore,
    aiNoteSeverity: aiNoteSeverityScore,
    total,
  };
}

function resolveFinalLabel(score: number): BorrowerRiskLabel {
  if (score >= 55) {
    return "Risky";
  }

  if (score >= 25) {
    return "Warning";
  }

  return "Okay";
}

function buildExplanation(
  metrics: BorrowerRiskMetrics,
  scoreBreakdown: BorrowerRiskScoreBreakdown,
  aiAnalysis: BorrowerRiskAiResult,
) {
  const reasons: string[] = [];

  if (scoreBreakdown.loanDistress === 25) {
    reasons.push("The borrower already has at least one loan marked as abandoned.");
  } else if (scoreBreakdown.loanDistress === 15) {
    reasons.push("The borrower currently has an overdue loan.");
  }

  if (metrics.totalMissedPayments >= 6) {
    reasons.push("Missed payments appear repeatedly across the borrower’s payment history.");
  } else if (metrics.totalMissedPayments >= 3) {
    reasons.push("Several missed-payment entries were found in the borrower’s payment history.");
  } else if (metrics.totalMissedPayments >= 1) {
    reasons.push("A small number of missed-payment entries were found.");
  }

  if (metrics.missedPaymentRatio >= 0.4) {
    reasons.push("Missed payments make up a large share of the borrower’s recorded collections.");
  } else if (metrics.missedPaymentRatio >= 0.25) {
    reasons.push("Missed payments make up a meaningful share of the borrower’s recorded collections.");
  }

  if (metrics.missedPaymentsLast30Days > 0) {
    reasons.push("Recent missed-payment notes were recorded within the last 30 days.");
  } else if (metrics.missedPaymentsLast90Days > 0) {
    reasons.push("Missed-payment notes were recorded within the last 90 days.");
  }

  if (aiAnalysis.status === "success" && aiAnalysis.summary) {
    reasons.push(`AI note review suggests ${aiAnalysis.summary.charAt(0).toLowerCase()}${aiAnalysis.summary.slice(1)}`);
  } else if (aiAnalysis.status === "unavailable") {
    reasons.push("AI note analysis was unavailable, so this result used rule-based scoring only.");
  }

  if (reasons.length === 0) {
    return "The available borrower payment history shows limited missed-payment risk signals.";
  }

  return reasons.slice(0, 3).join(" ");
}

async function resolveBorrowerRiskAccess(
  auth: DashboardAuthContext,
  borrowerId: string,
): Promise<BorrowerRiskAccessResult> {
  const borrowerRow = await db
    .select({
      borrower_id: borrower_info.user_id,
      branch_id: areas.branch_id,
    })
    .from(borrower_info)
    .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
    .where(eq(borrower_info.user_id, borrowerId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!borrowerRow) {
    return { ok: false, status: 404, message: "Borrower not found." };
  }

  const isAdmin = auth.roleName === "Admin";
  const isAuditor = auth.roleName === "Auditor";
  const isBranchScoped = auth.roleName === "Branch Manager" || auth.roleName === "Secretary";

  if (!isAdmin && !isAuditor && !isBranchScoped) {
    return { ok: false, status: 403, message: "You are not authorized to assess borrower risk." };
  }

  if (isAdmin) {
    return { ok: true, borrowerBranchId: borrowerRow.branch_id };
  }

  if (isAuditor) {
    if (!auth.assignedBranchIds.includes(borrowerRow.branch_id)) {
      return { ok: false, status: 403, message: "You are not authorized to assess this borrower." };
    }

    return { ok: true, borrowerBranchId: borrowerRow.branch_id };
  }

  if (!auth.activeBranchId || borrowerRow.branch_id !== auth.activeBranchId) {
    return { ok: false, status: 403, message: "You are not authorized to assess this borrower." };
  }

  return { ok: true, borrowerBranchId: borrowerRow.branch_id };
}

export async function assessBorrowerReapprovalRisk(params: {
  auth: DashboardAuthContext;
  borrowerId: string;
}): Promise<BorrowerRiskAssessmentResult> {
  const access = await resolveBorrowerRiskAccess(params.auth, params.borrowerId);
  if (!access.ok) {
    throw Object.assign(new Error(access.message), { status: access.status });
  }

  const currentDate = getManilaTodayDateString();
  const last30Date = shiftDateString(currentDate, -30);
  const last90Date = shiftDateString(currentDate, -90);

  const [loanRows, collectionRows] = await Promise.all([
    db
      .select({
        loan_id: loan_records.loan_id,
        principal: loan_records.principal,
        interest: loan_records.interest,
        due_date: loan_records.due_date,
        status: loan_records.status,
        total_collected: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(loan_records)
      .leftJoin(collections, eq(collections.loan_id, loan_records.loan_id))
      .where(eq(loan_records.borrower_id, params.borrowerId))
      .groupBy(
        loan_records.loan_id,
        loan_records.principal,
        loan_records.interest,
        loan_records.due_date,
        loan_records.status,
      )
      .catch(() => [] as LoanRiskRow[]),
    db
      .select({
        collection_id: collections.collection_id,
        loan_id: collections.loan_id,
        amount: collections.amount,
        note: collections.note,
        collection_date: collections.collection_date,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(eq(loan_records.borrower_id, params.borrowerId))
      .orderBy(desc(collections.collection_date), desc(collections.collection_id))
      .catch(() => [] as CollectionRiskRow[]),
  ]);

  const missedPaymentRows = collectionRows.filter(isMissedPaymentRow);
  const totalNormalPayments = collectionRows.filter((row) => normalizeNumeric(row.amount) > 0).length;
  const loanMix = buildLoanMix(loanRows, currentDate);
  const distinctLoansWithMissedPayments = new Set(missedPaymentRows.map((row) => row.loan_id)).size;
  const mostRecentMissedPaymentDate = missedPaymentRows[0]?.collection_date ?? null;
  const missedPaymentsLast30Days = missedPaymentRows.filter(
    (row) => row.collection_date >= last30Date && row.collection_date <= currentDate,
  ).length;
  const missedPaymentsLast90Days = missedPaymentRows.filter(
    (row) => row.collection_date >= last90Date && row.collection_date <= currentDate,
  ).length;

  const metrics: BorrowerRiskMetrics = {
    totalLoans: loanRows.length,
    totalCollectionEntries: collectionRows.length,
    totalNormalPayments,
    totalMissedPayments: missedPaymentRows.length,
    missedPaymentRatio:
      collectionRows.length > 0 ? missedPaymentRows.length / collectionRows.length : 0,
    loansWithMissedPayments: distinctLoansWithMissedPayments,
    mostRecentMissedPaymentDate,
    missedPaymentsLast30Days,
    missedPaymentsLast90Days,
    currentLoanMix: loanMix,
  };

  if (missedPaymentRows.length === 0) {
    const emptyBreakdown: BorrowerRiskScoreBreakdown = {
      missedPaymentCount: 0,
      missedPaymentRatio: 0,
      recency: 0,
      loanDistress: 0,
      aiNoteSeverity: 0,
      total: 0,
    };

    return {
      label: "Okay",
      score: 0,
      explanation: "No missed-payment records with notes were found.",
      disclaimer: RISK_DISCLAIMER,
      metrics,
      scoreBreakdown: emptyBreakdown,
      aiAnalysis: {
        status: "skipped_no_notes",
        summary: "No missed-payment notes were available for AI review.",
        overallTone: null,
        severityScore: null,
        confidence: null,
        riskSignals: [],
        mitigatingSignals: [],
        notesAnalyzedCount: 0,
        message: "Gemini review was skipped because there were no missed-payment notes to analyze.",
      },
    };
  }

  const notesForAi = selectNotesForAi(missedPaymentRows);
  const aiAnalysis = await analyzeBorrowerMissedPaymentNotes(notesForAi);
  const scoreBreakdown = buildScoreBreakdown(metrics, aiAnalysis);
  const label = resolveFinalLabel(scoreBreakdown.total);

  return {
    label,
    score: scoreBreakdown.total,
    explanation: buildExplanation(metrics, scoreBreakdown, aiAnalysis),
    disclaimer: RISK_DISCLAIMER,
    metrics: {
      ...metrics,
      mostRecentMissedPaymentDate: metrics.mostRecentMissedPaymentDate,
    },
    scoreBreakdown,
    aiAnalysis,
  };
}
