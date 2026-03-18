"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AreaDeleteButton } from "@/app/dashboard/branches/area-delete-button";
import { AreaStatusButton } from "@/app/dashboard/branches/area-status-button";
import { BranchCreateAreaDialog } from "@/app/dashboard/branches/branch-create-area-dialog";
import { BranchEditAreaDialog } from "@/app/dashboard/branches/branch-edit-area-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { BranchAreasTabData } from "@/app/dashboard/branches/types";

const PAGE_SIZE = 8;

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
  canCreateAreas,
  canEditAreas,
  data,
  isBranchActive,
}: {
  branchCode: string;
  canCreateAreas: boolean;
  canEditAreas: boolean;
  data: BranchAreasTabData;
  isBranchActive: boolean;
}) {
  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState<"active" | "inactive">("active");
  const [page, setPage] = useState(1);

  const activeCount = useMemo(
    () => data.areas.filter((area) => area.status === "active").length,
    [data.areas],
  );
  const inactiveCount = useMemo(
    () => data.areas.filter((area) => area.status === "inactive").length,
    [data.areas],
  );

  const filteredAreas = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return data.areas
      .filter((area) => {
        if (area.status !== statusTab) {
          return false;
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
      })
      .sort((left, right) => left.areaCode.localeCompare(right.areaCode));
  }, [data.areas, query, statusTab]);

  const totalPages = Math.max(Math.ceil(filteredAreas.length / PAGE_SIZE), 1);
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredAreas.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const showingFrom = filteredAreas.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const showingTo = filteredAreas.length === 0 ? 0 : Math.min(safePage * PAGE_SIZE, filteredAreas.length);

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="p-0">
        <div className="space-y-3 px-4 pb-3 pt-3 md:px-5 md:pb-4">
          <div className="flex flex-wrap gap-2">
            <Button
              className={statusTab === "active" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : ""}
              onClick={() => {
                setStatusTab("active");
                setPage(1);
              }}
              type="button"
              variant="outline"
            >
              Active ({activeCount})
            </Button>
            <Button
              className={statusTab === "inactive" ? "bg-zinc-100 text-zinc-700 hover:bg-zinc-200" : ""}
              onClick={() => {
                setStatusTab("inactive");
                setPage(1);
              }}
              type="button"
              variant="outline"
            >
              Inactive ({inactiveCount})
            </Button>
          </div>

          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
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

            {canCreateAreas ? (
              <div className="flex justify-end">
                <BranchCreateAreaDialog branchCode={branchCode} />
              </div>
            ) : null}
          </div>

          {!isBranchActive && canEditAreas ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This branch is inactive. Existing areas remain visible, but new areas cannot be created until the branch is reactivated.
            </div>
          ) : null}
        </div>

        <div className="border-t border-border/70 px-4 pb-4 pt-3 md:px-5 md:pb-5">
          {pageRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/15 px-5 py-10 text-center">
              <p className="text-sm font-medium text-foreground">
                No {statusTab} areas match the current branch search.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try another area code, description, or collector search term.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1220px] text-sm">
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
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">{row.areaCode}</p>
                              <Badge
                                className={
                                  row.status === "active"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-zinc-300 bg-zinc-100 text-zinc-700"
                                }
                                variant="outline"
                              >
                                {row.status === "active" ? "Active" : "Inactive"}
                              </Badge>
                            </div>
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
                          {canEditAreas ? (
                            <div className="flex flex-wrap gap-2">
                              <BranchEditAreaDialog
                                areaCode={row.areaCode}
                                areaId={row.areaId}
                                branchCode={branchCode}
                                description={row.description}
                              />
                              <AreaStatusButton
                                areaCode={row.areaCode}
                                areaId={row.areaId}
                                branchCode={branchCode}
                                status={row.status}
                              />
                              <AreaDeleteButton
                                areaCode={row.areaCode}
                                areaId={row.areaId}
                                branchCode={branchCode}
                              />
                            </div>
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
                  <span className="text-muted-foreground">
                    Page {safePage} of {totalPages}
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
