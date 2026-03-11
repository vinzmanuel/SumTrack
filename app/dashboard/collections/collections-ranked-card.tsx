import { TremorCard, TremorDescription } from "@/components/tremor/raw/metric-card";
import { formatCollectionsCurrency, formatCollectionsInteger } from "@/app/dashboard/collections/format";
import type { CollectionsRankedCardData } from "@/app/dashboard/collections/types";

export function CollectionsRankedCard({
  data,
  className,
  valueFormatter,
  secondaryFormatter,
}: {
  data: CollectionsRankedCardData;
  className?: string;
  valueFormatter: (value: number) => string;
  secondaryFormatter: (value: number) => string;
}) {
  const maxValue = Math.max(...data.items.map((item) => item.value), 0);

  return (
    <TremorCard className={className}>
      <div className="space-y-5 p-6">
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold tracking-tight text-foreground">{data.title}</h3>
          <TremorDescription className="text-[13px]">{data.description}</TremorDescription>
        </div>

        {data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{data.emptyMessage}</p>
        ) : (
          <div className="space-y-4">
            {data.items.map((item) => {
              const width = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 8) : 8;

              return (
                <div className="space-y-2" key={`${data.title}-${item.label}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {data.secondaryLabel}: {secondaryFormatter(item.secondaryValue)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {valueFormatter(item.value)}
                      </p>
                      <p className="text-xs text-muted-foreground">{data.valueLabel}</p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-emerald-500/75"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TremorCard>
  );
}

export const formatRankedCurrency = formatCollectionsCurrency;
export const formatRankedInteger = formatCollectionsInteger;
