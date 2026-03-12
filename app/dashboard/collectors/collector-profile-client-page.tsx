"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { CollectorProfileFilters } from "@/app/dashboard/collectors/collector-profile-filters";
import { CollectorProfilePanel } from "@/app/dashboard/collectors/collector-profile-panel";
import type {
  CollectorProfileData,
  CollectorProfilePeriodKey,
} from "@/app/dashboard/collectors/types";

function buildDataUrl(collectorId: string, period: CollectorProfilePeriodKey) {
  const params = new URLSearchParams();
  if (period !== "this-month") {
    params.set("period", period);
  }

  const queryString = params.toString();
  return queryString
    ? `/dashboard/collectors/${collectorId}/data?${queryString}`
    : `/dashboard/collectors/${collectorId}/data`;
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

export function CollectorProfileClientPage({
  backHref,
  collectorId,
  initialData,
}: {
  backHref: string;
  collectorId: string;
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
      const response = await fetch(buildDataUrl(collectorId, nextPeriod), {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Unable to load collector profile.");
      }

      const nextData = (await response.json()) as CollectorProfileData;
      setData(nextData);
      setAppliedPeriod(nextData.periodKey);
      replacePageUrl(nextData.periodKey);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setErrorMessage("Unable to refresh the collector dashboard right now.");
    } finally {
      if (abortRef.current === controller) {
        setIsPending(false);
      }
    }
  }, [collectorId]);

  useEffect(() => {
    if (period === appliedPeriod) {
      return;
    }

    void loadResults(period);
  }, [appliedPeriod, loadResults, period]);

  const statusText = useMemo(() => {
    if (isPending) {
      return "Refreshing period analytics...";
    }

    if (errorMessage) {
      return errorMessage;
    }

    return "Period-based cards and charts refresh below without remounting the full page.";
  }, [errorMessage, isPending]);

  return (
    <div className="space-y-6">
      <TremorCard className="p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Collector Detail</h1>
            <TremorDescription className="text-[13px]">{statusText}</TremorDescription>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href={backHref}>
              <Button type="button" variant="outline">
                Back to Collectors
              </Button>
            </Link>
          </div>
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
              Refreshing analytics
            </div>
          </div>
        ) : null}

        <CollectorProfilePanel data={data} />
      </div>
    </div>
  );
}
