"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ExpenseBranchOption } from "@/app/dashboard/expenses/types";

type ExpensesFiltersProps = {
  canChooseBranch: boolean;
  selectedBranchRaw: string;
  selectedMonthRaw: string;
  selectedCategory: string;
  branches: ExpenseBranchOption[];
  categories: readonly string[];
  clearHref: string;
};

export function ExpensesFilters({
  canChooseBranch,
  selectedBranchRaw,
  selectedMonthRaw,
  selectedCategory,
  branches,
  categories,
  clearHref,
}: ExpensesFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [branch, setBranch] = useState(selectedBranchRaw);
  const [month, setMonth] = useState(selectedMonthRaw);
  const [category, setCategory] = useState(selectedCategory);

  function applyFilters() {
    const params = new URLSearchParams();
    if (canChooseBranch && branch && branch !== "all") params.set("branch", branch);
    if (month) params.set("month", month);
    if (category && category !== "all") params.set("category", category);
    params.set("page", "1");
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
              <option value="all">All branches</option>
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

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="category">
            Category
          </label>
          <select
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
            disabled={isPending}
            id="category"
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            <option value="all">All categories</option>
            {categories.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2">
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
      {isPending ? <p className="text-muted-foreground text-sm">Updating expense records...</p> : null}
    </div>
  );
}
