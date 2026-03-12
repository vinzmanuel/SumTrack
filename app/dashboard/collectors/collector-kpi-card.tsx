import { cn } from "@/lib/utils";
import { CollectorInfoHint } from "@/app/dashboard/collectors/collector-info-hint";

export function CollectorKpiCard({
  title,
  help,
  value,
  subtitle,
  accentClassName,
  barPercent,
  footer,
}: {
  title: string;
  help: string;
  value: string;
  subtitle: string;
  accentClassName: string;
  barPercent: number;
  footer?: string;
}) {
  const clampedBar = Math.max(8, Math.min(barPercent, 100));

  return (
    <div className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <CollectorInfoHint help={help} label={title} />
        </p>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="text-xs leading-5 text-muted-foreground">{subtitle}</p>
      </div>

      <div className="mt-4 h-2 rounded-full bg-muted/80">
        <div className={cn("h-2 rounded-full", accentClassName)} style={{ width: `${clampedBar}%` }} />
      </div>

      {footer ? <p className="mt-2 text-xs font-medium text-muted-foreground">{footer}</p> : null}
    </div>
  );
}
