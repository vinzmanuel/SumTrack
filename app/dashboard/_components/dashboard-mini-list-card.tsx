"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardMiniListWidget } from "@/app/dashboard/overview-types";

export function DashboardMiniListCard({ widget }: { widget: DashboardMiniListWidget }) {
  return (
    <Card className="rounded-md py-0 shadow-sm" data-widget-id={widget.id}>
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-base font-semibold tracking-tight">{widget.title}</CardTitle>
        <CardDescription className="text-sm leading-5">{widget.description}</CardDescription>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        {widget.items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/70 bg-muted/20 px-3 py-5 text-sm text-muted-foreground">
            {widget.emptyMessage}
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border/70">
            {widget.items.map((item) => (
              <div className="flex items-start justify-between gap-3 border-b border-border/70 px-3 py-2.5 last:border-b-0" key={item.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                  {item.subtitle ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.subtitle}</p>
                  ) : null}
                </div>
                {item.meta ? <p className="shrink-0 text-xs font-medium text-foreground">{item.meta}</p> : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
