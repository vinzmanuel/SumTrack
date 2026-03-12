"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { CollectorProfileFilters } from "@/app/dashboard/collectors/collector-profile-filters";
import { CollectorProfilePanel } from "@/app/dashboard/collectors/collector-profile-panel";
import type {
  CollectorProfileData,
  CollectorProfilePeriodKey,
} from "@/app/dashboard/collectors/types";

function buildDataUrl(period: CollectorProfilePeriodKey) {
  const params = new URLSearchParams();
  if (period !== "this-month") {
    params.set("period", period);
  }

  const query = params.toString();
  return query ? `/dashboard/my-performance/data?${query}` : "/dashboard/my-performance/data";
}

function replacePageUrl(period: CollectorProfilePeriodKey) {
  const url = new URL(window.location.href);

  if (period === "this-month") {
    url.searchParams.delete("period");
  } else {
    url.searchParams.set("period", period);
  }

  const query = url.searchParams.toString();
  window.history.replaceState(null, "", query ? `${url.pathname}?${query}` : url.pathname);
}

export function CollectorMyPerformanceClientPage({
  initialData,
}: {
  initialData: CollectorProfileData;
}) {
  const [data, setData] = useState(initialData);
  const [period, setPeriod] = useState<CollectorProfilePeriodKey>(initialData.periodKey);
  const [appliedPeriod, setAppliedPeriod] = useState<CollectorProfilePeriodKey>(initialData.periodKey);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setData(initialData);
    setPeriod(initialData.periodKey);
    setAppliedPeriod(initialData.periodKey);
    setErrorMessage(null);
  }, [initialData]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const loadResults = useCallback(async (nextPeriod: CollectorProfilePeriodKey) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(buildDataUrl(nextPeriod), {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Unable to load performance.");
      }

      const nextData = (await response.json()) as CollectorProfileData;
      setData(nextData);
      setAppliedPeriod(nextData.periodKey);
      replacePageUrl(nextData.periodKey);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setErrorMessage("Unable to refresh your performance right now.");
    } finally {
      if (abortRef.current === controller) {
        setIsPending(false);
      }
    }
  }, []);

  useEffect(() => {
    if (period === appliedPeriod) {
      return;
    }

    void loadResults(period);
  }, [appliedPeriod, loadResults, period]);

  const statusText = useMemo(() => {
    if (isPending) {
      return "Refreshing your KPI view...";
    }

    if (errorMessage) {
      return errorMessage;
    }

    return "Track your own workload, collections, and KPI signals here.";
  }, [errorMessage, isPending]);

  return (
    <div className="space-y-6">
      <TremorCard className="p-6">
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">My Performance</h1>
          <TremorDescription className="text-[13px]">{statusText}</TremorDescription>
        </div>

        <div className="mt-5 border-t border-border/70 pt-5">
          <CollectorProfileFilters onPeriodChange={setPeriod} period={period} />
        </div>
      </TremorCard>

      <div className="relative">
        {isPending ? (
          <div className="absolute inset-0 z-10 flex items-start justify-end rounded-3xl bg-background/45 p-4 backdrop-blur-[1px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Refreshing performance
            </div>
          </div>
        ) : null}

        <CollectorProfilePanel data={data} showRankContext={false} />
      </div>
    </div>
  );
}
