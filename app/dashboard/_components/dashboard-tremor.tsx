"use client";

import {
  TremorCard,
  TremorDescription,
  TremorMetric,
  TremorTitle,
} from "@/components/tremor/raw/metric-card";
import {
  AlertTriangle,
  Banknote,
  FileText,
  HandCoins,
  Landmark,
  Users,
  type LucideIcon,
} from "lucide-react";

type MetricIconKey = "loans" | "collections" | "expenses" | "outstanding" | "overdue" | "borrowers";

const metricIconMap: Record<MetricIconKey, LucideIcon> = {
  loans: HandCoins,
  collections: Banknote,
  expenses: Landmark,
  outstanding: FileText,
  overdue: AlertTriangle,
  borrowers: Users,
};

export type OverviewMetric = {
  label: string;
  value: string;
  supportingText?: string;
  iconKey?: MetricIconKey;
  iconClassName?: string;
};

export function DashboardMetricGrid({ items }: { items: OverviewMetric[] }) {
  if (items.length === 0) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <TremorCard key={item.label}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <TremorTitle>{item.label}</TremorTitle>
              <TremorMetric>{item.value}</TremorMetric>
              {item.supportingText ? (
                <TremorDescription className="mt-1 text-xs">{item.supportingText}</TremorDescription>
              ) : null}
            </div>
            {item.iconKey ? (
              <MetricIcon iconClassName={item.iconClassName} iconKey={item.iconKey} />
            ) : null}
          </div>
        </TremorCard>
      ))}
    </div>
  );
}

function MetricIcon({ iconKey, iconClassName }: { iconKey: MetricIconKey; iconClassName?: string }) {
  const Icon = metricIconMap[iconKey];
  return (
    <div className={`rounded-lg p-2 ${iconClassName ?? "bg-muted text-foreground"}`}>
      <Icon className="h-4 w-4" />
    </div>
  );
}
