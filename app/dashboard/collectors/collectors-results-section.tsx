"use client";

import { useRouter } from "next/navigation";
import { CollectorsIndividualMode } from "@/app/dashboard/collectors/collectors-individual-mode";
import { CollectorsRankedMode } from "@/app/dashboard/collectors/collectors-ranked-mode";
import { CollectorsResultsSkeleton } from "@/app/dashboard/collectors/collectors-results-skeleton";
import type {
  CollectorLeaderboardBasis,
  CollectorPerformanceRow,
  CollectorsAnalyticsData,
  CollectorsFilterInput,
} from "@/app/dashboard/collectors/types";

function buildProfileHref(filters: CollectorsFilterInput, collectorId: string) {
  const params = new URLSearchParams();
  params.set("source", "collectors");
  params.set("tab", "performance");

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

export function CollectorsResultsSection({
  data,
  errorMessage,
  filters,
  isPending,
  onBasisChange,
  onRangeChange,
  onPageChange,
  onPageSizeChange,
}: {
  data: CollectorsAnalyticsData | null;
  errorMessage: string | null;
  filters: CollectorsFilterInput;
  isPending: boolean;
  onBasisChange: (basis: CollectorLeaderboardBasis) => void;
  onRangeChange: (value: { range: CollectorsFilterInput["range"]; from: string; to: string }) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const router = useRouter();
  const isIndividualMode = data?.totalCount === 1;

  function handleViewCollector(collector: CollectorPerformanceRow) {
    router.push(buildProfileHref(filters, collector.collectorId));
  }

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
          focusedProfileData={data.focusedCollectorProfileData ?? null}
          onBasisChange={onBasisChange}
          onRangeChange={onRangeChange}
          profileHref={buildProfileHref(filters, data.rows[0].collectorId)}
          selectedBasis={filters.basis}
          selectedRange={filters.range}
        />
      ) : (
        <CollectorsRankedMode
          data={data}
          errorMessage={errorMessage}
          isPending={isPending}
          onBasisChange={onBasisChange}
          onRangeChange={onRangeChange}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          onViewCollector={handleViewCollector}
        />
      )}

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
