import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BorrowerCollectorContactPanel } from "@/app/dashboard/_components/borrower-collector-contact-panel";
import { DashboardAnalyticsCard } from "@/app/dashboard/_components/dashboard-analytics-card";
import { DashboardOverviewFilters } from "@/app/dashboard/_components/dashboard-overview-filters-v2";
import { DashboardOverviewHeaderConfig } from "@/app/dashboard/_components/dashboard-overview-header-config";
import { DashboardSecondaryChartCard } from "@/app/dashboard/_components/dashboard-secondary-chart-card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import { DashboardMetricGrid } from "@/app/dashboard/_components/dashboard-tremor";
import { loadDashboardChartData } from "@/app/dashboard/dashboard-chart-queries";
import { parseDashboardChartFilters, resolveDashboardChartDateRange } from "@/app/dashboard/dashboard-chart-filters";
import { resolveDashboardOverviewState } from "@/app/dashboard/overview-access";
import { buildDashboardOverviewCardsForPeriod } from "@/app/dashboard/overview-cards";
import { loadDashboardOverviewData } from "@/app/dashboard/overview-queries";
import type { DashboardChartPageProps } from "@/app/dashboard/dashboard-chart-types";
import {
  UI_PAGE_STACK_CLASS_NAME,
  UI_SURFACE_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";

function resolvePhilippineDayPart() {
  const hourText = new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone: "Asia/Manila",
  }).format(new Date());
  const hour = Number(hourText);

  if (Number.isNaN(hour)) {
    return "Morning";
  }

  if (hour < 12) {
    return "Morning";
  }

  if (hour < 18) {
    return "Afternoon";
  }

  return "Evening";
}

function resolveFirstName(firstName: string) {
  const trimmed = firstName.trim();
  if (!trimmed) {
    return "there";
  }

  return trimmed;
}

function resolveRoleGreetingMessage(roleName: string) {
  if (roleName === "Admin") {
    return "Manage users, branches, loans, collections, expenses, incentives, and reports across the full organization scope.";
  }

  if (roleName === "Auditor") {
    return "Review assigned-branch activity, audit operational and financial records, and monitor compliance, reports, and payout history.";
  }

  if (roleName === "Branch Manager") {
    return "Oversee branch staff, manage borrower and loan workflows, and monitor collections, expenses, and daily branch performance.";
  }

  if (roleName === "Secretary") {
    return "Maintain borrower and loan records, encode day-to-day transactions, and support branch operations and reporting workflows.";
  }

  if (roleName === "Collector") {
    return "Track assigned accounts, record collections in the field, monitor collection performance, and follow up on due borrowers.";
  }

  if (roleName === "Borrower") {
    return "View your loan details, payment history, remaining balance, and due timeline in one place.";
  }

  return "Your dashboard overview is ready.";
}

export default async function DashboardPage({ searchParams }: DashboardChartPageProps) {
  const parsedParams = (await searchParams) ?? {};
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const chartFilters = parseDashboardChartFilters(parsedParams);
  const chartDateRange = resolveDashboardChartDateRange(chartFilters);
  const baseOverviewState = resolveDashboardOverviewState(auth);
  const selectedBranchId = /^\d+$/.test(chartFilters.selectedBranchRaw)
    ? Number(chartFilters.selectedBranchRaw)
    : null;
  const canScopeToSelectedBranch =
    selectedBranchId !== null &&
    (auth.roleName === "Admin" ||
      (auth.roleName === "Auditor" && auth.assignedBranchIds.includes(selectedBranchId)));
  const overviewState =
    canScopeToSelectedBranch && selectedBranchId !== null
      ? {
          ...baseOverviewState,
          scope: { kind: "branches" as const, branchIds: [selectedBranchId] },
        }
      : baseOverviewState;
  const [overviewData, dashboardChartData] = await Promise.all([
    loadDashboardOverviewData(overviewState, {
      start: chartDateRange.start,
      end: chartDateRange.end,
    }),
    loadDashboardChartData(baseOverviewState, parsedParams),
  ]);

  const cards = buildDashboardOverviewCardsForPeriod(overviewData, chartDateRange.label);
  const centralFilterBranchOptions = dashboardChartData?.branchOptions ?? [];
  const dayPart = resolvePhilippineDayPart();
  const firstName = resolveFirstName(auth.firstName);
  const greetingMessage = resolveRoleGreetingMessage(auth.roleName);
  const isAdminOrAuditor = auth.roleName === "Admin" || auth.roleName === "Auditor";
  const useManagementGreetingLayout =
    isAdminOrAuditor ||
    auth.roleName === "Branch Manager" ||
    auth.roleName === "Secretary" ||
    auth.roleName === "Collector";

  return (
    <div className={`relative w-full max-w-none pb-6 pt-0 sm:pb-6 sm:pt-0 ${UI_PAGE_STACK_CLASS_NAME}`}>
      <DashboardOverviewHeaderConfig />

      {useManagementGreetingLayout ? (
        <section className="grid gap-4">
          <section className={`${UI_SURFACE_CLASS_NAME} px-5 py-5 sm:px-6 sm:py-6`}>
            <div className="grid gap-5 lg:grid-cols-6 lg:items-center">
              <div className="space-y-3 lg:col-start-1 lg:col-end-5">
                <p className="text-3xl font-semibold tracking-tight sm:text-5xl">
                  <span className="text-foreground/80">Good {dayPart}, </span>
                  <span className="text-[#e73c31]">{firstName}!</span>
                </p>
                <p className="max-w-4xl text-base text-foreground/80 sm:text-lg">{greetingMessage}</p>
              </div>
              {dashboardChartData ? (
                <div className="w-full lg:col-start-5 lg:col-end-7 lg:flex lg:justify-center">
                  <div className="w-full lg:max-w-[420px]">
                    <DashboardOverviewFilters
                      key={`dashboard-filters-${dashboardChartData.filters.selectedBranchRaw}-${dashboardChartData.filters.selectedRange}-${dashboardChartData.filters.fromRaw}-${dashboardChartData.filters.toRaw}`}
                      branchFilterLabel={dashboardChartData.branchFilterLabel}
                      branchOptions={centralFilterBranchOptions}
                      canChooseBranch={dashboardChartData.canChooseBranch}
                      initialFilters={{
                        branch: dashboardChartData.filters.selectedBranchRaw,
                        range: dashboardChartData.filters.selectedRange,
                        from: dashboardChartData.filters.fromRaw,
                        to: dashboardChartData.filters.toRaw,
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <DashboardMetricGrid className="grid-cols-1 md:grid-cols-2 xl:grid-cols-3" items={cards} />
          </section>
        </section>
      ) : (
        <>
          <section
            className={`${UI_SURFACE_CLASS_NAME} relative h-full overflow-hidden px-5 py-5 sm:px-6 sm:py-6`}
          >
            <div className="relative z-10 flex h-full flex-col">
              <div className="space-y-3">
              <p className="text-3xl font-semibold tracking-tight sm:text-5xl">
                <span className="text-foreground/80">Good {dayPart}, </span>
                <span className="text-[#e73c31]">{firstName}!</span>
              </p>
                <p className="max-w-4xl text-base text-muted-foreground sm:text-lg">{greetingMessage}</p>
              </div>
              {dashboardChartData ? (
                <div className="mt-auto pt-6">
                  <DashboardOverviewFilters
                    key={`dashboard-filters-${dashboardChartData.filters.selectedBranchRaw}-${dashboardChartData.filters.selectedRange}-${dashboardChartData.filters.fromRaw}-${dashboardChartData.filters.toRaw}`}
                    branchFilterLabel={dashboardChartData.branchFilterLabel}
                    branchOptions={centralFilterBranchOptions}
                    canChooseBranch={dashboardChartData.canChooseBranch}
                    initialFilters={{
                      branch: dashboardChartData.filters.selectedBranchRaw,
                      range: dashboardChartData.filters.selectedRange,
                      from: dashboardChartData.filters.fromRaw,
                      to: dashboardChartData.filters.toRaw,
                    }}
                  />
                </div>
              ) : null}
            </div>
          </section>

          <section className="grid gap-4">
            <DashboardMetricGrid
              className={auth.roleName === "Borrower" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : undefined}
              items={cards}
            />
          </section>
        </>
      )}

      {overviewData.variant === "management" ? (
        overviewData.widgets.branchRankChart ? (
          isAdminOrAuditor ? (
            <section className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-2">
                <DashboardSecondaryChartCard widget={overviewData.widgets.branchRankChart} />
              </div>
              <div className="lg:col-span-3">
                {dashboardChartData ? <DashboardAnalyticsCard data={dashboardChartData} /> : null}
              </div>
            </section>
          ) : (
            <section className="grid gap-4">
              {dashboardChartData ? <DashboardAnalyticsCard data={dashboardChartData} /> : null}
            </section>
          )
        ) : (
          <section className="grid gap-4">
            {dashboardChartData ? <DashboardAnalyticsCard data={dashboardChartData} /> : null}
          </section>
        )
      ) : null}

      {overviewData.variant === "borrower" ? (
        <section className="grid gap-4 xl:max-w-sm">
          <BorrowerCollectorContactPanel borrower={overviewData.borrower} />
        </section>
      ) : null}

      {!isAdminOrAuditor && overviewData.variant !== "management" ? (
        <section className="grid gap-4">
          {dashboardChartData ? <DashboardAnalyticsCard data={dashboardChartData} /> : null}
        </section>
      ) : null}
    </div>
  );
}
