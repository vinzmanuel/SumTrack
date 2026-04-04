import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className={`gap-0 overflow-hidden py-0 shadow-sm ${className ?? ""}`}>
      <CardHeader className="gap-0 pb-1.5 pt-3.5">
        <CardTitle className="text-base font-semibold tracking-tight">{data.title}</CardTitle>
        <CardDescription className="text-sm leading-5">{data.description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        {data.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{data.emptyMessage}</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {data.items.map((item) => {
              const width = maxValue > 0 ? Math.max((item.value / maxValue) * 100, 8) : 8;

              return (
                <div className="rounded-2xl border border-border/70 bg-muted/10 p-2.5 shadow-sm" key={`${data.title}-${item.label}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs leading-4.5 text-muted-foreground">
                        {data.secondaryLabel}: {secondaryFormatter(item.secondaryValue)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tracking-tight text-foreground sm:text-[15px]">
                        {valueFormatter(item.value)}
                      </p>
                      <p className="text-xs text-muted-foreground">{data.valueLabel}</p>
                    </div>
                  </div>
                  <div className="mt-2.5 h-2 rounded-full bg-[var(--app-background)]">
                    <div
                      className="h-2 rounded-full bg-emerald-500"
                      style={{ width: `${width}%` }}
                    />
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
