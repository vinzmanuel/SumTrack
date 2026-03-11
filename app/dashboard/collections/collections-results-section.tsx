"use client";

import { CollectionsBentoGrid } from "@/app/dashboard/collections/collections-bento-grid";
import { CollectionsSummaryCards } from "@/app/dashboard/collections/collections-summary-cards";
import { CollectionsResultsSkeleton } from "@/app/dashboard/collections/collections-results-skeleton";
import type { CollectionsAnalyticsData } from "@/app/dashboard/collections/types";

export function CollectionsResultsSection({
  data,
  errorMessage,
  isPending,
}: {
  data: CollectionsAnalyticsData | null;
  errorMessage: string | null;
  isPending: boolean;
}) {
  if (!data) {
    return <CollectionsResultsSkeleton errorMessage={errorMessage} />;
  }

  return (
    <div className="relative space-y-6">
      <CollectionsSummaryCards summary={data.summary} />
      <CollectionsBentoGrid data={data} />
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      {isPending ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-background/55 backdrop-blur-[1px]">
          <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm">
            Updating collections analytics...
          </div>
        </div>
      ) : null}
    </div>
  );
}
