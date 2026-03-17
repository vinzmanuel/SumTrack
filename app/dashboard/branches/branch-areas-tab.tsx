"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import { BranchCreateAreaDialog } from "@/app/dashboard/branches/branch-create-area-dialog";
import { BranchEditAreaDialog } from "@/app/dashboard/branches/branch-edit-area-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BranchAreasTabData } from "@/app/dashboard/branches/types";

const PAGE_SIZE = 8;

type AreaSort = "area_code_asc" | "borrowers_desc" | "active_loans_desc" | "collections_desc";

const SORT_LABELS: Record<AreaSort, string> = {
  area_code_asc: "Area Code A-Z",
  borrowers_desc: "Borrowers",
  active_loans_desc: "Active Loans",
  collections_desc: "Collections This Month",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

function descriptionLabel(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "No area description added";
}

export function BranchAreasTab({
  branchCode,
  canManageAreas,
  data,
}: {
  branchCode: string;
  canManageAreas: boolean;
  data: BranchAreasTabData;
}) {
  const [query, setQuery] = useState("");
  const [collectorFilter, setCollectorFilter] = useState("all");
  const [sort, setSort] = useState<AreaSort>("area_code_asc");
  const [page, setPage] = useState(1);

  const collectorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          data.areas.flatMap((area) => (area.assignedCollectorNames.length > 0 ? area.assignedCollectorNames : ["Unassigned"])),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [data.areas],
  );

  const filteredAreas = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const rows = data.areas.filter((area) => {
      if (collectorFilter !== "all") {
        const matchesCollector =
          collectorFilter === "Unassigned"
            ? area.assignedCollectorNames.length === 0
            : area.assignedCollectorNames.includes(collectorFilter);

        if (!matchesCollector) {
          return false;
        }
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        area.areaCode,
        area.areaNo,
        area.description ?? "",
        area.assignedCollectorLabel,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    const sorted = [...rows];
    sorted.sort((left, right) => {
      if (sort === "borrowers_desc") {
        return right.borrowerCount - left.borrowerCount || left.areaCode.localeCompare(right.areaCode);
      }

      if (sort === "active_loans_desc") {
        return right.activeLoanCount - left.activeLoanCount || left.areaCode.localeCompare(right.areaCode);
      }

      if (sort === "collections_desc") {
        return right.collectionsThisMonth - left.collectionsThisMonth || left.areaCode.localeCompare(right.areaCode);
      }

      return left.areaCode.localeCompare(right.areaCode);
    });

    return sorted;
  }, [collectorFilter, data.areas, query, sort]);

  const totalPages = Math.max(Math.ceil(filteredAreas.length / PAGE_SIZE), 1);
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredAreas.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const showingFrom = filteredAreas.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const showingTo = filteredAreas.length === 0 ? 0 : Math.min(safePage * PAGE_SIZE, filteredAreas.length);

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="p-0">
        <div className="space-y-3 px-4 pb-3 pt-3 md:px-5 md:pb-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 xl:flex-row xl:items-end">
              <div className="flex-1 space-y-1">
                <label className="text-sm font-medium" htmlFor="branchAreaSearch">
                  Search
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    id="branchAreaSearch"
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search area code, area no., description, or collector"
                    value={query}
                  />
                </div>
              </div>

              <div className="w-full space-y-1 sm:w-56">
                <label className="text-sm font-medium" htmlFor="branchAreaCollector">
                  Collector
                </label>
                <Select
                  onValueChange={(value) => {
                    setCollectorFilter(value);
                    setPage(1);
                  }}
                  value={collectorFilter}
                >
                  <SelectTrigger className="w-full" id="branchAreaCollector">
                    <SelectValue placeholder="All collectors" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="all">All collectors</SelectItem>
                    {collectorOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full space-y-1 sm:w-56">
                <label className="text-sm font-medium" htmlFor="branchAreaSort">
                  Sort
                </label>
                <Select
                  onValueChange={(value) => {
                    setSort(value as AreaSort);
                    setPage(1);
                  }}
                  value={sort}
                >
                  <SelectTrigger className="w-full" id="branchAreaSort">
                    <SelectValue placeholder="Sort areas" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {(Object.entries(SORT_LABELS) as Array<[AreaSort, string]>).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {canManageAreas ? (
              <div className="flex justify-end">
                <BranchCreateAreaDialog branchCode={branchCode} />
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-border/70 px-4 pb-4 pt-3 md:px-5 md:pb-5">
          {pageRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/15 px-5 py-10 text-center">
              <p className="text-sm font-medium text-foreground">No areas match the current branch filters.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another area code, collector filter, or sort order.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-2 py-2.5 font-medium">Area</th>
                      <th className="px-2 py-2.5 font-medium">Area No.</th>
                      <th className="px-2 py-2.5 font-medium">Assigned Collector</th>
                      <th className="px-2 py-2.5 font-medium">Borrowers</th>
                      <th className="px-2 py-2.5 font-medium">Active Loans</th>
                      <th className="px-2 py-2.5 font-medium">Overdue Loans</th>
                      <th className="px-2 py-2.5 font-medium">Collections This Month</th>
                      <th className="px-2 py-2.5 font-medium">Date Created</th>
                      <th className="px-2 py-2.5 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => (
                      <tr className="border-b" key={row.areaId}>
                        <td className="px-2 py-3">
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{row.areaCode}</p>
                            <p className="text-xs text-muted-foreground">{descriptionLabel(row.description)}</p>
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <Badge className="border-zinc-200 bg-zinc-50 text-zinc-700" variant="outline">
                            {row.areaNo}
                          </Badge>
                        </td>
                        <td className="px-2 py-3 text-muted-foreground">{row.assignedCollectorLabel}</td>
                        <td className="px-2 py-3">{row.borrowerCount}</td>
                        <td className="px-2 py-3">{row.activeLoanCount}</td>
                        <td className="px-2 py-3">{row.overdueLoanCount}</td>
                        <td className="px-2 py-3">{formatCurrency(row.collectionsThisMonth)}</td>
                        <td className="px-2 py-3 text-muted-foreground">{formatDate(row.dateCreated)}</td>
                        <td className="px-2 py-3">
                          {canManageAreas ? (
                            <BranchEditAreaDialog
                              areaCode={row.areaCode}
                              areaId={row.areaId}
                              branchCode={branchCode}
                              description={row.description}
                            />
                          ) : (
                            <span className="text-muted-foreground">View only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t pt-3 text-sm md:flex-row md:items-center md:justify-between">
                <p className="text-muted-foreground">
                  Showing {showingFrom}-{showingTo} of {filteredAreas.length}
                </p>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <ArrowUpDown className="h-4 w-4" />
                    {SORT_LABELS[sort]}
                  </span>
                  <Button
                    disabled={safePage <= 1}
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
