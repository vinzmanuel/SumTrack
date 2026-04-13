"use client";

import type { ReactNode } from "react";
import {
  TremorCard,
  TremorDescription,
  TremorMetric,
  TremorTitle,
} from "@/components/tremor/raw/metric-card";
import { UI_SURFACE_CLASS_NAME } from "@/app/dashboard/_components/ui-patterns";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  FileText,
  HandCoins,
  Landmark,
  Users,
  type LucideIcon,
} from "lucide-react";

type MetricIconKey =
  | "loans"
  | "collections"
  | "expenses"
  | "outstanding"
  | "overdue"
  | "borrowers"
  | "dueDate";

const metricIconMap: Record<MetricIconKey, LucideIcon> = {
  loans: HandCoins,
  collections: Banknote,
  expenses: Landmark,
  outstanding: FileText,
  overdue: AlertTriangle,
  borrowers: Users,
  dueDate: CalendarDays,
};

export type OverviewMetric = {
  id?: string;
  label: string;
  value: string;
  supportingText?: string;
  iconKey?: MetricIconKey;
  iconClassName?: string;
};

export function DashboardMetricGrid({
  items,
  children,
  className,
}: {
  items: OverviewMetric[];
  children?: ReactNode;
  className?: string;
}) {
  if (items.length === 0 && !children) return null;

  return (
    <div className={`grid w-full gap-4 md:grid-cols-2 ${className ?? ""}`}>
      {items.map((item) => (
        <TremorCard className={UI_SURFACE_CLASS_NAME} data-widget-id={item.id ?? item.label} key={item.id ?? item.label}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <TremorTitle className="text-sm font-medium">{item.label}</TremorTitle>
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
      {children}
    </div>
  );
}

function MetricIcon({ iconKey, iconClassName }: { iconKey: MetricIconKey; iconClassName?: string }) {
  const Icon = metricIconMap[iconKey];
  return (
    <div className={`rounded-md border border-current/35 p-2 ${iconClassName ?? "bg-muted text-foreground"}`}>
      <Icon className="h-4 w-4" />
    </div>
  );
}
