import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { CollectorBreakdownCard } from "@/app/dashboard/collectors/collector-breakdown-card";
import { CollectorKpiCard } from "@/app/dashboard/collectors/collector-kpi-card";
import { CollectorProfilePanel } from "@/app/dashboard/collectors/collector-profile-panel";
import { CollectorRankContextCard } from "@/app/dashboard/collectors/collector-rank-context-card";
import { COLLECTORS_DATE_RANGE_OPTIONS, supportsAverageMonthlyCollections } from "@/app/dashboard/collectors/filters";
import {
  formatCollectorsCurrency,
  formatCollectorsInteger,
  formatCollectorsNullablePercent,
  formatCollectorsPercent,
} from "@/app/dashboard/collectors/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  CollectorLeaderboardBasis,
  CollectorPerformanceRow,
  CollectorProfileData,
  CollectorsFilterInput,
} from "@/app/dashboard/collectors/types";

const BASIS_OPTIONS: Array<{ value: CollectorLeaderboardBasis; label: string }> = [
  { value: "total-collected", label: "Total Collections" },
  { value: "average-monthly-collections", label: "Average Monthly Collections" },
];

export function CollectorsIndividualMode({
  collector,
  dateRangeLabel,
  errorMessage,
  focusedProfileData,
  profileHref,
  selectedBasis,
  selectedRange,
  onBasisChange,
  onRangeChange,
}: {
  collector: CollectorPerformanceRow;
  dateRangeLabel: string;
  errorMessage: string | null;
  focusedProfileData: CollectorProfileData | null;
  profileHref: string;
  selectedBasis: CollectorLeaderboardBasis;
  selectedRange: CollectorsFilterInput["range"];
  onBasisChange: (basis: CollectorLeaderboardBasis) => void;
  onRangeChange: (value: { range: CollectorsFilterInput["range"]; from: string; to: string }) => void;
}) {
  const recoveryVsExpected = collector.expectedCollections > 0
    ? Math.min((collector.totalCollected / collector.expectedCollections) * 100, 100)
    : 0;
  const canUseAverageMonthly = supportsAverageMonthlyCollections(selectedRange);

  return (
    <div className="space-y-6">
      <TremorCard className="p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Focused Collector Summary
            </p>
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold tracking-tight text-foreground">{collector.fullName}</h3>
              <TremorDescription>{`${collector.branchName} / ${collector.areaLabel}`}</TremorDescription>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              Only one collector matches the current filters, so this view stays in summary mode and
              highlights the strongest KPI signals for {dateRangeLabel}.
            </p>
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[520px]">
            <div className="flex justify-start xl:justify-end">
              <Link href={profileHref}>
                <Button type="button">View Profile</Button>
              </Link>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
              <label className="flex w-full flex-col gap-1 sm:w-[220px]">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      aria-label="Period help"
                      className="inline-flex w-fit items-center gap-1 text-left text-sm font-medium text-foreground"
                      type="button"
                    >
                      <Label className="cursor-help">Period</Label>
                      <CircleHelp className="size-3.5 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-104" side="top">
                    <p>The selected period only changes who ranks number 1 in this leaderboard.</p>
                    <p className="mt-2">
                      The time-based columns to focus on for a selected period are:
                      <br />
                      - Total Collected
                      <br />
                      - Missed Rate
                      <br />
                      - Actual vs Expected Collected
                    </p>
                  </TooltipContent>
                </Tooltip>
                <Select
                  onValueChange={(value) =>
                    onRangeChange({
                      range: value as CollectorsFilterInput["range"],
                      from: "",
                      to: "",
                    })
                  }
                  value={selectedRange}
                >
                  <SelectTrigger className="w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLLECTORS_DATE_RANGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="flex w-full flex-col gap-1 sm:w-[240px]">
                <Label>Ranking Basis</Label>
                <Select onValueChange={(value) => onBasisChange(value as CollectorLeaderboardBasis)} value={selectedBasis}>
                  <SelectTrigger className="w-full bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BASIS_OPTIONS.map((option) => (
                      <SelectItem
                        disabled={option.value === "average-monthly-collections" && !canUseAverageMonthly}
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
          </div>
        </div>
      </TremorCard>

      {focusedProfileData ? (
        <CollectorProfilePanel
          data={focusedProfileData}
          showSectionIntros={false}
          visibleSections={{
            selectedPeriod: true,
            currentPortfolio: false,
            lifetime: false,
          }}
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <CollectorKpiCard
              accentClassName="bg-sky-500"
              barPercent={collector.collectionDays > 0 ? Math.min((collector.productivityCount / collector.collectionDays) * 12, 100) : 8}
              help="Productivity is based on collection transactions recorded in the current filter range."
              subtitle="Current filter-range activity volume."
              title="Productivity"
              value={`${formatCollectorsInteger(collector.productivityCount)} transactions`}
            />
            <CollectorKpiCard
              accentClassName="bg-emerald-500"
              barPercent={collector.efficiencyRatio ?? 0}
              help="Efficiency compares collected cash against the estimated amount due in the current filter range."
              subtitle="Collected vs expected cash."
              title="Efficiency"
              value={formatCollectorsNullablePercent(collector.efficiencyRatio, "No scheduled due")}
            />
            <CollectorKpiCard
              accentClassName="bg-violet-500"
              barPercent={collector.averageMonthlyCollections > 0 ? Math.min((collector.averageMonthlyCollections / Math.max(collector.totalCollected, 1)) * 100 * 4, 100) : 8}
              help="Average Monthly Collections is also the current ranking basis."
              subtitle="Current ranking basis."
              title="Avg Monthly Collections"
              value={formatCollectorsCurrency(collector.averageMonthlyCollections)}
            />
            <CollectorKpiCard
              accentClassName="bg-rose-500"
              barPercent={collector.portfolioAtRiskRate ?? 0}
              help="Portfolio at Risk shows the overdue share of the collector's live principal load."
              subtitle="Overdue share of live principal."
              title="Portfolio at Risk"
              value={formatCollectorsNullablePercent(collector.portfolioAtRiskRate, "No live portfolio")}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-12">
            <div className="space-y-6 xl:col-span-5">
              <CollectorRankContextCard
                branchCollectorCount={collector.branchCollectorCount}
                branchName={collector.branchName}
                branchRank={collector.branchRank}
                nationwideRank={collector.nationwideRank}
                visibleCollectorCount={collector.visibleCollectorCount}
              />

              <CollectorBreakdownCard
                description="Quick workload and risk picture without leaving the collectors overview."
                help="This summary keeps the collectors page in oversight mode while still showing the matched collector's key context."
                items={[
                  {
                    label: "Assigned Active Loans",
                    percent: collector.assignedActiveLoans > 0 ? Math.min(collector.assignedActiveLoans * 12, 100) : 8,
                    toneClassName: "bg-cyan-500",
                    value: formatCollectorsInteger(collector.assignedActiveLoans),
                  },
                  {
                    label: "Active Principal Load",
                    percent: 100,
                    toneClassName: "bg-slate-500",
                    value: formatCollectorsCurrency(collector.activePrincipalLoad),
                  },
                  {
                    label: "Missed-Payment Rate",
                    percent: 100 - Math.min(collector.missedPaymentRate, 100),
                    toneClassName: "bg-orange-500",
                    value: formatCollectorsPercent(collector.missedPaymentRate),
                  },
                ]}
                title="Quick Context"
              />
            </div>

            <CollectorBreakdownCard
              className="xl:col-span-7"
              description="Fast read of cash output inside the current filter set."
              help="These bars compare what came in against what was expected, plus the collector's monthly pace and recovery strength."
              items={[
                {
                  label: "Total Collected",
                  percent: recoveryVsExpected || 8,
                  toneClassName: "bg-emerald-500",
                  value: formatCollectorsCurrency(collector.totalCollected),
                },
                {
                  label: "Expected Collections",
                  percent: collector.expectedCollections > 0 ? 100 : 8,
                  toneClassName: "bg-sky-500",
                  value: formatCollectorsCurrency(collector.expectedCollections),
                },
                {
                  label: "Average Monthly Collections",
                  percent: collector.averageMonthlyCollections > 0 ? Math.min((collector.averageMonthlyCollections / Math.max(collector.totalCollected, 1)) * 100 * 4, 100) : 8,
                  toneClassName: "bg-indigo-500",
                  value: formatCollectorsCurrency(collector.averageMonthlyCollections),
                },
                {
                  label: "Portfolio Recovery Rate",
                  percent: collector.portfolioRecoveryRate,
                  toneClassName: "bg-teal-500",
                  value: formatCollectorsPercent(collector.portfolioRecoveryRate),
                },
              ]}
              title="Current Filter Snapshot"
            />
          </div>
        </>
      )}
    </div>
  );
}
