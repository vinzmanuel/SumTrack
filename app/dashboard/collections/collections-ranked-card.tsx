import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  formatCollectionsCurrency,
  formatCollectionsInteger,
  formatCollectionsPercent,
} from "@/app/dashboard/collections/format";
import type { CollectionsComparisonData } from "@/app/dashboard/collections/types";

export function CollectionsRankedCard({
  data,
  className,
}: {
  data: CollectionsComparisonData;
  className?: string;
}) {
  const maxValue = Math.max(...data.items.map((item) => item.totalAmount), 0);

  return (
    <Card className={cn("gap-0 overflow-hidden py-0 shadow-sm", className)}>
      <CardHeader className="gap-0 pb-1.5 pt-3.5">
        <CardTitle className="text-base font-semibold tracking-tight">{data.title}</CardTitle>
        <CardDescription className="text-sm leading-5">{data.description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        {data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{data.emptyMessage}</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/10">
            {data.items.map((item) => {
              const width = maxValue > 0 ? Math.max((item.totalAmount / maxValue) * 100, 10) : 10;

              return (
                <div
                  className="border-b border-border/60 px-3 py-2.5 last:border-b-0"
                  key={`${data.title}-${item.label}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                        {data.mode === "branch" ? (
                          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Branch
                          </span>
                        ) : (
                          <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                            Weekday
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>Principal {formatCollectionsCurrency(item.principalRecovered)}</span>
                        <span>Interest {formatCollectionsCurrency(item.realizedInterest)}</span>
                        <span>{formatCollectionsInteger(item.entryCount)} entries</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tracking-tight text-foreground">
                        {formatCollectionsCurrency(item.totalAmount)}
                      </p>
                      <p className="text-xs text-muted-foreground">Total collections</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-background">
                    <div
                      className="h-1.5 rounded-full bg-emerald-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Missed {formatCollectionsInteger(item.missedPayments)}</span>
                    <span>{formatCollectionsPercent(item.missedPaymentRate)} missed rate</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
