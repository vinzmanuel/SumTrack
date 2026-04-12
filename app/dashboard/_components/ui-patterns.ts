export const UI_CONTROL_CLASS_NAME =
  "!h-11 rounded-md bg-white py-0 text-sm dark:bg-background";

export const UI_SURFACE_CLASS_NAME = "rounded-md border border-border/70 bg-card shadow-sm";

export const UI_PAGE_STACK_CLASS_NAME = "space-y-4";
export const UI_FILTER_STACK_CLASS_NAME = "space-y-3";
export const UI_TABLE_AND_PAGINATION_STACK_CLASS_NAME = "space-y-4";

export const UI_SEARCH_CONTAINER_CLASS_NAME = "relative w-full xl:w-[360px] xl:shrink-0";
export const UI_SEARCH_ICON_CLASS_NAME =
  "pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground/70";
export const UI_SEARCH_INPUT_CLASS_NAME = `${UI_CONTROL_CLASS_NAME} pl-10 placeholder:text-muted-foreground/75`;

export const UI_FILTER_ROW_CLASS_NAME =
  "flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between";
export const UI_FILTER_CONTROLS_CLASS_NAME =
  "flex w-full flex-wrap items-center gap-2.5 xl:w-auto xl:justify-end";
export const UI_FILTER_CONTROLS_NO_SEARCH_CLASS_NAME =
  "flex w-full flex-wrap items-center gap-2.5 xl:justify-start";

export const UI_TAB_SEPARATOR_CLASS_NAME = "border-b-2 border-border/80";
export const UI_TAB_LIST_CLASS_NAME = "-mb-px flex flex-wrap items-center gap-6";
export const UI_TAB_TRIGGER_BASE_CLASS_NAME =
  "inline-flex h-11 items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors";
export const UI_TAB_TRIGGER_ACTIVE_CLASS_NAME = "border-[#e73c31] text-foreground";
export const UI_TAB_TRIGGER_INACTIVE_CLASS_NAME =
  "border-transparent text-muted-foreground hover:text-foreground dark:hover:text-white";
export const UI_TAB_ICON_ACTIVE_CLASS_NAME = "text-[#e73c31]";

export const UI_TABLE_WRAPPER_CLASS_NAME = "overflow-x-auto rounded-md border border-border/70 bg-card shadow-sm";
export const UI_TABLE_HEADER_ROW_CLASS_NAME = "border-border/70 bg-card";
export const UI_TABLE_ROW_HOVER_CLASS_NAME = "transition-colors hover:bg-accent/35";

export const UI_TABLE_OVERLAY_CLASS_NAME =
  "absolute inset-0 flex items-center justify-center rounded-xl bg-background/65 backdrop-blur-[1px]";
export const UI_TABLE_OVERLAY_TEXT_CLASS_NAME =
  "rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm";

export const UI_PAGINATION_CONTAINER_CLASS_NAME = "px-1";
export const UI_PAGINATION_TEXT_CLASS_NAME = "text-muted-foreground";

export function getUiRoleBadgeClassName(roleName: string | null | undefined) {
  if (roleName === "Admin") {
    return "whitespace-nowrap rounded-md border border-red-200 bg-red-50 py-1 text-red-700 hover:bg-red-50 hover:text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/10 dark:hover:text-red-300";
  }

  if (roleName === "Auditor") {
    return "whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 py-1 text-blue-700 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/10 dark:hover:text-blue-300";
  }

  if (roleName === "Branch Manager") {
    return "whitespace-nowrap rounded-md border border-amber-200 bg-amber-50 py-1 text-amber-700 hover:bg-amber-50 hover:text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/10 dark:hover:text-amber-300";
  }

  if (roleName === "Secretary") {
    return "whitespace-nowrap rounded-md border border-violet-200 bg-violet-50 py-1 text-violet-700 hover:bg-violet-50 hover:text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/10 dark:hover:text-violet-300";
  }

  if (roleName === "Collector") {
    return "whitespace-nowrap rounded-md border border-emerald-200 bg-emerald-50 py-1 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300";
  }

  if (roleName === "Borrower") {
    return "whitespace-nowrap rounded-md border border-zinc-200 bg-zinc-50 py-1 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100";
  }

  return "whitespace-nowrap rounded-md border border-zinc-200 bg-zinc-50 py-1 text-zinc-700 hover:bg-zinc-50 hover:text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100 dark:hover:bg-white/[0.06] dark:hover:text-zinc-100";
}

export function getUiTabTriggerClassName(active: boolean) {
  return `${UI_TAB_TRIGGER_BASE_CLASS_NAME} ${
    active ? UI_TAB_TRIGGER_ACTIVE_CLASS_NAME : UI_TAB_TRIGGER_INACTIVE_CLASS_NAME
  }`;
}
