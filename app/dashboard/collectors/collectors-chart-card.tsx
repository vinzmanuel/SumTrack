import type { ReactNode } from "react";
import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { cn } from "@/lib/utils";

export function CollectorsChartCard({
  title,
  description,
  chart,
  className,
}: {
  title: string;
  description: string;
  chart: ReactNode;
  className?: string;
}) {
  return (
    <TremorCard className={cn(className)}>
      <div className="space-y-5 p-6">
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
          <TremorDescription className="text-[13px]">{description}</TremorDescription>
        </div>
        {chart}
      </div>
    </TremorCard>
  );
}
