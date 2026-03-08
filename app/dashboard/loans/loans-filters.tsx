"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { LoanBranchOption } from "@/app/dashboard/loans/types";

type LoansFiltersProps = {
  selectedBranchId: number | null;
  branches: LoanBranchOption[];
};

export function LoansFilters({ selectedBranchId, branches }: LoansFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [branchId, setBranchId] = useState(selectedBranchId ? String(selectedBranchId) : "");

  function applyFilters() {
    const params = new URLSearchParams();
    if (branchId) {
      params.set("branchId", branchId);
    }
    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      router.replace(nextUrl);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="branchId">
            Branch
          </label>
          <select
            className="border-input w-full rounded-md border px-3 py-2 text-sm"
            disabled={isPending}
            id="branchId"
            onChange={(event) => setBranchId(event.target.value)}
            value={branchId}
          >
            <option value="">All allowed branches</option>
            {branches.map((item) => (
              <option key={item.branch_id} value={item.branch_id}>
                {item.branch_name}
              </option>
            ))}
          </select>
        </div>
        <Button className="active:scale-[0.98]" disabled={isPending} onClick={applyFilters} type="button">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isPending ? "Applying..." : "Apply"}
        </Button>
      </div>
      {isPending ? <p className="text-muted-foreground text-sm">Updating loan records...</p> : null}
    </div>
  );
}
