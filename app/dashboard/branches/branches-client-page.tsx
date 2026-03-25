"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SegmentedStatusControl } from "@/app/dashboard/_components/segmented-status-control";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CreateBranchDialog } from "@/app/dashboard/branches/create-branch-dialog";
import { BranchNetworkCard } from "@/app/dashboard/branches/branch-network-card";
import type { BranchNetworkPageData } from "@/app/dashboard/branches/types";

export function BranchesClientPage({ data }: { data: BranchNetworkPageData }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive">("active");

  const activeCount = useMemo(
    () => data.branches.filter((branch) => branch.status === "active").length,
    [data.branches],
  );
  const inactiveCount = useMemo(
    () => data.branches.filter((branch) => branch.status === "inactive").length,
    [data.branches],
  );

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

    const statusFiltered = filtered.filter((branch) => branch.status === statusFilter);

    const sorted = [...statusFiltered];
    sorted.sort((left, right) => left.branchName.localeCompare(right.branchName));

    return sorted;
  }, [data.branches, query, statusFilter]);

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
            <SegmentedStatusControl
              onChange={setStatusFilter}
              options={[
                { value: "active", label: `Active (${activeCount})`, tone: "active" },
                { value: "inactive", label: `Inactive (${inactiveCount})`, tone: "archived" },
              ]}
              selectedValue={statusFilter}
            />

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

              {data.canCreateBranch ? (
                <div className="flex w-full xl:w-auto xl:justify-end">
                  <CreateBranchDialog />
                </div>
              ) : null}
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
