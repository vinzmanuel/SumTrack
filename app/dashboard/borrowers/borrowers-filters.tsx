"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { BorrowerAreaOption, BorrowerBranchOption } from "@/app/dashboard/borrowers/types";

type BorrowersFiltersProps = {
  canChooseBranch: boolean;
  selectedBranchId: number | null;
  selectedAreaId: number | null;
  branches: BorrowerBranchOption[];
  areas: BorrowerAreaOption[];
  allBranchLabel?: string;
};

export function BorrowersFilters({
  canChooseBranch,
  selectedBranchId,
  selectedAreaId,
  branches,
  areas,
  allBranchLabel = "All branches",
}: BorrowersFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [branchId, setBranchId] = useState(selectedBranchId ? String(selectedBranchId) : "");
  const [areaId, setAreaId] = useState(selectedAreaId ? String(selectedAreaId) : "");

  function applyFilters() {
    const params = new URLSearchParams();
    if (branchId) params.set("branchId", branchId);
    if (areaId) params.set("areaId", areaId);
    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      router.replace(nextUrl);
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-3">
        {canChooseBranch ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="branchId">
              Branch
            </label>
            <select
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              disabled={isPending}
              id="branchId"
              onChange={(event) => setBranchId(event.target.value)}
              value={branchId}
            >
              <option value="">{allBranchLabel}</option>
              {branches.map((item) => (
                <option key={item.branch_id} value={String(item.branch_id)}>
                  {item.branch_name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="areaId">
            Area
          </label>
          <select
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            disabled={isPending}
            id="areaId"
            onChange={(event) => setAreaId(event.target.value)}
            value={areaId}
          >
            <option value="">All areas</option>
            {areas.map((item) => (
              <option key={item.area_id} value={String(item.area_id)}>
                {item.area_code}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2 md:col-span-3">
          <Button className="active:scale-[0.98]" disabled={isPending} onClick={applyFilters} type="button">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isPending ? "Applying..." : "Apply Filters"}
          </Button>
          <Link href="/dashboard/borrowers">
            <Button className="active:scale-[0.98]" disabled={isPending} type="button" variant="outline">
              Clear
            </Button>
          </Link>
        </div>
      </div>
      {isPending ? <p className="text-muted-foreground text-sm">Updating borrower results...</p> : null}
    </div>
  );
}
