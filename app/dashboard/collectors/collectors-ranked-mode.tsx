"use client";

import { ChevronLeft, ChevronRight, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COLLECTORS_DATE_RANGE_OPTIONS, supportsAverageMonthlyCollections } from "@/app/dashboard/collectors/filters";
import { CollectorsTable } from "@/app/dashboard/collectors/collectors-table";
import { CollectorsTopPerformersStrip } from "@/app/dashboard/collectors/collectors-top-performers-strip";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  CollectorLeaderboardBasis,
  CollectorPerformanceRow,
  CollectorsAnalyticsData,
  CollectorsFilterInput,
} from "@/app/dashboard/collectors/types";

const BASIS_OPTIONS: Array<{ value: CollectorLeaderboardBasis; label: string }> = [
  { value: "total-collected", label: "Total Collections" },
  { value: "average-monthly-collections", label: "Average Monthly Collections" },
];

export function CollectorsRankedMode({
  data,
  errorMessage,
  isPending,
  onBasisChange,
  onRangeChange,
  onPageChange,
  onPageSizeChange,
  onViewCollector,
}: {
  data: CollectorsAnalyticsData;
  errorMessage: string | null;
  isPending: boolean;
  onBasisChange: (basis: CollectorLeaderboardBasis) => void;
  onRangeChange: (value: { range: CollectorsFilterInput["range"]; from: string; to: string }) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onViewCollector: (collector: CollectorPerformanceRow) => void;
}) {
  const totalPages = Math.max(Math.ceil(data.totalCount / data.pageSize), 1);
  const safePage = data.page;
  const canUseAverageMonthly = supportsAverageMonthlyCollections(data.filters.selectedRange);
  const basisLabel =
    data.filters.selectedBasis === "total-collected"
      ? "Ranked by total collections"
      : "Ranked by average monthly collections";

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-none">
        <CardHeader className="flex flex-col gap-3 pb-3 pt-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">Ranked Collector Leaderboard</CardTitle>
            <CardDescription>
              {basisLabel} for {data.dateRangeLabel}, with period-based results and live portfolio context in one leaderboard.
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
            <label className="flex w-full flex-col gap-1 sm:w-[240px]">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label="Date range help"
                    className="inline-flex w-fit items-center gap-1 text-left text-sm font-medium text-foreground"
                    type="button"
                  >
                    <Label className="cursor-help">Date Range</Label>
                    <CircleHelp className="size-3.5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-104" side="top">
                  <p>The selected range only changes who ranks number 1 in this leaderboard.</p>
                  <p className="mt-2">
                    The time-based columns to focus on for a selected range are:
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
                value={data.filters.selectedRange}
              >
                <SelectTrigger className="w-full">
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
              <Select onValueChange={(value) => onBasisChange(value as CollectorLeaderboardBasis)} value={data.filters.selectedBasis}>
                <SelectTrigger className="w-full">
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
        </CardHeader>
        <CardContent className="space-y-4 px-5 pb-5 pt-3">
          <CollectorsTopPerformersStrip items={data.topPerformers} />

          <CollectorsTable
            basis={data.filters.selectedBasis}
            onViewCollector={onViewCollector}
            rows={data.rows}
          />

          <div className="flex flex-col gap-3 pt-2 text-sm xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-1">
              <p className="text-muted-foreground">
                Showing {data.totalCount === 0 ? 0 : (safePage - 1) * data.pageSize + 1}
                -{Math.min(safePage * data.pageSize, data.totalCount)} of {data.totalCount}
              </p>
              {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Rows</span>
                <Select
                  onValueChange={(value) => onPageSizeChange(Number(value))}
                  value={String(data.pageSize)}
                >
                  <SelectTrigger className="w-[84px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <span className="text-muted-foreground">
                Page {safePage} of {totalPages}
              </span>
              <Button
                disabled={isPending || safePage <= 1}
                onClick={() => onPageChange(safePage - 1)}
                size="icon"
                type="button"
                variant="outline"
              >
                <ChevronLeft />
                <span className="sr-only">Previous page</span>
              </Button>
              <Button
                disabled={isPending || safePage >= totalPages}
                onClick={() => onPageChange(safePage + 1)}
                size="icon"
                type="button"
                variant="outline"
              >
                <ChevronRight />
                <span className="sr-only">Next page</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
  );
}
