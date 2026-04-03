"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { DashboardBackLink } from "@/app/dashboard/_components/dashboard-back-link";
import { CollectorAccountOverviewTab } from "@/app/dashboard/collectors/collector-account-overview-tab";
import { CollectorAssignedLoansTab } from "@/app/dashboard/collectors/collector-assigned-loans-tab";
import { CollectorProfileFilters } from "@/app/dashboard/collectors/collector-profile-filters";
import { CollectorProfilePanel } from "@/app/dashboard/collectors/collector-profile-panel";
import {
  buildCollectorsFiltersForProfilePeriod,
  resolveCollectorProfileMinimumYear,
} from "@/app/dashboard/collectors/profile-filters";
import {
  supportsAverageMonthlyCollectionsSelection,
  supportsIncentivesSelection,
} from "@/app/dashboard/collectors/filters";
import { Card, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  CollectorAssignedLoansData,
  CollectorAssignedLoansFilters,
  CollectorDetailTabKey,
  CollectorLeaderboardBasis,
  CollectorProfileData,
  CollectorProfilePeriodKey,
} from "@/app/dashboard/collectors/types";

const PROFILE_BASIS_OPTIONS: Array<{ value: CollectorLeaderboardBasis; label: string }> = [
  { value: "total-collected", label: "Total Collections" },
  { value: "average-monthly-collections", label: "Average Monthly Collections" },
  { value: "incentives", label: "Incentives" },
];

function buildPerformanceDataUrl(
  collectorId: string,
  period: CollectorProfilePeriodKey,
  basis: CollectorLeaderboardBasis,
) {
  const params = new URLSearchParams();
  if (period !== "this-month") {
    params.set("period", period);
  }
  if (basis !== "average-monthly-collections") {
    params.set("basis", basis);
  }

  const queryString = params.toString();
  return queryString
    ? `/dashboard/collectors/${collectorId}/data?${queryString}`
    : `/dashboard/collectors/${collectorId}/data`;
}

function replacePageUrl(next: {
  period: CollectorProfilePeriodKey;
  tab: CollectorDetailTabKey;
  basis: CollectorLeaderboardBasis;
}) {
  const url = new URL(window.location.href);

  if (next.period === "this-month") {
    url.searchParams.delete("period");
  } else {
    url.searchParams.set("period", next.period);
  }

  if (next.tab === "profile") {
    url.searchParams.delete("tab");
  } else {
    url.searchParams.set("tab", next.tab);
  }

  if (next.basis === "average-monthly-collections") {
    url.searchParams.delete("basis");
  } else {
    url.searchParams.set("basis", next.basis);
  }

  const query = url.searchParams.toString();
  window.history.replaceState(null, "", query ? `${url.pathname}?${query}` : url.pathname);
}

export function CollectorProfileClientPage({
  backHref,
  backLabel,
  collectorId,
  initialAssignedLoansData,
  initialAssignedLoansFilters,
  initialData,
  initialTab,
}: {
  backHref: string;
  backLabel: string;
  collectorId: string;
  initialAssignedLoansData: CollectorAssignedLoansData;
  initialAssignedLoansFilters: CollectorAssignedLoansFilters;
  initialData: CollectorProfileData;
  initialTab: CollectorDetailTabKey;
}) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<CollectorDetailTabKey>(initialTab);
  const [period, setPeriod] = useState<CollectorProfilePeriodKey>(initialData.periodKey);
  const [appliedPeriod, setAppliedPeriod] = useState<CollectorProfilePeriodKey>(initialData.periodKey);
  const [basis, setBasis] = useState<CollectorLeaderboardBasis>(initialData.selectedBasis);
  const [appliedBasis, setAppliedBasis] = useState<CollectorLeaderboardBasis>(initialData.selectedBasis);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setData(initialData);
    setActiveTab(initialTab);
    setPeriod(initialData.periodKey);
    setAppliedPeriod(initialData.periodKey);
    setBasis(initialData.selectedBasis);
    setAppliedBasis(initialData.selectedBasis);
    setErrorMessage(null);
  }, [initialData, initialTab]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const loadResults = useCallback(async (
    nextPeriod: CollectorProfilePeriodKey,
    nextBasis: CollectorLeaderboardBasis,
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsPending(true);
    setErrorMessage(null);

    try {
      const response = await fetch(buildPerformanceDataUrl(collectorId, nextPeriod, nextBasis), {
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
      setAppliedBasis(nextData.selectedBasis);
      replacePageUrl({
        period: nextData.periodKey,
        tab: activeTab,
        basis: nextData.selectedBasis,
      });
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
  }, [activeTab, collectorId]);

  useEffect(() => {
    if (period === appliedPeriod && basis === appliedBasis) {
      return;
    }

    void loadResults(period, basis);
  }, [appliedBasis, appliedPeriod, basis, loadResults, period]);

  const handleTabChange = (nextTab: string) => {
    const normalizedTab = nextTab as CollectorDetailTabKey;
    setActiveTab(normalizedTab);
    replacePageUrl({
      period,
      basis,
      tab: normalizedTab,
    });
  };

  const headerBadgeBaseClassName =
    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium leading-none shadow-xs";
  const periodFilters = buildCollectorsFiltersForProfilePeriod(period);
  const canUseAverageMonthly = supportsAverageMonthlyCollectionsSelection({
    range: periodFilters.selectedRange,
    from: periodFilters.fromRaw,
    to: periodFilters.toRaw,
  });
  const canUseIncentives = supportsIncentivesSelection({
    range: periodFilters.selectedRange,
    from: periodFilters.fromRaw,
    to: periodFilters.toRaw,
  });

  return (
    <div className="space-y-6">
      <DashboardBackLink href={backHref} label={backLabel} />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="bg-linear-to-r from-slate-50 via-white to-emerald-50/60 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-3">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground">{data.fullName}</h1>
                <CardDescription>{`${data.branchName} / ${data.areaLabel}`}</CardDescription>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <span className={`${headerBadgeBaseClassName} border-border/70 bg-card text-foreground`}>
                  Company ID: {data.companyId}
                </span>
                <span className={`${headerBadgeBaseClassName} border-blue-200 bg-blue-50 text-blue-700`}>
                  Role: {data.roleName}
                </span>
                <span
                  className={
                    data.status === "active"
                      ? `${headerBadgeBaseClassName} border-emerald-200 bg-emerald-50 text-emerald-700`
                      : `${headerBadgeBaseClassName} border-zinc-200 bg-card text-zinc-700`
                  }
                >
                  Status: {data.status === "active" ? "Active" : "Inactive"}
                </span>
                <span className={`${headerBadgeBaseClassName} border-border/70 bg-card text-foreground`}>
                  Area Code: {data.areaCode}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border/70 p-6">
          <div className="inline-flex flex-wrap gap-2 rounded-xl border border-border/70 bg-muted/30 p-1">
              <TabButton
                active={activeTab === "profile"}
                label="Profile"
                onClick={() => handleTabChange("profile")}
              />
              <TabButton
                active={activeTab === "performance"}
                label="Collector Performance"
                onClick={() => handleTabChange("performance")}
              />
              <TabButton
                active={activeTab === "assigned-loans"}
                label="Assigned Loans"
                onClick={() => handleTabChange("assigned-loans")}
              />
          </div>
        </div>
      </Card>

      {activeTab === "profile" ? (
        <CollectorAccountOverviewTab data={data} />
      ) : activeTab === "performance" ? (
        <>
          <div className="relative">
            {isPending ? (
              <div className="absolute inset-0 z-10 flex items-start justify-end rounded-3xl bg-background/45 p-4 backdrop-blur-[1px]">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                  <Loader2 className="size-3.5 animate-spin" />
                  Refreshing analytics
                </div>
              </div>
            ) : null}

            <CollectorProfilePanel
              data={data}
              periodControl={
                hasMounted ? (
                  <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
                    <CollectorProfileFilters
                      minYear={resolveCollectorProfileMinimumYear(data.dateCreated)}
                      onPeriodChange={(nextPeriod) => {
                        setPeriod(nextPeriod);
                        setBasis((previous) => {
                          const nextPeriodFilters = buildCollectorsFiltersForProfilePeriod(nextPeriod);
                          const nextPeriodParams = {
                            range: nextPeriodFilters.selectedRange,
                            from: nextPeriodFilters.fromRaw,
                            to: nextPeriodFilters.toRaw,
                          };

                          if (
                            previous === "average-monthly-collections" &&
                            !supportsAverageMonthlyCollectionsSelection(nextPeriodParams)
                          ) {
                            return "total-collected";
                          }

                          if (previous === "incentives" && !supportsIncentivesSelection(nextPeriodParams)) {
                            return "total-collected";
                          }

                          return previous;
                        });
                      }}
                      period={period}
                      periodAvailability={data.periodAvailability}
                    />

                    <label className="flex w-full flex-col gap-1 sm:w-[240px]">
                      <Label>Ranking Basis</Label>
                      <Select onValueChange={(value) => setBasis(value as CollectorLeaderboardBasis)} value={basis}>
                        <SelectTrigger className="w-full bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROFILE_BASIS_OPTIONS.map((option) => (
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
                ) : (
                  <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
                    <div className="h-9 w-full rounded-md border border-border/70 bg-muted/20 sm:w-[240px]" />
                    <div className="h-9 w-full rounded-md border border-border/70 bg-muted/20 sm:w-[240px]" />
                  </div>
                )
              }
            />
          </div>
          {errorMessage ? <p className="mt-3 text-sm text-destructive">{errorMessage}</p> : null}
        </>
      ) : (
        <CollectorAssignedLoansTab
          collectorId={collectorId}
          initialData={initialAssignedLoansData}
          initialFilters={initialAssignedLoansFilters}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
