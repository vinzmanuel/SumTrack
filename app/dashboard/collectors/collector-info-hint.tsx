"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CollectorInfoHint({
  label,
  help,
}: {
  label: string;
  help: string;
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
      <TooltipContent className="max-w-72 whitespace-normal">
        {help}
      </TooltipContent>
    </Tooltip>
  );
}
