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
    <label className="flex w-full flex-col gap-1 sm:w-[220px]">
      <p className="text-sm font-medium text-foreground">Period</p>
      <Select onValueChange={(value) => onPeriodChange(value as CollectorProfilePeriodKey)} value={period}>
        <SelectTrigger className="w-full">
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
    </label>
  );
}
