"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COLLECTOR_PROFILE_PERIOD_OPTIONS } from "@/app/dashboard/collectors/profile-filters";
import type { CollectorProfilePeriodKey } from "@/app/dashboard/collectors/types";

export function CollectorProfileFilters({
  period,
  onPeriodChange,
}: {
  period: CollectorProfilePeriodKey;
  onPeriodChange: (period: CollectorProfilePeriodKey) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Period</p>
        <p className="text-xs text-muted-foreground">
          Period-based cards and charts update from this filter. Lifetime metrics stay in their own section.
        </p>
      </div>

      <Select onValueChange={(value) => onPeriodChange(value as CollectorProfilePeriodKey)} value={period}>
        <SelectTrigger className="w-full min-w-52 sm:w-56">
          <SelectValue placeholder="Select period" />
        </SelectTrigger>
        <SelectContent>
          {COLLECTOR_PROFILE_PERIOD_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
