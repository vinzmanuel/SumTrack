"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MoreHorizontal, Search } from "lucide-react";
import { AreaDeleteButton } from "@/app/dashboard/branches/area-delete-button";
import { AreaStatusButton } from "@/app/dashboard/branches/area-status-button";
import { BranchCreateAreaDialog } from "@/app/dashboard/branches/branch-create-area-dialog";
import { BranchEditAreaDialog } from "@/app/dashboard/branches/branch-edit-area-dialog";
import { SegmentedStatusControl } from "@/app/dashboard/_components/segmented-status-control";
import { Badge } from "@/components/ui/badge";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UI_CONTROL_CLASS_NAME,
  UI_FILTER_CONTROLS_CLASS_NAME,
  UI_FILTER_ROW_CLASS_NAME,
  UI_FILTER_STACK_CLASS_NAME,
  UI_PAGINATION_CONTAINER_CLASS_NAME,
  UI_PAGINATION_TEXT_CLASS_NAME,
  UI_SEARCH_CONTAINER_CLASS_NAME,
  UI_SEARCH_ICON_CLASS_NAME,
  UI_SEARCH_INPUT_CLASS_NAME,
  UI_TABLE_HEADER_ROW_CLASS_NAME,
  UI_TABLE_ROW_HOVER_CLASS_NAME,
  UI_TABLE_WRAPPER_CLASS_NAME,
} from "@/app/dashboard/_components/ui-patterns";
import { formatStoredDateForManila } from "@/app/dashboard/datetime";
import type { BranchAreasTabData } from "@/app/dashboard/branches/types";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  return formatStoredDateForManila(value, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function descriptionLabel(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "No area description added";
}

function rowActionItemClassName(tone: "blue" | "amber" | "red") {
  if (tone === "blue") {
    return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-blue-600 outline-hidden transition-colors hover:bg-blue-50 focus:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10 dark:focus:bg-blue-500/10";
  }

  if (tone === "amber") {
    return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-amber-600 outline-hidden transition-colors hover:bg-amber-50 focus:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10 dark:focus:bg-amber-500/10";
  }

  return "w-full cursor-pointer justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 outline-hidden transition-colors hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 dark:focus:bg-red-500/10";
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
  const [pageSize, setPageSize] = useState<number>(10);
  const [localAreas, setLocalAreas] = useState(() => data.areas);

  const activeCount = useMemo(
    () => localAreas.filter((area) => area.status === "active").length,
    [localAreas],
  );
  const inactiveCount = useMemo(
    () => localAreas.filter((area) => area.status === "inactive").length,
    [localAreas],
  );

  const filteredAreas = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return localAreas
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
  }, [localAreas, query, statusTab]);

  const totalPages = Math.max(Math.ceil(filteredAreas.length / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredAreas.slice((safePage - 1) * pageSize, safePage * pageSize);
  const showingFrom = filteredAreas.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showingTo = filteredAreas.length === 0 ? 0 : Math.min(safePage * pageSize, filteredAreas.length);

  return (
    <div className={UI_FILTER_STACK_CLASS_NAME}>
      <div className={UI_FILTER_ROW_CLASS_NAME}>
        <div className={`${UI_SEARCH_CONTAINER_CLASS_NAME} xl:w-[460px]`}>
          <Search className={UI_SEARCH_ICON_CLASS_NAME} />
          <Input
            className={UI_SEARCH_INPUT_CLASS_NAME}
            id="branchAreaSearch"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search area code, area no., description, or collector"
            value={query}
          />
        </div>

        <div className={UI_FILTER_CONTROLS_CLASS_NAME}>
          {canCreateAreas ? (
            <BranchCreateAreaDialog
              branchCode={branchCode}
              onCreated={(area) => {
                setLocalAreas((current) => [...current, area]);
                setStatusTab("active");
                setPage(1);
              }}
            />
          ) : null}
        </div>
      </div>

      <SegmentedStatusControl
        onChange={(value) => {
          setStatusTab(value as "active" | "inactive");
          setPage(1);
        }}
        options={[
          { value: "active", label: `Active (${activeCount})`, tone: "active" },
          { value: "inactive", label: `Inactive (${inactiveCount})`, tone: "archived" },
        ]}
        selectedValue={statusTab}
      />

      {!isBranchActive && canEditAreas ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This branch is inactive. Existing areas remain visible, but new areas cannot be created until the branch is reactivated.
        </div>
      ) : null}

      {pageRows.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/80 bg-muted/15 px-5 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            No {statusTab} areas match the current branch search.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try another area code, description, or collector search term.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={UI_TABLE_WRAPPER_CLASS_NAME}>
            <table className="w-full min-w-[1280px] text-sm">
                  <thead>
                    <tr className={`${UI_TABLE_HEADER_ROW_CLASS_NAME} border-b text-left`}>
                      <th className="px-4 py-3 font-medium">Area</th>
                      <th className="px-4 py-3 font-medium">Area No.</th>
                      <th className="px-4 py-3 font-medium">Assigned Collector</th>
                      <th className="px-4 py-3 font-medium">Borrowers</th>
                      <th className="px-4 py-3 font-medium">Active Loans</th>
                      <th className="px-4 py-3 font-medium">Overdue Loans</th>
                      <th className="px-4 py-3 font-medium">Collections This Month</th>
                      <th className="px-4 py-3 font-medium">Date Created</th>
                      <th className="px-4 py-3 font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr className={`${UI_TABLE_ROW_HOVER_CLASS_NAME} border-b`} key={row.areaId}>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">{row.areaCode}</p>
                              <Badge
                                className={
                                  row.status === "active"
                                    ? "rounded-md border-emerald-200 bg-emerald-50 py-1 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                                    : "rounded-md border-zinc-300 bg-zinc-100 py-1 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100"
                                }
                                variant="outline"
                              >
                                {row.status === "active" ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{descriptionLabel(row.description)}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className="rounded-md border-zinc-200 bg-zinc-50 py-1 text-zinc-700 dark:border-white/12 dark:bg-white/[0.06] dark:text-zinc-100" variant="outline">
                            {row.areaNo}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{row.assignedCollectorLabel}</td>
                        <td className="px-4 py-3">{row.borrowerCount}</td>
                        <td className="px-4 py-3">{row.activeLoanCount}</td>
                        <td className="px-4 py-3">{row.overdueLoanCount}</td>
                        <td className="px-4 py-3">{formatCurrency(row.collectionsThisMonth)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(row.dateCreated)}</td>
                    <td className="px-4 py-3 text-right">
                      {canEditAreas ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              className="h-9 w-9 rounded-md border-0 bg-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground dark:bg-transparent dark:hover:bg-white/[0.08]"
                              size="icon"
                              type="button"
                              variant="ghost"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open actions for {row.areaCode}</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44 rounded-xl p-1.5">
                            <BranchEditAreaDialog
                              areaCode={row.areaCode}
                              areaId={row.areaId}
                              branchCode={branchCode}
                              description={row.description}
                              onUpdated={(nextDescription) => {
                                setLocalAreas((current) =>
                                  current.map((area) =>
                                    area.areaId === row.areaId
                                      ? {
                                        ...area,
                                        description: nextDescription,
                                      }
                                      : area,
                                  ),
                                );
                              }}
                              trigger={<button className={rowActionItemClassName("blue")} type="button">Edit</button>}
                            />
                            <AreaStatusButton
                              areaCode={row.areaCode}
                              areaId={row.areaId}
                              branchCode={branchCode}
                              onStatusChanged={(nextStatus) => {
                                setLocalAreas((current) =>
                                  current.map((area) =>
                                    area.areaId === row.areaId
                                      ? {
                                        ...area,
                                        status: nextStatus,
                                      }
                                      : area,
                                  ),
                                );
                              }}
                              status={row.status}
                              trigger={
                                <button className={rowActionItemClassName("amber")} type="button">
                                  {row.status === "active" ? "Deactivate" : "Reactivate"}
                                </button>
                              }
                            />
                            <AreaDeleteButton
                              areaCode={row.areaCode}
                              areaId={row.areaId}
                              branchCode={branchCode}
                              onDeleted={() => {
                                setLocalAreas((current) =>
                                  current.filter((area) => area.areaId !== row.areaId),
                                );
                              }}
                              trigger={<button className={rowActionItemClassName("red")} type="button">Delete</button>}
                            />
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-muted-foreground">View only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={UI_PAGINATION_CONTAINER_CLASS_NAME}>
            <div className="flex flex-col gap-3 text-sm xl:flex-row xl:items-center xl:justify-between">
              <p className={UI_PAGINATION_TEXT_CLASS_NAME}>
                Showing {showingFrom}-{showingTo} of {filteredAreas.length}
              </p>
              <div className="flex flex-wrap items-center gap-2 xl:justify-center">
                <div className="flex items-center gap-2">
                  <span className={UI_PAGINATION_TEXT_CLASS_NAME}>Rows</span>
                  <Select
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setPage(1);
                    }}
                    value={String(pageSize)}
                  >
                    <SelectTrigger className={`${UI_CONTROL_CLASS_NAME} w-[84px]`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Rows</SelectLabel>
                        {PAGE_SIZE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="ml-4 flex items-center gap-2">
                  <span className={UI_PAGINATION_TEXT_CLASS_NAME}>
                    Page {safePage} of {totalPages}
                  </span>
                  <Button
                    className="h-9 w-9 rounded-md"
                    disabled={safePage <= 1}
                    onClick={() => setPage((current) => Math.max(current - 1, 1))}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="sr-only">Previous page</span>
                  </Button>
                  <Button
                    className="h-9 w-9 rounded-md"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span className="sr-only">Next page</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
