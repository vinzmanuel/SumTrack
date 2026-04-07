"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ManageUserAccountsSort } from "@/app/dashboard/manage-user-accounts/types";

const SORT_OPTIONS: Array<{ value: ManageUserAccountsSort; label: string }> = [
  { value: "date_created_asc", label: "Date Created Asc" },
  { value: "date_created_desc", label: "Date Created Desc" },
  { value: "role_asc", label: "Role Asc" },
  { value: "role_desc", label: "Role Desc" },
];

function sortLabel(sort: ManageUserAccountsSort) {
  return SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Role Asc";
}

export function ManageUserAccountsSortControl({
  onSortChange,
  selectedSort,
}: {
  onSortChange: (sort: ManageUserAccountsSort) => void;
  selectedSort: ManageUserAccountsSort;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div className="relative inline-flex flex-col gap-1.5" ref={containerRef}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          aria-expanded={open}
          aria-haspopup="menu"
          className="rounded-lg border-border/80"
          onClick={() => setOpen((previous) => !previous)}
          size="sm"
          type="button"
          variant="outline"
        >
          <ArrowUpDown className="mr-2 h-4 w-4" />
          Sort
        </Button>
        <span className="text-sm text-muted-foreground">Sorted by {sortLabel(selectedSort)}</span>
      </div>

      {open ? (
        <div
          className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-border/80 bg-background p-1.5 shadow-lg"
          role="menu"
        >
          {SORT_OPTIONS.map((option) => {
            const isSelected = option.value === selectedSort;

            return (
              <button
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  isSelected ? "bg-muted text-foreground" : "text-foreground hover:bg-muted/70"
                }`}
                key={option.value}
                onClick={() => {
                  onSortChange(option.value);
                  setOpen(false);
                }}
                role="menuitemradio"
                aria-checked={isSelected}
                type="button"
              >
                <span>{option.label}</span>
                {isSelected ? <Check className="h-4 w-4 text-muted-foreground" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
