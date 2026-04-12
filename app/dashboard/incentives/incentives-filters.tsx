"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import {
  UI_CONTROL_CLASS_NAME,
  UI_FILTER_CONTROLS_NO_SEARCH_CLASS_NAME,
  UI_FILTER_ROW_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";
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
  action?: ReactNode;
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
  action = null,
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

  return (
    <div className="flex flex-col gap-3">
      <div className={UI_FILTER_ROW_CLASS_NAME}>
        <div className={UI_FILTER_CONTROLS_NO_SEARCH_CLASS_NAME}>
          {canChooseBranch ? (
            <Select disabled={isPending} onValueChange={setBranch} value={branch}>
              <SelectTrigger
                aria-label="Branch"
                className={`${UI_CONTROL_CLASS_NAME} w-full min-w-[180px] sm:w-[190px]`}
              >
                <SelectValue placeholder={allBranchLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Branch</SelectLabel>
                  <SelectItem value="all">{allBranchLabel}</SelectItem>
                  {branches.map((item) => (
                    <SelectItem key={item.branch_id} value={String(item.branch_id)}>
                      {item.branch_name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <Input
              aria-label="Branch"
              className={`${UI_CONTROL_CLASS_NAME} w-full min-w-[180px] sm:w-[190px]`}
              readOnly
              value={fixedBranchName ?? "N/A"}
            />
          )}

          <Input
            aria-label="Month"
            className={`${UI_CONTROL_CLASS_NAME} w-full min-w-[180px] sm:w-[190px]`}
            disabled={isPending}
            onChange={(event) => setMonth(event.target.value)}
            type="month"
            value={month}
          />
          {isPending ? (
            <Button className={`${UI_CONTROL_CLASS_NAME} px-4`} disabled type="button" variant="outline">
              <Loader2 className="animate-spin" data-icon="inline-start" />
              Updating
            </Button>
          ) : (
            <Button asChild className={`${UI_CONTROL_CLASS_NAME} px-4`} type="button" variant="outline">
              <Link href={clearHref}>Clear</Link>
            </Button>
          )}
        </div>
        {action ? <div className="flex w-full justify-start xl:w-auto xl:justify-end">{action}</div> : null}
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
