import Link from "next/link";
import type { ReactNode } from "react";
import { Calculator, CircleAlert, Clock3, History, Settings2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardBackLink } from "@/app/dashboard/_components/dashboard-back-link";
import { appendBackNavigationToHref, buildReturnTo } from "@/app/dashboard/back-navigation";
import { ExportPrintTools } from "@/app/dashboard/incentives/export-print-tools";
import { FinalizePayoutForm } from "@/app/dashboard/incentives/finalize-payout-form";
import { IncentivesFilters } from "@/app/dashboard/incentives/incentives-filters";
import {
  IncentivesWorkspaceTransitionProvider,
  IncentivesWorkspaceTransitionSurface,
} from "@/app/dashboard/incentives/incentives-workspace-transition";
import { resolveIncentivesPageAccess, parseIncentivesFilters } from "@/app/dashboard/incentives/access";
import { loadIncentivesViewState } from "@/app/dashboard/incentives/loader";
import { IncentivesPayoutTable, IncentivesSummaryStrip } from "@/app/dashboard/incentives/payout-region";
import type { IncentivesPageProps } from "@/app/dashboard/incentives/types";

function renderCenteredCard(props: { title: string; message: string; href: string; actionLabel: string }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{props.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{props.message}</p>
          <DashboardBackLink href={props.href} label={props.actionLabel} />
        </CardContent>
      </Card>
    </main>
  );
}

function renderBranchError(message: string) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Incentive Payouts</CardTitle>
          <CardDescription>Payout finalization and history</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-amber-700 dark:text-amber-400">{message}</p>
          <DashboardBackLink href="/dashboard" label="Back to dashboard" />
        </CardContent>
      </Card>
    </main>
  );
}

export default async function IncentivesPage({ searchParams }: IncentivesPageProps) {
  const filters = parseIncentivesFilters((await searchParams) ?? {});
  const access = await resolveIncentivesPageAccess(filters);

  if (access.view === "unauthenticated") {
    return renderCenteredCard({
      title: "Incentives",
      message: access.message,
      href: "/login",
      actionLabel: "Go to login",
    });
  }

  if (access.view === "forbidden") {
    return renderCenteredCard({
      title: "Incentives",
      message: access.message,
      href: "/dashboard",
      actionLabel: "Back to dashboard",
    });
  }

  if (access.view === "branch_error") {
    return renderBranchError(access.message);
  }

  const viewState = await loadIncentivesViewState(access);
  const currentReturnTo = buildReturnTo(
    "/dashboard/incentives",
    new URLSearchParams({
      ...(access.selectedBranchRaw ? { branch: access.selectedBranchRaw } : {}),
      ...(access.selectedMonthRaw ? { month: access.selectedMonthRaw } : {}),
    }),
  );

  const activeScopeLabel = access.allAssignedBranchesMode
    ? "All assigned branches"
    : access.resolvedBranchName ?? access.fixedBranchName ?? "No branch selected";
  const periodLabel = viewState.kind === "ready" ? viewState.periodLabel : access.payPeriod?.label ?? "Invalid period";
  const collectorAverageLabel = access.allAssignedBranchesMode
    ? "Average collector basis across the branches included in this payout view."
    : "Average collector basis for the selected branch and month.";
  const requiresScopedBranchSelection = (access.isAdmin || access.isAuditor) && access.selectedBranchRaw === "all";
  const showWorkspace = viewState.kind === "ready" && !requiresScopedBranchSelection;

  let summaryAlert: ReactNode = null;

  if (viewState.kind === "invalid_period") {
    summaryAlert = (
      <Alert className="border-0 bg-transparent p-0 shadow-none">
        <CircleAlert className="size-4" />
        <AlertTitle>Invalid month filter</AlertTitle>
        <AlertDescription>Please choose a valid month to load incentives.</AlertDescription>
      </Alert>
    );
  } else if (viewState.kind === "branch_required") {
    summaryAlert = (
      <Alert className="border-0 bg-transparent p-0 shadow-none">
        <CircleAlert className="size-4" />
        <AlertTitle>Select a branch first</AlertTitle>
        <AlertDescription>
          Admin users must pick a branch before the incentive workspace can load any payout rows.
        </AlertDescription>
      </Alert>
    );
  } else if (viewState.isFinalized) {
    summaryAlert = (
      <Alert className="border-0 bg-transparent p-0 shadow-none">
        <History className="size-4" />
        <AlertTitle>Historical payout batch</AlertTitle>
        <AlertDescription>
          This period has already been finalized. The values shown below come from saved payout history and no longer
          recalculate from live collections.
        </AlertDescription>
      </Alert>
    );
  } else if (access.isAuditor && access.allAssignedBranchesMode) {
    summaryAlert = (
      <Alert className="border-0 bg-transparent p-0 shadow-none">
        <History className="size-4" />
        <AlertTitle>Combined auditor view</AlertTitle>
        <AlertDescription>
          This summary combines all assigned branches. Totals shown below are cross-branch aggregates, not one
          branch&apos;s finalized payout batch.
        </AlertDescription>
      </Alert>
    );
  } else if (access.isAuditor) {
    summaryAlert = (
      <Alert className="border-0 bg-transparent p-0 shadow-none">
        <History className="size-4" />
        <AlertTitle>Auditor access</AlertTitle>
        <AlertDescription>
          You can inspect live or historical incentive data here, but payout finalization remains disabled.
        </AlertDescription>
      </Alert>
    );
  } else if (viewState.canFinalize) {
    summaryAlert = (
      <Alert className="border-0 bg-transparent p-0 shadow-none">
        <Clock3 className="size-4" />
        <AlertTitle>Ready for payout finalization</AlertTitle>
        <AlertDescription>
          Review the payout table above, then finalize once you&apos;ve verified the current month&apos;s output.
        </AlertDescription>
      </Alert>
    );
  } else {
    summaryAlert = (
      <Alert className="border-0 bg-transparent p-0 shadow-none">
        <Clock3 className="size-4" />
        <AlertTitle>Live payout computation</AlertTitle>
        <AlertDescription>
          {viewState.finalizeLockReason ||
            "This view updates from current collections and applicable rules. Finalization stays locked until the cutoff is reached."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <IncentivesWorkspaceTransitionProvider>
      <div className="w-full max-w-none space-y-5 pb-6 pt-1 sm:pb-6 sm:pt-2">
        <Card className="gap-0 overflow-hidden py-0">
          <div className="bg-linear-to-r from-slate-50 via-background to-emerald-50/50 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="max-w-2xl space-y-1">
                <div className="space-y-1">
                  <CardTitle className="text-3xl font-semibold tracking-tight">Incentive Payouts</CardTitle>
                  <CardDescription>
                    Review branch incentives for the selected payout month with one clean payout table and finalized
                    totals.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Badge className="rounded-full border border-border/70 bg-background px-3 py-1 text-foreground hover:bg-background" variant="outline">
                    {activeScopeLabel}
                  </Badge>
                  <Badge className="rounded-full border border-border/70 bg-background px-3 py-1 text-foreground hover:bg-background" variant="outline">
                    {periodLabel}
                  </Badge>
                </div>
              </div>

              {!access.isAuditor ? (
                <Button asChild className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white">
                  <Link
                    href={appendBackNavigationToHref("/dashboard/incentives/rules", {
                      source: "incentives",
                      returnTo: currentReturnTo,
                    })}
                  >
                    <Settings2 data-icon="inline-start" />
                    Manage Rules
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
          <CardContent className="border-t border-border/70 px-6 pb-4 pt-3">
            <IncentivesFilters
              allBranchLabel={access.isAuditor ? "All assigned branches" : "All branches"}
              branches={access.filterBranches}
              canChooseBranch={access.isAdmin || access.isAuditor}
              clearHref="/dashboard/incentives"
              compact
              fixedBranchName={access.fixedBranchName}
              key={`${access.selectedBranchRaw}-${access.selectedMonthRaw}`}
              selectedBranchRaw={access.selectedBranchRaw}
              selectedMonthRaw={access.selectedMonthRaw}
            />
          </CardContent>
        </Card>

        <IncentivesWorkspaceTransitionSurface>
          <Card className="overflow-hidden py-0">
            <CardContent className="flex flex-col gap-6 py-6">
              <div className="flex items-center gap-3">
                <div className="text-rose-500">
                  <Calculator className="size-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">Monthly Incentive Calculator</h2>
                </div>
              </div>

              {showWorkspace ? (
                <>
                  <IncentivesSummaryStrip
                    branchCollectorAverage={viewState.branchCollectorAverage}
                    collectorAverageLabel={collectorAverageLabel}
                    totalComputedIncentive={viewState.totalComputedIncentive}
                    totalEmployees={viewState.totalEmployees}
                  />

                  <IncentivesPayoutTable
                    branchManagerRows={viewState.branchManagerRows}
                    branchManagerRuleMissing={!viewState.isFinalized && viewState.branchManagerRuleMissing}
                    collectorRows={viewState.collectorRows}
                    collectorRuleMissing={!viewState.isFinalized && viewState.collectorRuleMissing}
                    secretaryRows={viewState.secretaryRows}
                    secretaryRuleMissing={!viewState.isFinalized && viewState.secretaryRuleMissing}
                    showBranchColumn={access.allAssignedBranchesMode}
                  />
                </>
              ) : (
                <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-14 text-center">
                  <p className="text-base font-semibold text-foreground">
                    {requiresScopedBranchSelection ? "Please select a branch and month first." : "Incentives workspace unavailable."}
                  </p>
                  <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
                    {requiresScopedBranchSelection
                      ? "Choose a specific branch and payout month from the controls above to load the monthly incentive workspace."
                      : "Adjust the current filters above to load the monthly incentive workspace."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </IncentivesWorkspaceTransitionSurface>

        <Card className="overflow-hidden py-0">
          <CardContent className="py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-2xl">{summaryAlert}</div>

              {showWorkspace ? (
                <div className="flex flex-wrap items-center gap-2 xl:min-w-105 xl:justify-end">
                  <ExportPrintTools
                    fileName={viewState.exportFileName}
                    modeLabel={viewState.modeLabel}
                    rows={viewState.exportRows}
                  />

                  {!viewState.batchMeta && !access.isAuditor ? (
                    <FinalizePayoutForm
                      branchId={access.resolvedBranchId ?? 0}
                      inline
                      canFinalize={viewState.canFinalize}
                      lockReason={viewState.finalizeLockReason}
                      month={access.selectedMonthRaw}
                      showLockAlert={false}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </IncentivesWorkspaceTransitionProvider>
  );
}
