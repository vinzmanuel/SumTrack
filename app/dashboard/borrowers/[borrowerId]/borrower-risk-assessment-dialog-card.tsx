"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import { formatStoredDateForManila } from "@/app/dashboard/datetime";
import type { BorrowerRiskAssessmentResult, BorrowerRiskLabel } from "@/app/dashboard/borrowers/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

function formatAssessmentScore(value: number) {
  const normalized = Math.max(0, Math.min(100, value));
  return ((100 - normalized) / 10).toFixed(1);
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
      badgeClassName:
        "rounded-md border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
    };
  }

  if (label === "Warning") {
    return {
      badgeClassName:
        "rounded-md border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
    };
  }

  return {
    badgeClassName:
      "rounded-md border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
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
    <div className="rounded-md border border-border/60 bg-muted/15 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function RiskResultContent({ result }: { result: BorrowerRiskAssessmentResult }) {
  const presentation = getLabelPresentation(result.label);
  const assessmentScore = formatAssessmentScore(result.score);
  const aiSummary =
    result.aiAnalysis.status === "success"
      ? result.aiAnalysis.summary
      : result.aiAnalysis.status === "skipped_no_notes"
        ? "No missed-payment notes were available for AI review."
        : "AI note analysis was unavailable, so this result uses rule-based scoring only.";

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border/70 bg-muted/10 p-5">
        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
          <div className="rounded-2xl border border-border/60 bg-background px-5 py-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Assessment Score
            </p>
            <div className="mt-4">
              <Badge className={`${presentation.badgeClassName} px-3 py-1 text-sm`} variant="outline">
                {result.label}
              </Badge>
            </div>
            <div className="mt-4 flex items-end gap-2">
              <span className="text-5xl font-semibold tracking-tight text-foreground">{assessmentScore}</span>
              <span className="pb-1 text-base text-muted-foreground">/ 10</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Higher = Better
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Borrower reapproval assessment</p>
              <p className="max-w-2xl text-base leading-7 text-foreground">{result.explanation}</p>
            </div>

            <div className="max-w-xl space-y-2 rounded-xl border border-border/60 bg-background/85 px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                AI note summary
              </p>
              <p className="text-sm leading-6 text-foreground">{aiSummary}</p>
              {result.aiAnalysis.message ? (
                <p className="text-xs text-amber-700">{result.aiAnalysis.message}</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <Accordion className="rounded-md border border-border/70 bg-background px-4" type="multiple">
        <AccordionItem value="supporting-metrics">
          <AccordionTrigger>Supporting Metrics</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 md:grid-cols-2">
              <MetricItem label="Total Loans" value={String(result.metrics.totalLoans)} />
              <MetricItem label="Collection Entries" value={String(result.metrics.totalCollectionEntries)} />
              <MetricItem label="Normal Payments" value={String(result.metrics.totalNormalPayments)} />
              <MetricItem label="Missed Payments" value={String(result.metrics.totalMissedPayments)} />
              <MetricItem label="Missed-Payment Ratio" value={formatRiskRatio(result.metrics.missedPaymentRatio)} />
              <MetricItem label="Loans With Missed Payments" value={String(result.metrics.loansWithMissedPayments)} />
              <MetricItem
                label="Most Recent Missed Payment"
                value={formatRiskDate(result.metrics.mostRecentMissedPaymentDate)}
              />
              <MetricItem
                label="Missed Payments in Last 30 Days"
                value={String(result.metrics.missedPaymentsLast30Days)}
              />
              <MetricItem
                label="Missed Payments in Last 90 Days"
                value={String(result.metrics.missedPaymentsLast90Days)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="score-breakdown">
          <AccordionTrigger>Score Breakdown</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 md:grid-cols-2">
              <MetricItem
                label="Missed Payment Count Weight"
                value={String(result.scoreBreakdown.missedPaymentCount)}
              />
              <MetricItem
                label="Missed Payment Ratio Weight"
                value={String(result.scoreBreakdown.missedPaymentRatio)}
              />
              <MetricItem label="Recency Weight" value={String(result.scoreBreakdown.recency)} />
              <MetricItem label="Loan Distress Weight" value={String(result.scoreBreakdown.loanDistress)} />
              <MetricItem
                label="AI Note Severity Weight"
                value={String(result.scoreBreakdown.aiNoteSeverity)}
              />
              <MetricItem label="Total Score" value={String(result.scoreBreakdown.total)} />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="current-loan-mix">
          <AccordionTrigger>Current Loan Mix</AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <MetricItem label="Active" value={String(result.metrics.currentLoanMix.active)} />
              <MetricItem label="Overdue" value={String(result.metrics.currentLoanMix.overdue)} />
              <MetricItem label="Completed" value={String(result.metrics.currentLoanMix.completed)} />
              <MetricItem label="Archived" value={String(result.metrics.currentLoanMix.archived)} />
              <MetricItem label="Abandoned" value={String(result.metrics.currentLoanMix.abandoned)} />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ai-note-context">
          <AccordionTrigger>AI Note Sentiment and Context</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <MetricItem label="AI Status" value={getAiStatusLabel(result.aiAnalysis)} />
                <MetricItem label="Notes Analyzed" value={String(result.aiAnalysis.notesAnalyzedCount)} />
                <MetricItem
                  label="Tone"
                  value={result.aiAnalysis.overallTone ? result.aiAnalysis.overallTone.replace("_", " ") : "N/A"}
                />
                <MetricItem label="Confidence" value={result.aiAnalysis.confidence ?? "N/A"} />
                <MetricItem
                  label="Severity Score"
                  value={
                    result.aiAnalysis.severityScore !== null
                      ? `${result.aiAnalysis.severityScore} / 10`
                      : "N/A"
                  }
                />
                <MetricItem label="AI Summary" value={aiSummary} />
              </div>

              {result.aiAnalysis.message ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-900 dark:text-amber-200">
                    AI Status Detail
                  </p>
                  <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{result.aiAnalysis.message}</p>
                </div>
              ) : null}

              {result.aiAnalysis.riskSignals.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Risk signals</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {result.aiAnalysis.riskSignals.map((signal) => (
                      <li
                        key={`${signal.signal}-${signal.evidence}`}
                        className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2"
                      >
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
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Mitigating signals</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {result.aiAnalysis.mitigatingSignals.map((signal) => (
                      <li key={signal} className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2">
                        {signal}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
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
  const inFlightRef = useRef(false);
  const isLoading = state.status === "loading";

  async function runAssessment() {
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
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
    } finally {
      inFlightRef.current = false;
    }
  }

  function handleAssessClick() {
    if (inFlightRef.current) {
      return;
    }

    setOpen(true);
    void runAssessment();
  }

  return (
    <>
      <Card className="rounded-md border-border/70 shadow-sm p-0 gap-0">
        <CardHeader className="space-y-3 border-b border-border/70 bg-muted/20 px-6 pt-6 pb-5">
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
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-muted-foreground">
            Review borrower missed-payment history and note context before making a reapproval decision.
          </p>
          <Button className="h-11 shrink-0 rounded-md" disabled={isLoading} onClick={handleAssessClick} type="button">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isLoading ? "Assessing..." : "Assess Reapproval Risk"}
          </Button>
        </CardContent>
      </Card>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-hidden rounded-md p-0 sm:max-w-3xl">
          <div className="flex max-h-[calc(100vh-2rem)] flex-col">
            <DialogHeader className="border-b px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-600 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <Sparkles className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <DialogTitle>Borrower Reapproval Risk Assessment</DialogTitle>
                  <DialogDescription>
                    AI-assisted missed-payment review for borrower-level reapproval guidance.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="overflow-y-auto px-6 py-5">
              {state.status === "loading" ? (
                <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/10 px-6 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Running assessment...</p>
                    <p className="text-sm text-muted-foreground">
                      We&apos;re reviewing borrower payment history and missed-payment notes now.
                    </p>
                  </div>
                </div>
              ) : null}

              {state.status === "error" ? (
                <div className="space-y-4 rounded-md border border-destructive/30 bg-destructive/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">Assessment failed</p>
                      <p className="text-sm text-muted-foreground">{state.message}</p>
                    </div>
                  </div>

                  <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">
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
            </div>

            <DialogFooter className="border-t px-6 py-4">
              {state.status === "error" ? (
                <Button className="h-11 rounded-md" disabled={isLoading} onClick={() => void runAssessment()} type="button" variant="outline">
                  Try Again
                </Button>
              ) : null}
              {state.status === "success" && state.result ? (
                <Button className="h-11 rounded-md" disabled={isLoading} onClick={() => void runAssessment()} type="button" variant="outline">
                  Re-run Assessment
                </Button>
              ) : null}
              <Button
                className="h-11 rounded-md"
                onClick={() => setOpen(false)}
                type="button"
                variant={state.status === "success" ? "outline" : "default"}
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
