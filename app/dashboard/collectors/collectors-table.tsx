"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { collectorRankBadgeClassName } from "@/app/dashboard/collectors/collectors-rank-styles";
import {
  formatCollectorsCurrency,
  formatCollectorsInteger,
  formatCollectorsPercent,
} from "@/app/dashboard/collectors/format";
import type { CollectorPerformanceRow } from "@/app/dashboard/collectors/types";

export function CollectorsTable({
  rows,
  onViewCollector,
}: {
  rows: CollectorPerformanceRow[];
  onViewCollector: (collector: CollectorPerformanceRow) => void;
}) {
  const maxCollected = Math.max(...rows.map((row) => row.totalCollected), 0);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-3 font-medium">Rank</th>
            <th className="px-3 py-3 font-medium">Collector</th>
            <th className="px-3 py-3 font-medium">Branch / Area</th>
            <th className="px-3 py-3 font-medium">Assigned Active Loans</th>
            <th className="px-3 py-3 font-medium">Total Collected</th>
            <th className="px-3 py-3 font-medium">Execution</th>
            <th className="px-3 py-3 font-medium text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-muted-foreground" colSpan={7}>
                No collectors matched the selected filters.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                className="cursor-pointer border-b last:border-b-0 hover:bg-muted/25"
                key={row.collectorId}
                onClick={() => onViewCollector(row)}
              >
                <td className="px-3 py-4 align-top">
                  <Badge className={collectorRankBadgeClassName(row.rank)} variant="outline">
                    #{formatCollectorsInteger(row.rank)}
                  </Badge>
                </td>
                <td className="px-3 py-4 align-top">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{row.fullName}</p>
                    <p className="text-xs text-muted-foreground">{row.companyId}</p>
                  </div>
                </td>
                <td className="px-3 py-4 align-top">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{row.branchName}</p>
                    <p className="text-xs text-muted-foreground">{row.areaLabel}</p>
                  </div>
                </td>
                <td className="px-3 py-4 align-top">
                  <div className="space-y-1">
                    <p className="font-semibold text-foreground">{formatCollectorsInteger(row.assignedActiveLoans)}</p>
                    <p className="text-xs text-muted-foreground">active loans</p>
                  </div>
                </td>
                <td className="px-3 py-4 align-top">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-foreground">{formatCollectorsCurrency(row.totalCollected)}</p>
                      <span className="text-xs text-muted-foreground">
                        Month {formatCollectorsCurrency(row.averageMonthlyCollections)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-emerald-500/85"
                        style={{ width: `${maxCollected > 0 ? Math.max((row.totalCollected / maxCollected) * 100, 8) : 8}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4 align-top">
                  <div className="space-y-1 text-xs">
                    <p className="text-muted-foreground">
                      Completion <span className="font-medium text-foreground">{formatCollectorsPercent(row.completionRate)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Control <span className="font-medium text-foreground">{formatCollectorsPercent(row.delinquencyControl)}</span>
                    </p>
                  </div>
                </td>
                <td className="px-3 py-4 text-right align-top">
                  <Button
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
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
