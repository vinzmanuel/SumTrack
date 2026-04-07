"use client";

import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/app/dashboard/_components/theme-toggle";
import type { DashboardHeaderConfig } from "@/app/dashboard/_components/dashboard-header-config";

type DashboardPageHeaderProps = {
  title: string;
  config?: DashboardHeaderConfig | null;
};

export function DashboardPageHeader({ title, config }: DashboardPageHeaderProps) {
  const resolvedTitle = config?.title ?? title;
  const hasRichHeader = Boolean(config?.description || config?.icon || config?.action);

  return (
    <div className="border-b bg-card">
      <div
        className={cn(
          "flex min-h-14 items-center gap-3 px-3 py-3 md:px-4",
          hasRichHeader ? "px-5 py-4 md:h-[var(--dashboard-desktop-header-height)] md:px-5 md:py-0" : "md:h-[var(--dashboard-desktop-header-height)] md:py-0",
        )}
      >
        <div className="min-w-0 flex-1">
          {hasRichHeader ? (
            <div className="flex min-w-0 items-center gap-3">
              {config?.icon ? (
                <div className="flex shrink-0 items-center justify-center text-sidebar-foreground/65">
                  {config.icon}
                </div>
              ) : null}
              <div className="min-w-0">
                <h1 className="truncate text-base font-medium tracking-tight md:text-[1.1rem]">
                  {resolvedTitle}
                </h1>
                {config?.description ? (
                  <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground md:text-[13px]">
                    {config.description}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 items-center">
              <h1 className="truncate text-2xl font-semibold">{resolvedTitle}</h1>
            </div>
          )}
        </div>
        <div className="hidden items-center gap-3 md:flex">
          {config?.action}
          <ThemeToggle />
        </div>
      </div>
      {config?.action ? <div className="border-t px-3 py-3 md:hidden">{config.action}</div> : null}
    </div>
  );
}
