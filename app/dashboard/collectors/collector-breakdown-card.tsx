import { CollectorInfoHint } from "@/app/dashboard/collectors/collector-info-hint";
import { cn } from "@/lib/utils";

export function CollectorBreakdownCard({
  title,
  help,
  description,
  items,
  className,
}: {
  title: string;
  help: string;
  description: string;
  items: Array<{
    label: string;
    value: string;
    percent: number;
    toneClassName: string;
  }>;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border/70 bg-background p-5 shadow-sm", className)}>
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold tracking-tight text-foreground">
          <CollectorInfoHint help={help} label={title} />
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div className="space-y-2" key={item.label}>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-semibold text-foreground">{item.value}</span>
            </div>
            <div className="h-2 rounded-full bg-muted/80">
              <div
                className={cn("h-2 rounded-full", item.toneClassName)}
                style={{ width: `${Math.max(8, Math.min(item.percent, 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
