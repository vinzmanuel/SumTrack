"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CollectorInfoHint({
  label,
  help,
}: {
  label: ReactNode;
  help: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 text-left"
          type="button"
        >
          <span>{label}</span>
          <Info className="size-3.5 text-muted-foreground" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-80 whitespace-normal rounded-xl p-3">
        {help}
      </TooltipContent>
    </Tooltip>
  );
}
