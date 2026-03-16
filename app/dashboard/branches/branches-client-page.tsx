"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BranchNetworkCard } from "@/app/dashboard/branches/branch-network-card";
import type { BranchNetworkPageData } from "@/app/dashboard/branches/types";

type BranchSort = "name_asc" | "name_desc" | "collections_desc" | "overdue_desc";

const SORT_LABELS: Record<BranchSort, string> = {
  name_asc: "Branch Name A-Z",
  name_desc: "Branch Name Z-A",
  collections_desc: "Collections This Month",
  overdue_desc: "Overdue Loans",
};

export function BranchesClientPage({ data }: { data: BranchNetworkPageData }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<BranchSort>("name_asc");

  const visibleBranches = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? data.branches.filter((branch) => {
          const haystack = [
            branch.branchName,
            branch.branchCode,
            branch.municipalityName,
            branch.provinceName,
            branch.branchAddress,
            branch.managerName ?? "",
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(normalizedQuery);
        })
      : data.branches;

    const sorted = [...filtered];
    sorted.sort((left, right) => {
      if (sort === "name_desc") {
        return right.branchName.localeCompare(left.branchName);
      }

      if (sort === "collections_desc") {
        return right.collectionsThisMonth - left.collectionsThisMonth || left.branchName.localeCompare(right.branchName);
      }

      if (sort === "overdue_desc") {
        return right.overdueLoanCount - left.overdueLoanCount || left.branchName.localeCompare(right.branchName);
      }

      return left.branchName.localeCompare(right.branchName);
    });

    return sorted;
  }, [data.branches, query, sort]);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">Branch Network</h2>
        <p className="text-sm text-muted-foreground">
          {visibleBranches.length} of {data.totalCount} branches currently in scope.
        </p>
      </div>

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardContent className="p-0">
          <div className="space-y-4 px-4 pb-4 pt-3 md:px-5 md:pb-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-medium" htmlFor="branchSearch">
                  Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    id="branchSearch"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search branch name, code, location, or manager"
                    value={query}
                  />
                </div>
              </div>

              <div className="w-full space-y-1 sm:w-60">
                <label className="text-sm font-medium" htmlFor="branchSort">
                  Sort
                </label>
                <Select onValueChange={(value) => setSort(value as BranchSort)} value={sort}>
                  <SelectTrigger className="w-full" id="branchSort">
                    <SelectValue placeholder="Select sort" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {(Object.entries(SORT_LABELS) as Array<[BranchSort, string]>).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">{data.scopeMessage}</p>
          </div>

          <div className="border-t border-border/70 px-4 pb-4 pt-4 md:px-5 md:pb-5">
            {visibleBranches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/15 px-5 py-10 text-center">
                <p className="text-sm font-medium text-foreground">No branches match the current search.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try another branch name, code, location, or manager.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleBranches.map((branch) => (
                  <BranchNetworkCard branch={branch} key={branch.branchId} />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
