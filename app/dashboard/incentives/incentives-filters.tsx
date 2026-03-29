"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IncentivesBranchOption } from "@/app/dashboard/incentives/types";
import { useIncentivesWorkspaceTransition } from "@/app/dashboard/incentives/incentives-workspace-transition";

type IncentivesFiltersProps = {
  canChooseBranch: boolean;
  selectedBranchRaw: string;
  selectedMonthRaw: string;
  branches: IncentivesBranchOption[];
  clearHref: string;
  allBranchLabel: string;
  fixedBranchName?: string | null;
  compact?: boolean;
};

export function IncentivesFilters({
  canChooseBranch,
  selectedBranchRaw,
  selectedMonthRaw,
  branches,
  clearHref,
  allBranchLabel,
  fixedBranchName = null,
  compact = false,
}: IncentivesFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const { setPending } = useIncentivesWorkspaceTransition();
  const [branch, setBranch] = useState(selectedBranchRaw);
  const [month, setMonth] = useState(selectedMonthRaw);
  const [appliedBranch, setAppliedBranch] = useState(selectedBranchRaw);
  const [appliedMonth, setAppliedMonth] = useState(selectedMonthRaw);
  const filtersRef = useRef({ branch: selectedBranchRaw, month: selectedMonthRaw });

  useEffect(() => {
    filtersRef.current = { branch, month };
  }, [branch, month]);

  useEffect(() => () => setPending(false), [setPending]);

  const isDirty = branch !== appliedBranch || month !== appliedMonth;

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextBranch = filtersRef.current.branch;
      const nextMonth = filtersRef.current.month;
      const params = new URLSearchParams();

      if (canChooseBranch && nextBranch && nextBranch !== "all") {
        params.set("branch", nextBranch);
      }
      if (nextMonth) {
        params.set("month", nextMonth);
      }

      const query = params.toString();
      const nextUrl = query ? `${pathname}?${query}` : pathname;

      setAppliedBranch(nextBranch);
      setAppliedMonth(nextMonth);
      setPending(true);
      startTransition(() => {
        router.replace(nextUrl);
      });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [canChooseBranch, isDirty, pathname, router, setPending, startTransition]);

  const branchLabelClass = useMemo(
    () => (compact ? "space-y-1" : "space-y-2"),
    [compact],
  );

  return (
    <div className="flex flex-col gap-3">
      <div
        className={
          compact
            ? "flex flex-col gap-3 lg:flex-row lg:flex-nowrap lg:items-end lg:justify-end"
            : "flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"
        }
      >
        <div
        className={
          compact
            ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,220px)_minmax(0,170px)]"
            : "grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,240px)_minmax(0,190px)]"
        }
        >
          {canChooseBranch ? (
            <label className={branchLabelClass}>
              <span className="text-sm font-medium text-foreground">Branch</span>
              <Select disabled={isPending} onValueChange={setBranch} value={branch}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={allBranchLabel} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Branches</SelectLabel>
                    <SelectItem value="all">{allBranchLabel}</SelectItem>
                    {branches.map((item) => (
                      <SelectItem key={item.branch_id} value={String(item.branch_id)}>
                        {item.branch_name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </label>
          ) : (
            <label className={branchLabelClass}>
              <span className="text-sm font-medium text-foreground">Branch</span>
              <Input readOnly value={fixedBranchName ?? "N/A"} />
            </label>
          )}

          <label className={branchLabelClass}>
            <span className="text-sm font-medium text-foreground">Month</span>
            <Input
              disabled={isPending}
              onChange={(event) => setMonth(event.target.value)}
              type="month"
              value={month}
            />
          </label>
        </div>

        <div className={compact ? "flex shrink-0 items-end gap-2 lg:flex-nowrap" : "flex flex-wrap gap-2 md:justify-end"}>
          {isPending ? (
            <Button disabled size="sm" type="button" variant="outline">
              <Loader2 className="animate-spin" data-icon="inline-start" />
              Updating
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href={clearHref}>Clear</Link>
            </Button>
          )}
        </div>
      </div>

      {!compact ? (
        isPending ? (
          <p className="text-sm text-muted-foreground">Updating incentives view...</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Adjust the branch and payout month and the workspace will update automatically.
          </p>
        )
      ) : null}
    </div>
  );
}
