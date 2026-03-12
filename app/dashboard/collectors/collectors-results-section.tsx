"use client";

import { useMemo, useState } from "react";
import { CollectorModal } from "@/app/dashboard/collectors/collector-modal";
import { CollectorsIndividualMode } from "@/app/dashboard/collectors/collectors-individual-mode";
import { CollectorsRankedMode } from "@/app/dashboard/collectors/collectors-ranked-mode";
import { CollectorsResultsSkeleton } from "@/app/dashboard/collectors/collectors-results-skeleton";
import type {
  CollectorPerformanceRow,
  CollectorProfileData,
  CollectorsAnalyticsData,
  CollectorsFilterInput,
} from "@/app/dashboard/collectors/types";

function buildProfileHref(filters: CollectorsFilterInput, collectorId: string) {
  const params = new URLSearchParams();

  if (filters.branch && filters.branch !== "all") {
    params.set("branch", filters.branch);
  }
  if (filters.range !== "this-month") {
    params.set("range", filters.range);
  }
  if (filters.range === "custom") {
    if (filters.from) {
      params.set("from", filters.from);
    }
    if (filters.to) {
      params.set("to", filters.to);
    }
  }
  if (filters.query.trim()) {
    params.set("query", filters.query.trim());
  }

  const queryString = params.toString();
  return queryString
    ? `/dashboard/collectors/${collectorId}?${queryString}`
    : `/dashboard/collectors/${collectorId}`;
}

function toProfileData(row: CollectorPerformanceRow): CollectorProfileData {
  return {
    collectorId: row.collectorId,
    fullName: row.fullName,
    companyId: row.companyId,
    branchName: row.branchName,
    areaLabel: row.areaLabel,
    status: row.status,
    rank: row.rank,
    activePrincipalLoad: row.activePrincipalLoad,
    totalCollected: row.totalCollected,
    averageCollectionAmount: row.averageCollectionAmount,
    averageMonthlyCollections: row.averageMonthlyCollections,
    assignedActiveLoans: row.assignedActiveLoans,
    completedLoans: row.completedLoans,
    missedPaymentCount: row.missedPaymentCount,
    missedPaymentRate: row.missedPaymentRate,
    collectionEntries: row.collectionEntries,
    collectionDays: row.collectionDays,
    activeWeeks: row.activeWeeks,
    completionRate: row.completionRate,
    consistencyScore: row.consistencyScore,
    delinquencyControl: row.delinquencyControl,
    portfolioRecoveryRate: row.portfolioRecoveryRate,
    previousTotalCollected: row.previousTotalCollected,
    periodChangePercent: row.periodChangePercent,
    radarMetrics: row.radarMetrics,
  };
}

export function CollectorsResultsSection({
  data,
  errorMessage,
  filters,
  isPending,
  onPageChange,
}: {
  data: CollectorsAnalyticsData | null;
  errorMessage: string | null;
  filters: CollectorsFilterInput;
  isPending: boolean;
  onPageChange: (page: number) => void;
}) {
  const [selectedCollector, setSelectedCollector] = useState<CollectorProfileData | null>(null);
  const isIndividualMode = data?.totalCount === 1;
  const profileHref = useMemo(
    () =>
      selectedCollector ? buildProfileHref(filters, selectedCollector.collectorId) : "/dashboard/collectors",
    [filters, selectedCollector],
  );

  if (!data) {
    return <CollectorsResultsSkeleton />;
  }

  return (
    <div className="relative space-y-6">
      {isIndividualMode ? (
        <CollectorsIndividualMode
          collector={data.rows[0]}
          dateRangeLabel={data.dateRangeLabel}
          errorMessage={errorMessage}
          onOpenCollector={(collector) => setSelectedCollector(toProfileData(collector))}
          profileHref={buildProfileHref(filters, data.rows[0].collectorId)}
        />
      ) : (
        <CollectorsRankedMode
          data={data}
          errorMessage={errorMessage}
          isPending={isPending}
          onPageChange={onPageChange}
          onViewCollector={(collector) => setSelectedCollector(toProfileData(collector))}
        />
      )}

      <CollectorModal
        collector={selectedCollector}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCollector(null);
          }
        }}
        open={Boolean(selectedCollector)}
        profileHref={profileHref}
      />

      {isPending ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/55 backdrop-blur-[1px]">
          <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
            Updating collector analytics...
          </div>
        </div>
      ) : null}
    </div>
  );
}
