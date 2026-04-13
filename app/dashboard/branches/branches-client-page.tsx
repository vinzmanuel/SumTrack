"use client";

import { useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";
import { DashboardHeaderConfigurator } from "@/app/dashboard/_components/dashboard-header-config";
import { SegmentedStatusControl } from "@/app/dashboard/_components/segmented-status-control";
import {
  UI_CONTROL_CLASS_NAME,
  UI_FILTER_CONTROLS_CLASS_NAME,
  UI_FILTER_ROW_CLASS_NAME,
  UI_FILTER_STACK_CLASS_NAME,
  UI_PAGE_STACK_CLASS_NAME,
  UI_SEARCH_CONTAINER_CLASS_NAME,
  UI_SEARCH_ICON_CLASS_NAME,
  UI_SEARCH_INPUT_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";
import { Button } from "@/components/ui/button";
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
    <div className={UI_PAGE_STACK_CLASS_NAME}>
      <DashboardHeaderConfigurator
        config={{
          description: "Review branch coverage, staffing health, and operational load across your visible network.",
          icon: <Building2 className="size-9 text-sidebar-foreground/65" />,
          title: "Branches",
        }}
      />

      <div className={UI_FILTER_STACK_CLASS_NAME}>
        <div className={UI_FILTER_ROW_CLASS_NAME}>
          <div className={UI_SEARCH_CONTAINER_CLASS_NAME}>
            <Search className={UI_SEARCH_ICON_CLASS_NAME} />
            <Input
              className={UI_SEARCH_INPUT_CLASS_NAME}
              id="branchSearch"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search branch name, code, location, or manager"
              value={query}
            />
          </div>

          <div className={UI_FILTER_CONTROLS_CLASS_NAME}>
            <Button
              className={UI_CONTROL_CLASS_NAME}
              onClick={() => {
                setQuery("");
                setStatusFilter("active");
              }}
              type="button"
              variant="outline"
            >
              Clear
            </Button>
            {data.canCreateBranch ? <CreateBranchDialog /> : null}
          </div>
        </div>

        <SegmentedStatusControl
          onChange={setStatusFilter}
          options={[
            { value: "active", label: `Active (${activeCount})`, tone: "active" },
            { value: "inactive", label: `Inactive (${inactiveCount})`, tone: "archived" },
          ]}
          selectedValue={statusFilter}
        />

        <p className="text-sm text-muted-foreground">
          {visibleBranches.length} of {data.totalCount} branches currently in scope. {data.scopeMessage}
        </p>
      </div>

      {visibleBranches.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/80 bg-muted/15 px-5 py-10 text-center">
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
  );
}
