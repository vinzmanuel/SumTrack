"use client";

import { useState } from "react";
import { AlertCircle, Loader2, ShieldAlert, ShieldCheck, ShieldQuestion, Sparkles } from "lucide-react";
import { formatStoredDateForManila } from "@/app/dashboard/datetime";
import type { BorrowerRiskAssessmentResult, BorrowerRiskLabel } from "@/app/dashboard/borrowers/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BorrowerRiskAssessmentCardProps = {
  borrowerId: string;
};

type AssessmentState =
  | { status: "idle"; result: null; message: null }
  | { status: "loading"; result: null; message: null }
  | { status: "success"; result: BorrowerRiskAssessmentResult; message: null }
  | { status: "error"; result: null; message: string };

function formatRiskRatio(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatRiskDate(value: string | null) {
  return value ? formatStoredDateForManila(value) : "N/A";
}

function getAiStatusLabel(result: BorrowerRiskAssessmentResult["aiAnalysis"]) {
  if (result.status === "success") {
    return "Available";
  }

  if (result.status === "skipped_no_notes") {
    return "Skipped";
  }

  return "Unavailable";
}

function getLabelPresentation(label: BorrowerRiskLabel) {
  if (label === "Okay") {
    return {
      icon: ShieldCheck,
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
      accentClassName: "text-emerald-700",
    };
  }

  if (label === "Warning") {
    return {
      icon: ShieldQuestion,
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
      accentClassName: "text-amber-700",
    };
  }

  return {
    icon: ShieldAlert,
    badgeClassName: "border-red-200 bg-red-50 text-red-700",
    accentClassName: "text-red-700",
  };
}

function MetricItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function RiskResultContent({ result }: { result: BorrowerRiskAssessmentResult }) {
  const presentation = getLabelPresentation(result.label);
  const Icon = presentation.icon;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className={`rounded-full border border-current/15 bg-background/80 p-2 ${presentation.accentClassName}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <Badge className={presentation.badgeClassName} variant="outline">
              {result.label}
            </Badge>
            <p className="text-sm font-medium text-foreground">Assessment score: {result.score} / 100</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-foreground">{result.explanation}</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Supporting Metrics</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <MetricItem label="Total Loans" value={String(result.metrics.totalLoans)} />
          <MetricItem label="Collection Entries" value={String(result.metrics.totalCollectionEntries)} />
          <MetricItem label="Normal Payments" value={String(result.metrics.totalNormalPayments)} />
          <MetricItem label="Missed Payments" value={String(result.metrics.totalMissedPayments)} />
          <MetricItem label="Missed-Payment Ratio" value={formatRiskRatio(result.metrics.missedPaymentRatio)} />
          <MetricItem label="Loans With Missed Payments" value={String(result.metrics.loansWithMissedPayments)} />
          <MetricItem label="Most Recent Missed Payment" value={formatRiskDate(result.metrics.mostRecentMissedPaymentDate)} />
          <MetricItem label="Missed Payments in Last 30 Days" value={String(result.metrics.missedPaymentsLast30Days)} />
          <MetricItem label="Missed Payments in Last 90 Days" value={String(result.metrics.missedPaymentsLast90Days)} />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Current Loan Mix</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricItem label="Active" value={String(result.metrics.currentLoanMix.active)} />
          <MetricItem label="Overdue" value={String(result.metrics.currentLoanMix.overdue)} />
          <MetricItem label="Completed" value={String(result.metrics.currentLoanMix.completed)} />
          <MetricItem label="Archived" value={String(result.metrics.currentLoanMix.archived)} />
          <MetricItem label="Abandoned" value={String(result.metrics.currentLoanMix.abandoned)} />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Score Breakdown</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <MetricItem label="Missed Payment Count Weight" value={String(result.scoreBreakdown.missedPaymentCount)} />
          <MetricItem label="Missed Payment Ratio Weight" value={String(result.scoreBreakdown.missedPaymentRatio)} />
          <MetricItem label="Recency Weight" value={String(result.scoreBreakdown.recency)} />
          <MetricItem label="Loan Distress Weight" value={String(result.scoreBreakdown.loanDistress)} />
          <MetricItem label="AI Note Severity Weight" value={String(result.scoreBreakdown.aiNoteSeverity)} />
          <MetricItem label="Total Score" value={String(result.scoreBreakdown.total)} />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">AI Note Sentiment and Context</h3>
        <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <MetricItem label="AI Status" value={getAiStatusLabel(result.aiAnalysis)} />
            <MetricItem label="Notes Analyzed" value={String(result.aiAnalysis.notesAnalyzedCount)} />
            <MetricItem label="Tone" value={result.aiAnalysis.overallTone ? result.aiAnalysis.overallTone.replace("_", " ") : "N/A"} />
            <MetricItem label="Confidence" value={result.aiAnalysis.confidence ?? "N/A"} />
            <MetricItem
              label="Severity Score"
              value={
                result.aiAnalysis.severityScore !== null
                  ? `${result.aiAnalysis.severityScore} / 10`
                  : "N/A"
              }
            />
            <MetricItem
              label="AI Summary"
              value={result.aiAnalysis.summary || "AI note analysis was unavailable for this assessment."}
            />
          </div>

          {result.aiAnalysis.message ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-900">
                AI Status Detail
              </p>
              <p className="mt-1 text-sm text-amber-800">{result.aiAnalysis.message}</p>
            </div>
          ) : null}

          {result.aiAnalysis.riskSignals.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="font-medium text-foreground">Risk signals</p>
              <ul className="space-y-2 text-muted-foreground">
                {result.aiAnalysis.riskSignals.map((signal) => (
                  <li key={`${signal.signal}-${signal.evidence}`} className="rounded-lg border border-border/60 bg-background px-3 py-2">
                    <span className="font-medium capitalize text-foreground">
                      {signal.signal.replace(/_/g, " ")}:
                    </span>{" "}
                    {signal.evidence}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.aiAnalysis.mitigatingSignals.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="font-medium text-foreground">Mitigating signals</p>
              <ul className="space-y-2 text-muted-foreground">
                {result.aiAnalysis.mitigatingSignals.map((signal) => (
                  <li key={signal} className="rounded-lg border border-border/60 bg-background px-3 py-2">
                    {signal}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        {result.disclaimer}
      </div>
    </div>
  );
}

export function BorrowerRiskAssessmentCard({ borrowerId }: BorrowerRiskAssessmentCardProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AssessmentState>({
    status: "idle",
    result: null,
    message: null,
  });

  async function runAssessment() {
    setState({ status: "loading", result: null, message: null });

    try {
      const response = await fetch(`/dashboard/borrowers/${borrowerId}/risk-assessment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as
        | BorrowerRiskAssessmentResult
        | { message?: string }
        | null;

      if (!response.ok) {
        setState({
          status: "error",
          result: null,
          message:
            payload && "message" in payload && typeof payload.message === "string"
              ? payload.message
              : "Unable to complete the assessment right now.",
        });
        return;
      }

      setState({
        status: "success",
        result: payload as BorrowerRiskAssessmentResult,
        message: null,
      });
    } catch {
      setState({
        status: "error",
        result: null,
        message: "Unable to complete the assessment right now.",
      });
    }
  }

  function handleAssessClick() {
    setOpen(true);
    void runAssessment();
  }

  return (
    <>
      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="space-y-3 border-b bg-zinc-50/70 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle>AI-Assisted Missed-Payment Risk Assessment</CardTitle>
              <CardDescription>
                Advisory only. This does not replace staff judgment.
              </CardDescription>
            </div>
            <Sparkles className="mt-0.5 h-5 w-5 text-emerald-600" />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-muted-foreground">
            Review borrower missed-payment history and note context before making a reapproval decision.
          </p>
          <Button className="shrink-0" onClick={handleAssessClick} type="button">
            Assess Reapproval Risk
          </Button>
        </CardContent>
      </Card>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Borrower Reapproval Risk Assessment</DialogTitle>
            <DialogDescription>
              AI-assisted missed-payment review for borrower-level reapproval guidance.
            </DialogDescription>
          </DialogHeader>

          {state.status === "loading" ? (
            <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/10 px-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">Running assessment...</p>
                <p className="text-sm text-muted-foreground">
                  We’re reviewing borrower payment history and missed-payment notes now.
                </p>
              </div>
            </div>
          ) : null}

          {state.status === "error" ? (
            <div className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" />
                <div className="space-y-1">
                  <p className="font-medium text-red-900">Assessment failed</p>
                  <p className="text-sm text-red-800">{state.message}</p>
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                AI-assisted risk analysis only. This is not the final approval decision and should be reviewed alongside borrower payment history and staff judgment.
              </div>
            </div>
          ) : null}

          {state.status === "success" && state.result ? <RiskResultContent result={state.result} /> : null}

          {state.status === "idle" ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-6 text-sm text-muted-foreground">
              Start the assessment to review missed-payment note context and borrower-level risk signals.
            </div>
          ) : null}

          <DialogFooter>
            {state.status === "error" ? (
              <Button onClick={() => void runAssessment()} type="button" variant="outline">
                Try Again
              </Button>
            ) : null}
            {state.status === "success" && state.result ? (
              <Button onClick={() => void runAssessment()} type="button" variant="outline">
                Re-run Assessment
              </Button>
            ) : null}
            <Button onClick={() => setOpen(false)} type="button" variant={state.status === "success" ? "outline" : "default"}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
