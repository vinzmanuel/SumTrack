import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportPrintTools } from "@/app/dashboard/incentives/export-print-tools";
import { FinalizePayoutForm } from "@/app/dashboard/incentives/finalize-payout-form";
import { IncentivesFilters } from "@/app/dashboard/incentives/incentives-filters";
import { resolveIncentivesPageAccess, parseIncentivesFilters } from "@/app/dashboard/incentives/access";
import { loadIncentivesViewState } from "@/app/dashboard/incentives/loader";
import { IncentivesSection, IncentivesSummaryCards } from "@/app/dashboard/incentives/sections";
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
          <Link className="text-sm underline" href={props.href}>
            {props.actionLabel}
          </Link>
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
          <Link className="text-sm underline" href="/dashboard">
            Back to dashboard
          </Link>
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Incentive Payouts</CardTitle>
          <CardDescription>
            Monthly payout computation, finalization, and history viewing.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/dashboard">
            <Button type="button" variant="outline">
              Back to dashboard
            </Button>
          </Link>
          {!access.isAuditor ? (
            <Link href="/dashboard/incentives/rules">
              <Button type="button" variant="secondary">
                Manage Rules
              </Button>
            </Link>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          {access.isAdmin || access.isAuditor ? (
            <IncentivesFilters
              allBranchLabel={access.isAuditor ? "Select assigned branch" : "Select branch"}
              branches={access.filterBranches}
              canChooseBranch
              clearHref="/dashboard/incentives"
              selectedBranchRaw={access.selectedBranchRaw}
              selectedMonthRaw={access.selectedMonthRaw}
            />
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="fixed_branch">
                  Branch
                </label>
                <input
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
                  id="fixed_branch"
                  readOnly
                  value={access.fixedBranchName ?? "N/A"}
                />
              </div>
              <IncentivesFilters
                allBranchLabel="Select branch"
                branches={[]}
                canChooseBranch={false}
                clearHref="/dashboard/incentives"
                selectedBranchRaw={access.selectedBranchRaw}
                selectedMonthRaw={access.selectedMonthRaw}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {viewState.kind === "invalid_period" ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Invalid month filter. Please choose a valid month.
            </p>
          </CardContent>
        </Card>
      ) : viewState.kind === "branch_required" ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">Select a branch to view incentive payouts.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{viewState.isFinalized ? "Historical View" : "Live Computation"}</CardTitle>
              <CardDescription>
                {viewState.isFinalized
                  ? "This month has already been finalized. The values shown here are locked payout records."
                  : "This view is based on current records and may still change until the month is finalized."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <span className="font-medium">Branch:</span>{" "}
                {access.allAssignedBranchesMode ? "All assigned branches" : access.resolvedBranchName ?? "N/A"}
              </p>
              <p>
                <span className="font-medium">Period:</span> {viewState.periodLabel}
              </p>
              <p>
                <span className="font-medium">Period Start:</span> {viewState.periodStart}
              </p>
              <p>
                <span className="font-medium">Period End:</span> {viewState.periodEnd}
              </p>
              {viewState.batchMeta || access.isAuditor ? (
                <>
                  {viewState.batchMeta ? (
                    <>
                      <p>
                        <span className="font-medium">Finalized By:</span> {viewState.finalizedByText ?? "N/A"}
                      </p>
                      <p>
                        <span className="font-medium">Finalized At:</span> {viewState.batchMeta.finalizedAt}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm">Auditor access is read-only.</p>
                  )}
                </>
              ) : (
                <FinalizePayoutForm
                  branchId={access.resolvedBranchId ?? 0}
                  canFinalize={viewState.canFinalize}
                  lockReason={viewState.finalizeLockReason}
                  month={access.selectedMonthRaw}
                />
              )}

              <ExportPrintTools
                fileName={viewState.exportFileName}
                modeLabel={viewState.modeLabel}
                rows={viewState.exportRows}
              />
            </CardContent>
          </Card>

          <IncentivesSummaryCards
            branchCollectorAverage={viewState.branchCollectorAverage}
            isFinalized={viewState.isFinalized}
            totalComputedIncentive={viewState.totalComputedIncentive}
            totalEmployees={viewState.totalEmployees}
          />

          <IncentivesSection
            description="Collector incentive = (collector month total * percent / 100) + flat amount"
            rows={viewState.collectorRows}
            ruleMissing={!viewState.isFinalized && viewState.collectorRuleMissing}
            title="Collectors"
          />

          <IncentivesSection
            description="Secretary incentive = (branch collector average * percent / 100) + flat amount"
            rows={viewState.secretaryRows}
            ruleMissing={!viewState.isFinalized && viewState.secretaryRuleMissing}
            title="Secretaries"
          />

          <IncentivesSection
            description="Branch Manager incentive = (branch collector average * percent / 100) + flat amount"
            rows={viewState.branchManagerRows}
            ruleMissing={!viewState.isFinalized && viewState.branchManagerRuleMissing}
            title="Branch Managers"
          />
        </>
      )}
    </div>
  );
}
