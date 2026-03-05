"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type BranchOption = {
  branch_id: number;
  branch_name: string;
};

type IncentivesFiltersProps = {
  canChooseBranch: boolean;
  selectedBranchRaw: string;
  selectedMonthRaw: string;
  branches: BranchOption[];
  clearHref: string;
  allBranchLabel: string;
};

export function IncentivesFilters({
  canChooseBranch,
  selectedBranchRaw,
  selectedMonthRaw,
  branches,
  clearHref,
  allBranchLabel,
}: IncentivesFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [branch, setBranch] = useState(selectedBranchRaw);
  const [month, setMonth] = useState(selectedMonthRaw);

  function applyFilters() {
    const params = new URLSearchParams();
    if (canChooseBranch && branch && branch !== "all") params.set("branch", branch);
    if (month) params.set("month", month);
    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      router.replace(nextUrl);
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-4">
        {canChooseBranch ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="branch">
              Branch
            </label>
            <select
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              disabled={isPending}
              id="branch"
              onChange={(event) => setBranch(event.target.value)}
              value={branch}
            >
              <option value="all">{allBranchLabel}</option>
              {branches.map((item) => (
                <option key={item.branch_id} value={String(item.branch_id)}>
                  {item.branch_name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="month">
            Month
          </label>
          <input
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            disabled={isPending}
            id="month"
            onChange={(event) => setMonth(event.target.value)}
            type="month"
            value={month}
          />
        </div>

        <div className="flex items-end gap-2 md:col-span-4">
          <Button className="active:scale-[0.98]" disabled={isPending} onClick={applyFilters} type="button">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPending ? "Applying..." : "Apply Filters"}
          </Button>
          <Link href={clearHref}>
            <Button className="active:scale-[0.98]" disabled={isPending} type="button" variant="outline">
              Clear
            </Button>
          </Link>
        </div>
      </div>
      {isPending ? <p className="text-muted-foreground text-sm">Updating incentives view...</p> : null}
    </div>
  );
}
