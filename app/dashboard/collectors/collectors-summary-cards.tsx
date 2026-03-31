import { ArrowDownRight, ArrowUpRight, Gauge, HandCoins, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  collectorsTrendTone,
  formatCollectorsCurrency,
  formatCollectorsInteger,
  formatCollectorsPercent,
  formatCollectorsSignedPercent,
} from "@/app/dashboard/collectors/format";
import { cn } from "@/lib/utils";
import type { CollectorsSummaryStats } from "@/app/dashboard/collectors/types";

export function CollectorsSummaryCards({
  summary,
}: {
  summary: CollectorsSummaryStats;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.2fr)_minmax(0,0.95fr)]">
      <SummaryCard
        description="Collectors currently visible inside the active branch, date, and search scope."
        icon={Users}
        title="Active Collectors"
        value={formatCollectorsInteger(summary.activeCollectors)}
      />
      <SummaryCard
        className="bg-emerald-50/55"
        deltaValue={summary.totalCollectionsChangePercent}
        description="Cash-in attributed to the currently visible collectors for the active period."
        icon={HandCoins}
        title="Total Collections Attributed"
        value={formatCollectorsCurrency(summary.totalCollectionsAttributed)}
      />
      <SummaryCard
        description="Collected amount as a share of the visible live principal load."
        icon={Gauge}
        title="Avg Portfolio Recovery Rate"
        value={formatCollectorsPercent(summary.averagePortfolioRecoveryRate)}
      />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  deltaValue,
  className,
}: {
  title: string;
  value: string;
  description: string;
  icon: typeof Users;
  deltaValue?: number | null;
  className?: string;
}) {
  return (
    <Card className={cn("gap-0 rounded-2xl py-0 shadow-none", className)}>
      <CardHeader className="gap-2 pb-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="size-4" />
          {title}
        </div>
        <CardTitle className="text-3xl font-semibold tracking-tight">{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pb-5">
        {typeof deltaValue !== "undefined" ? (
          <SummaryDelta className={collectorsTrendTone(deltaValue)} value={deltaValue} />
        ) : null}
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

function SummaryDelta({
  value,
  className,
}: {
  value: number | null;
  className: string;
}) {
  const TrendIcon = value !== null && value < -0.5 ? ArrowDownRight : ArrowUpRight;

  return (
    <p className={cn("inline-flex items-center gap-1 text-xs font-medium", className)}>
      <TrendIcon className="size-3.5" />
      {formatCollectorsSignedPercent(value)} vs previous equivalent period
    </p>
  );
}
