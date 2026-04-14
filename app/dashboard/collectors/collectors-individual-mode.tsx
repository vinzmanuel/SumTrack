import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { UI_CONTROL_CLASS_NAME } from "@/app/dashboard/_components/ui-patterns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CollectorsPeriodFilter } from "@/app/dashboard/collectors/collectors-period-filter";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { CollectorProfilePanel } from "@/app/dashboard/collectors/collector-profile-panel";
import {
  supportsAverageMonthlyCollectionsSelection,
  supportsIncentivesSelection,
} from "@/app/dashboard/collectors/filters";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  CollectorLeaderboardBasis,
  CollectorPerformanceRow,
  CollectorProfilePeriodAvailability,
  CollectorProfileData,
  CollectorsFilterInput,
} from "@/app/dashboard/collectors/types";

const BASIS_OPTIONS: Array<{ value: CollectorLeaderboardBasis; label: string }> = [
  { value: "total-collected", label: "Total Collections" },
  { value: "average-monthly-collections", label: "Average Monthly Collections" },
  { value: "incentives", label: "Incentives" },
];

export function CollectorsIndividualMode({
  collector,
  dateRangeLabel,
  errorMessage,
  focusedProfileData,
  periodAvailability,
  profileHref,
  selectedBasis,
  selectedFrom,
  selectedRange,
  selectedTo,
  viewerRoleName,
  onBasisChange,
  onRangeChange,
}: {
  collector: CollectorPerformanceRow;
  dateRangeLabel: string;
  errorMessage: string | null;
  focusedProfileData: CollectorProfileData | null;
  periodAvailability: CollectorProfilePeriodAvailability;
  profileHref: string;
  selectedBasis: CollectorLeaderboardBasis;
  selectedFrom: string;
  selectedRange: CollectorsFilterInput["range"];
  selectedTo: string;
  viewerRoleName: string;
  onBasisChange: (basis: CollectorLeaderboardBasis) => void;
  onRangeChange: (value: { range: CollectorsFilterInput["range"]; from: string; to: string }) => void;
}) {
  const canUseAverageMonthly = supportsAverageMonthlyCollectionsSelection({
    range: selectedRange,
    from: selectedFrom,
    to: selectedTo,
  });
  const canUseIncentives = supportsIncentivesSelection({
    range: selectedRange,
    from: selectedFrom,
    to: selectedTo,
  });
  const visibleBasisOptions = BASIS_OPTIONS.filter((option) => {
    if (option.value === "incentives") {
      return canUseIncentives;
    }

    return true;
  });
  const rankContextScope =
    viewerRoleName === "Branch Manager"
      ? "branch-only"
      : viewerRoleName === "Auditor"
        ? "assigned-branches"
        : "nationwide";
  const scopeLabel =
    rankContextScope === "branch-only"
      ? "branch scope"
      : rankContextScope === "assigned-branches"
        ? "assigned-branches scope"
        : "nationwide scope";

  return (
    <div className="space-y-6">
      <TremorCard className="rounded-md p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch xl:justify-between">
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
              highlights the strongest KPI signals for {dateRangeLabel} using your {scopeLabel}.
            </p>
            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[520px] xl:self-stretch xl:justify-between">
            <div className="flex justify-start xl:justify-end">
              <Link href={profileHref}>
                <Button className="h-11 rounded-md px-4" type="button">View Profile</Button>
              </Link>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
              <div className="flex w-full flex-col gap-1 sm:w-[240px]">
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
                <CollectorsPeriodFilter
                  controlClassName={UI_CONTROL_CLASS_NAME}
                  from={selectedFrom}
                  label="Period"
                  onRangeChange={onRangeChange}
                  periodAvailability={focusedProfileData?.periodAvailability ?? periodAvailability}
                  range={selectedRange}
                  showLabel={false}
                  to={selectedTo}
                />
              </div>

              <label className="flex w-full flex-col gap-1 sm:w-[240px]">
                <Label>Ranking Basis</Label>
                <Select onValueChange={(value) => onBasisChange(value as CollectorLeaderboardBasis)} value={selectedBasis}>
                  <SelectTrigger className={`${UI_CONTROL_CLASS_NAME} w-full`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleBasisOptions.map((option) => (
                      <SelectItem
                        disabled={
                          (option.value === "average-monthly-collections" && !canUseAverageMonthly) ||
                          (option.value === "incentives" && !canUseIncentives)
                        }
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
          rankContextScope={rankContextScope}
          showSectionIntros={false}
          visibleSections={{
            selectedPeriod: true,
            currentPortfolio: false,
            lifetime: false,
          }}
        />
      ) : (
        <Card className="rounded-md border-dashed">
          <CardContent className="px-5 py-4 text-sm text-muted-foreground">
            A detailed performance snapshot is not available for this period yet. Try another period or open the full profile view.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
