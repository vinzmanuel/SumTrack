import { cn } from "@/lib/utils";

export function TremorCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("rounded-xl border bg-card p-4 shadow-sm", className)}>{children}</div>;
}

export function TremorTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <p className={cn("text-sm font-medium text-muted-foreground", className)}>{children}</p>;
}

export function TremorMetric({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <p className={cn("mt-1 text-2xl font-semibold tracking-tight", className)}>{children}</p>;
}

export function TremorDescription({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <p className={cn("text-sm text-muted-foreground", className)}>{children}</p>;
}
