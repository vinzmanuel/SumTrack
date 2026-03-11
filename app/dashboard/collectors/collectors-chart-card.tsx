import type { ReactNode } from "react";
import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";

export function CollectorsChartCard({
  title,
  description,
  chart,
}: {
  title: string;
  description: string;
  chart: ReactNode;
}) {
  return (
    <TremorCard>
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
