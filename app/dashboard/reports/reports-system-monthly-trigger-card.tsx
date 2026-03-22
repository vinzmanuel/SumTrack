"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SystemMonthlyTriggerResponse =
  | {
      ok: true;
      coverageMonth: string;
      coverageLabel: string;
      dateFrom: string;
      dateTo: string;
      totals: {
        recipients: number;
        created: number;
        duplicates: number;
        skipped: number;
        errors: number;
      };
    }
  | {
      ok?: false;
      message?: string;
    };

function buildTriggerSummary(result: Extract<SystemMonthlyTriggerResponse, { ok: true }>) {
  const parts = [`${result.totals.created} created`];

  if (result.totals.duplicates > 0) {
    parts.push(`${result.totals.duplicates} duplicates skipped`);
  }

  if (result.totals.skipped > 0) {
    parts.push(`${result.totals.skipped} scope/template skips`);
  }

  if (result.totals.errors > 0) {
    parts.push(`${result.totals.errors} errors`);
  }

  return parts.join(", ");
}

export function ReportsSystemMonthlyTriggerCard() {
  const [isPending, setIsPending] = useState(false);
  const [lastRun, setLastRun] = useState<Extract<SystemMonthlyTriggerResponse, { ok: true }> | null>(null);

  const handleTrigger = async () => {
    setIsPending(true);

    try {
      const response = await fetch("/dashboard/reports/system-monthly", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const payload = (await response.json().catch(() => null)) as SystemMonthlyTriggerResponse | null;
      const errorMessage =
        payload && "message" in payload && typeof payload.message === "string"
          ? payload.message
          : "Unable to trigger monthly system-generated reports.";

      if (!response.ok || !payload?.ok) {
        throw new Error(errorMessage);
      }

      setLastRun(payload);

      if (payload.totals.created > 0) {
        toast.success(`Monthly system reports generated for ${payload.coverageLabel}. ${buildTriggerSummary(payload)}.`);
      } else {
        toast.info(`No new monthly system reports were created for ${payload.coverageLabel}. ${buildTriggerSummary(payload)}.`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to trigger monthly system-generated reports.",
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card className="border-dashed border-border/80 bg-muted/10">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Monthly System Report Backfill</CardTitle>
          <Badge className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-indigo-700 hover:bg-indigo-50">
            Admin Only
          </Badge>
        </div>
        <CardDescription>
          Generate the previous completed month of system reports on demand for Admins, Auditors, and Branch Managers. This is the manual PASS 8D trigger path that later automation can reuse.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Uses the dedicated system user, writes recipient metadata for visibility rules, and skips duplicates cleanly.
          </p>
          <Button disabled={isPending} onClick={() => void handleTrigger()} type="button">
            {isPending ? "Generating Monthly Reports..." : "Generate Previous Month System Reports"}
          </Button>
        </div>

        {lastRun ? (
          <div className="rounded-xl border border-border/70 bg-background px-4 py-3 text-sm">
            <p className="font-medium text-foreground">{lastRun.coverageLabel}</p>
            <p className="mt-1 text-muted-foreground">
              Recipients: {lastRun.totals.recipients} | Created: {lastRun.totals.created} | Duplicates:{" "}
              {lastRun.totals.duplicates} | Skipped: {lastRun.totals.skipped} | Errors: {lastRun.totals.errors}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
