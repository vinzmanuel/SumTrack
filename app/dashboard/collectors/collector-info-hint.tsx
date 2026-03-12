"use client";

import Tooltip from "@mui/material/Tooltip";
import { Info } from "lucide-react";

export function CollectorInfoHint({
  label,
  help,
}: {
  label: string;
  help: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <Tooltip arrow enterDelay={120} title={<span className="text-xs leading-relaxed">{help}</span>}>
        <button
          aria-label={help}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-transparent p-0 text-muted-foreground outline-none"
          type="button"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
    </span>
  );
}
