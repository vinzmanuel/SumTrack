"use client";

import { CircleHelp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { collectorRankBadgeClassName } from "@/app/dashboard/collectors/collectors-rank-styles";
import {
  formatCollectorsCurrency,
  formatCollectorsInteger,
  formatCollectorsPercent,
} from "@/app/dashboard/collectors/format";
import { cn } from "@/lib/utils";
import type { CollectorPerformanceRow } from "@/app/dashboard/collectors/types";

function TableMetricStack({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex min-h-10 flex-col items-start justify-center gap-0.5", className)}>{children}</div>;
}

function TableLabelWithTooltip({
  label,
  content,
}: {
  label: string;
  content: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help items-center gap-1 align-middle">
          <span>{label}</span>
          <CircleHelp className="size-3.5 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 px-3 py-2 text-left" side="top">
        <div className="space-y-2">{content}</div>
      </TooltipContent>
    </Tooltip>
  );
}

const cellGroupDividerClassName = "border-r border-border/70";
const headerGroupDividerClassName = "border-r border-border/70";
const headerRowClassName = "border-border/70 bg-[var(--app-table-header)]";

export function CollectorsTable({
  basis,
  emptyMessage = "No collectors matched the selected filters.",
  rows,
  onViewCollector,
}: {
  basis: "total-collected" | "average-monthly-collections" | "incentives";
  emptyMessage?: string;
  rows: CollectorPerformanceRow[];
  onViewCollector: (collector: CollectorPerformanceRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border">
      <Table className="table-fixed [&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:first-child]:pl-5 [&_th:last-child]:pr-5">
        <colgroup>
          <col style={{ width: "5rem" }} />
          <col style={{ width: "20rem" }} />
          <col style={{ width: "6rem" }} />
          <col style={{ width: "8rem" }} />
          <col style={{ width: "6rem" }} />
          <col style={{ width: "9rem" }} />
          <col style={{ width: "6rem" }} />
          <col style={{ width: "6rem" }} />
          <col style={{ width: "5rem" }} />
        </colgroup>
        <TableHeader>
          <TableRow className={headerRowClassName}>
            <TableHead className={cn("h-10 border-b border-border/70", headerGroupDividerClassName)} colSpan={2} />
            <TableHead className={cn("h-10 px-4 text-center align-middle font-semibold", headerGroupDividerClassName)} colSpan={4}>
              Period-Based
            </TableHead>
            <TableHead className={cn("h-10 px-4 text-center align-middle font-semibold", headerGroupDividerClassName)} colSpan={2}>
              Live Stats
            </TableHead>
            <TableHead className="h-10 border-b border-border/70" />
          </TableRow>
          <TableRow className={headerRowClassName}>
            <TableHead className="align-middle">Rank</TableHead>
            <TableHead className={cn("align-middle", headerGroupDividerClassName)}>Collector</TableHead>
            <TableHead className={cn("px-4", basis === "average-monthly-collections" ? "text-muted-foreground" : "text-foreground")}>
              {basis === "incentives" ? "Total Incentives" : "Total Collected"}
            </TableHead>
            <TableHead className="px-4">
              <TableLabelWithTooltip
                content={
                  <>
                    <p className="font-medium">What it means</p>
                    <ul className="list-disc space-y-1 pl-4 text-xs">
                      <li>Prorated target for the selected date range.</li>
                      <li>Uses each loan&apos;s total payable spread across its term.</li>
                      <li>Counts only the due days that fall inside the selected range.</li>
                    </ul>
                    <p className="font-medium">How to read it</p>
                    <ul className="list-disc space-y-1 pl-4 text-xs">
                      <li>Below 100% means collections are behind the in-range target.</li>
                      <li>At 100% means the collector has matched the in-range target.</li>
                      <li>Above 100% means collections are ahead of the in-range target.</li>
                    </ul>
                  </>
                }
                label="Expected Collected"
              />
            </TableHead>
            <TableHead className="px-4">Missed Rate</TableHead>
            <TableHead className={cn("px-4", headerGroupDividerClassName)}>
              Avg Monthly Collections
            </TableHead>
            <TableHead className="px-4">Active Loans</TableHead>
            <TableHead className={cn("px-4", headerGroupDividerClassName)}>
              <TableLabelWithTooltip
                content={
                  <>
                    <p className="font-medium">What these values mean</p>
                    <ul className="list-disc space-y-1 pl-4 text-xs">
                      <li>`Load` is the current total payable load of the collector&apos;s active loans.</li>
                      <li>`Recovery` compares total collected so far on active loans against that active loan load.</li>
                      <li>`Efficiency` compares total collected so far on active loans against what those same active loans should have reached by today.</li>
                    </ul>
                    <p className="font-medium">How to read them</p>
                    <ul className="list-disc space-y-1 pl-4 text-xs">
                      <li>Below 100% usually means the active-loan portfolio is still behind target or only partially recovered.</li>
                      <li>At 100% means the collector has matched the compared live benchmark.</li>
                      <li>Above 100% means the collector is outperforming the live benchmark.</li>
                    </ul>
                  </>
                }
                label="Recovery"
              />
            </TableHead>
            <TableHead className="px-4 text-center align-middle">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell className="py-8 text-center text-muted-foreground" colSpan={9}>
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const activeTotalPayableLoad = row.activePrincipalLoad + row.activeInterestPotential;

              return (
              <TableRow
                className="cursor-pointer hover:bg-muted/25"
                key={row.collectorId}
                onClick={() => onViewCollector(row)}
              >
                <TableCell className="py-2 align-middle whitespace-normal">
                  <div className="flex min-h-10 items-center">
                    <Badge className={collectorRankBadgeClassName(row.rank)} variant="outline">
                      #{formatCollectorsInteger(row.rank)}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className={cn("py-2 align-middle whitespace-normal", cellGroupDividerClassName)}>
                  <TableMetricStack>
                    <p className="text-sm leading-5 text-foreground">
                      <span className="font-semibold">{row.fullName}</span>{" "}
                      <span className="font-normal">({row.companyId})</span>
                    </p>
                    <p className="text-xs leading-4 text-muted-foreground">
                      {row.branchName}, {row.provinceName} / {row.areaLabel}
                    </p>
                  </TableMetricStack>
                </TableCell>
                <TableCell className="px-4 py-2 align-middle whitespace-normal">
                  <TableMetricStack>
                    <p className="text-sm font-semibold leading-5 text-foreground">
                      {formatCollectorsCurrency(basis === "incentives" ? row.periodIncentiveTotal : row.totalCollected)}
                    </p>
                  </TableMetricStack>
                </TableCell>
                <TableCell className="px-4 py-2 align-middle whitespace-normal">
                  <TableMetricStack>
                    <p className="text-sm font-semibold leading-5 text-foreground">{formatCollectorsCurrency(row.expectedCollections)}</p>
                    <p className="text-xs leading-4 text-muted-foreground">
                      {row.expectedCollections > 0
                        ? `${formatCollectorsPercent((row.totalCollected / row.expectedCollections) * 100)} of target`
                        : "No target for range"}
                    </p>
                  </TableMetricStack>
                </TableCell>
                <TableCell className="px-4 py-2 align-middle whitespace-normal">
                  <TableMetricStack>
                    <p className="text-sm font-semibold leading-5 text-foreground">{formatCollectorsPercent(row.missedPaymentRate)}</p>
                    <p className="text-xs leading-4 text-muted-foreground">
                      {formatCollectorsInteger(row.missedPaymentCount)} missed
                    </p>
                  </TableMetricStack>
                </TableCell>
                <TableCell className={cn("px-4 py-2 align-middle whitespace-normal", cellGroupDividerClassName)}>
                  <TableMetricStack>
                    <p className="text-sm font-semibold leading-5 text-foreground">{formatCollectorsCurrency(row.averageMonthlyCollections)}</p>
                  </TableMetricStack>
                </TableCell>
                <TableCell className="px-4 py-2 align-middle whitespace-normal">
                  <TableMetricStack>
                    <p className="text-sm font-semibold leading-5 text-foreground">{formatCollectorsInteger(row.assignedActiveLoans)}</p>
                    <p className="text-xs leading-4 text-muted-foreground">
                      Load {formatCollectorsCurrency(activeTotalPayableLoad)}
                    </p>
                  </TableMetricStack>
                </TableCell>
                <TableCell className={cn("px-4 py-2 align-middle whitespace-normal", cellGroupDividerClassName)}>
                  <TableMetricStack>
                    <p className="text-sm font-semibold leading-5 text-foreground">{formatCollectorsPercent(row.liveRecoveryRate)}</p>
                    <p className="text-xs leading-4 text-muted-foreground">
                      Efficiency {formatCollectorsPercent(row.activeEfficiencyRatio ?? 0)}
                    </p>
                  </TableMetricStack>
                </TableCell>
                <TableCell className="px-4 py-2 text-center align-middle whitespace-normal">
                  <div className="flex min-h-10 items-center justify-center">
                    <Button
                      className="bg-card hover:bg-accent"
                      onClick={(event) => {
                        event.stopPropagation();
                        onViewCollector(row);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      View
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
