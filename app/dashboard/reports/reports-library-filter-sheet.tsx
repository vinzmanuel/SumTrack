"use client";

import { useMemo, useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxInput,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REPORTS_DATE_RANGE_PRESET_OPTIONS,
  isReportsCustomDatePreset,
  resolveReportsDatePresetRange,
} from "@/app/dashboard/reports/date-range-presets";
import { createDefaultReportsLibraryFilters } from "@/app/dashboard/reports/filters";
import type {
  ReportsBranchOption,
  ReportsDateRangePreset,
  ReportsLibraryFilterState,
  ReportsLibraryGeneratedByFilterOption,
  ReportsLibraryGeneratedByRoleFilterOption,
  ReportsLibraryTemplateCategoryFilterOption,
  ReportsLibraryTemplateFilterOption,
  ReportsTemplateCategoryKey,
} from "@/app/dashboard/reports/types";

type BranchComboboxOption = {
  branchId: number;
  branchName: string;
};

type GeneratedByComboboxOption = {
  userId: string;
  displayName: string;
};

function FilterSection(props: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-muted/10 p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{props.title}</h3>
        <p className="text-sm text-muted-foreground">{props.description}</p>
      </div>
      {props.children}
    </section>
  );
}

function BranchMultiCombobox(props: {
  options: ReportsBranchOption[];
  value: number[];
  onChange: (value: number[]) => void;
}) {
  const anchorRef = useComboboxAnchor();
  const comboboxOptions = useMemo<BranchComboboxOption[]>(
    () =>
      props.options.map((option) => ({
        branchId: option.branchId,
        branchName: option.branchName,
      })),
    [props.options],
  );
  const selectedOptions = comboboxOptions.filter((option) =>
    props.value.includes(option.branchId),
  );

  return (
    <Combobox
      items={comboboxOptions}
      isItemEqualToValue={(item, value) => item.branchId === value.branchId}
      itemToStringLabel={(item) => item.branchName}
      itemToStringValue={(item) => String(item.branchId)}
      multiple
      onValueChange={(nextValue) =>
        props.onChange(
          Array.isArray(nextValue)
            ? (nextValue as BranchComboboxOption[])
                .map((item) => item.branchId)
                .filter((value) => Number.isInteger(value))
            : [],
        )
      }
      value={selectedOptions}
    >
      <ComboboxChips className="bg-background" ref={anchorRef}>
        {selectedOptions.map((option) => (
          <ComboboxChip key={option.branchId}>
            <ComboboxValue>{option.branchName}</ComboboxValue>
          </ComboboxChip>
        ))}
        <ComboboxChipsInput className="min-w-28" placeholder="Search and select branches" />
      </ComboboxChips>
      <ComboboxContent
        anchor={anchorRef}
        className="z-[100] max-h-72"
      >
        <ComboboxEmpty>No branches found.</ComboboxEmpty>
        <ComboboxList>
          {(item: BranchComboboxOption) => (
            <ComboboxItem key={item.branchId} value={item}>
              {item.branchName}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function GeneratedByCombobox(props: {
  options: ReportsLibraryGeneratedByFilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const comboboxOptions = useMemo<GeneratedByComboboxOption[]>(
    () =>
      props.options.map((option) => ({
        userId: option.userId,
        displayName: option.displayName,
      })),
    [props.options],
  );
  const selectedOption =
    comboboxOptions.find((option) => option.userId === props.value) ?? null;

  return (
    <Combobox
      items={comboboxOptions}
      isItemEqualToValue={(item, value) => item.userId === value.userId}
      itemToStringLabel={(item) => item.displayName}
      itemToStringValue={(item) => item.userId}
      onValueChange={(nextValue) =>
        props.onChange((nextValue as GeneratedByComboboxOption | null)?.userId ?? null)
      }
      value={selectedOption}
    >
      <ComboboxInput placeholder="Search by name or company ID" showClear />
      <ComboboxContent
        className="z-[100] max-h-72"
      >
        <ComboboxEmpty>No users found.</ComboboxEmpty>
        <ComboboxList>
          {(item: GeneratedByComboboxOption) => (
            <ComboboxItem key={item.userId} value={item}>
              {item.displayName}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

function DatePresetSelect(props: {
  value: ReportsDateRangePreset;
  onChange: (value: ReportsDateRangePreset) => void;
  triggerId: string;
}) {
  return (
    <Select onValueChange={(value) => props.onChange(value as ReportsDateRangePreset)} value={props.value}>
      <SelectTrigger id={props.triggerId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {REPORTS_DATE_RANGE_PRESET_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ReportsLibraryFilterSheet(props: {
  filters: ReportsLibraryFilterState;
  templateCategoryOptions: ReportsLibraryTemplateCategoryFilterOption[];
  templateOptions: ReportsLibraryTemplateFilterOption[];
  generatedByRoleOptions: ReportsLibraryGeneratedByRoleFilterOption[];
  generatedByOptions: ReportsLibraryGeneratedByFilterOption[];
  branchOptions: ReportsBranchOption[];
  onApply: (filters: ReportsLibraryFilterState) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ReportsLibraryFilterState>(props.filters);
  const filteredTemplateOptions = useMemo(
    () =>
      draftFilters.templateCategory
        ? props.templateOptions.filter(
            (option) => option.templateCategory === draftFilters.templateCategory,
          )
        : props.templateOptions,
    [draftFilters.templateCategory, props.templateOptions],
  );

  const resetDraft = () => {
    setDraftFilters({
      ...createDefaultReportsLibraryFilters(),
      category: props.filters.category,
      status: props.filters.status,
    });
  };
  const showOwnershipSection = draftFilters.generatedType !== "system";

  return (
    <>
      <Sheet
        modal={false}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setDraftFilters(props.filters);
          }

          setOpen(nextOpen);
        }}
        open={open}
      >
        {open ? (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px]"
          />
        ) : null}
        <SheetTrigger asChild>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Advanced Filters
          </Button>
        </SheetTrigger>
        <SheetContent
          className="fixed inset-y-0 right-0 left-auto flex h-[100dvh] max-h-[100dvh] w-full max-w-xl translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-y-0 border-r-0 border-l p-0 sm:max-w-xl"
          onOpenAutoFocus={(event) => event.preventDefault()}
          side="right"
          showCloseButton={false}
        >
          <SheetHeader className="shrink-0 border-b border-border/70 px-6 py-5 text-left">
            <SheetTitle>Advanced Filters</SheetTitle>
            <SheetDescription>
              Refine the Reports Library by report details, ownership, scope, and saved date ranges.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6 pb-6">
              <FilterSection
                description="Narrow the library by report template and how the saved report was generated."
                title="Report Details"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="reports-filter-template-category">Category</Label>
                    <Select
                      onValueChange={(value) =>
                        setDraftFilters((current) => ({
                          ...current,
                          templateCategory:
                            value === "__all__" ? null : (value as ReportsTemplateCategoryKey),
                          templateKey:
                            value === "__all__"
                              ? current.templateKey
                              : props.templateOptions.some(
                                    (option) =>
                                      option.templateKey === current.templateKey &&
                                      option.templateCategory === value,
                                  )
                                ? current.templateKey
                                : null,
                        }))
                      }
                      value={draftFilters.templateCategory ?? "__all__"}
                    >
                      <SelectTrigger id="reports-filter-template-category">
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All categories</SelectItem>
                        {props.templateCategoryOptions.map((option) => (
                          <SelectItem key={option.key} value={option.key}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reports-filter-template">Report Template</Label>
                    <Select
                      onValueChange={(value) =>
                        setDraftFilters((current) => ({
                          ...current,
                          templateKey: value === "__all__" ? null : value,
                        }))
                      }
                      value={draftFilters.templateKey ?? "__all__"}
                    >
                      <SelectTrigger id="reports-filter-template">
                        <SelectValue placeholder="All templates" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All templates</SelectItem>
                        {filteredTemplateOptions.map((option) => (
                          <SelectItem key={option.templateKey} value={option.templateKey}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="reports-filter-generated-type">Generated Type</Label>
                    <Select
                      onValueChange={(value) =>
                        setDraftFilters((current) => ({
                          ...current,
                          generatedType: value as ReportsLibraryFilterState["generatedType"],
                          generatedByRoleName: value === "system" ? null : current.generatedByRoleName,
                          generatedByUserId: value === "system" ? null : current.generatedByUserId,
                        }))
                      }
                      value={draftFilters.generatedType}
                    >
                      <SelectTrigger id="reports-filter-generated-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All generated types</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </FilterSection>

              {showOwnershipSection ? (
                <FilterSection
                  description={
                    draftFilters.generatedType === "all"
                      ? "Ownership filters apply to user-generated reports. Use Generated Type = User for the clearest narrowing."
                      : "Refine user-generated reports by role and the specific person who created them."
                  }
                  title="Ownership"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="reports-filter-generated-by-role">Role</Label>
                      <Select
                        onValueChange={(value) =>
                          setDraftFilters((current) => ({
                            ...current,
                            generatedByRoleName: value === "__all__" ? null : value,
                            generatedByUserId:
                              value === "__all__"
                                ? current.generatedByUserId
                                : props.generatedByOptions.some(
                                      (option) =>
                                        option.userId === current.generatedByUserId &&
                                        option.roleName === value,
                                    )
                                  ? current.generatedByUserId
                                  : null,
                          }))
                        }
                        value={draftFilters.generatedByRoleName ?? "__all__"}
                      >
                        <SelectTrigger id="reports-filter-generated-by-role">
                          <SelectValue placeholder="All visible roles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">All visible roles</SelectItem>
                          {props.generatedByRoleOptions.map((option) => (
                            <SelectItem key={option.roleName} value={option.roleName}>
                              {option.roleName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Generated By</Label>
                      <GeneratedByCombobox
                        onChange={(value) =>
                          setDraftFilters((current) => ({
                            ...current,
                            generatedByUserId: value,
                          }))
                        }
                        options={
                          draftFilters.generatedByRoleName
                            ? props.generatedByOptions.filter(
                                (option) => option.roleName === draftFilters.generatedByRoleName,
                              )
                            : props.generatedByOptions
                        }
                        value={draftFilters.generatedByUserId}
                      />
                    </div>
                  </div>
                </FilterSection>
              ) : null}

              <FilterSection
                description="Keep branch options inside the branches you are already allowed to access."
                title="Branch / Scope"
              >
                <div className="space-y-2">
                  <Label>Branch</Label>
                  <BranchMultiCombobox
                    onChange={(branchIds) =>
                      setDraftFilters((current) => ({
                        ...current,
                        branchIds,
                      }))
                    }
                    options={props.branchOptions}
                    value={draftFilters.branchIds}
                  />
                  <p className="text-xs text-muted-foreground">
                    Only branches inside your visible scope are shown here.
                  </p>
                </div>
              </FilterSection>

              <FilterSection
                description="Filter by the date a report was generated and the saved coverage period captured in the report row."
                title="Dates"
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Generated Date Range</p>
                      <p className="text-xs text-muted-foreground">
                        Applies to the saved `generated_at` timestamp.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reports-filter-generated-date-preset">Range</Label>
                      <DatePresetSelect
                        onChange={(value) =>
                          setDraftFilters((current) => {
                            const resolved = resolveReportsDatePresetRange(value);

                            return {
                              ...current,
                              generatedDatePreset: value,
                              generatedDateFrom: resolved.dateFrom,
                              generatedDateTo: resolved.dateTo,
                            };
                          })
                        }
                        triggerId="reports-filter-generated-date-preset"
                        value={draftFilters.generatedDatePreset}
                      />
                    </div>
                    {isReportsCustomDatePreset(draftFilters.generatedDatePreset) ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="reports-filter-generated-from">From</Label>
                          <Input
                            id="reports-filter-generated-from"
                            onChange={(event) =>
                              setDraftFilters((current) => ({
                                ...current,
                                generatedDateFrom: event.target.value || null,
                              }))
                            }
                            type="date"
                            value={draftFilters.generatedDateFrom ?? ""}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="reports-filter-generated-to">To</Label>
                          <Input
                            id="reports-filter-generated-to"
                            onChange={(event) =>
                              setDraftFilters((current) => ({
                                ...current,
                                generatedDateTo: event.target.value || null,
                              }))
                            }
                            type="date"
                            value={draftFilters.generatedDateTo ?? ""}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Coverage Date Range</p>
                      <p className="text-xs text-muted-foreground">
                        Applies to saved `date_from` and `date_to` coverage on report rows.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reports-filter-coverage-date-preset">Range</Label>
                      <DatePresetSelect
                        onChange={(value) =>
                          setDraftFilters((current) => {
                            const resolved = resolveReportsDatePresetRange(value);

                            return {
                              ...current,
                              coverageDatePreset: value,
                              coverageDateFrom: resolved.dateFrom,
                              coverageDateTo: resolved.dateTo,
                            };
                          })
                        }
                        triggerId="reports-filter-coverage-date-preset"
                        value={draftFilters.coverageDatePreset}
                      />
                    </div>
                    {isReportsCustomDatePreset(draftFilters.coverageDatePreset) ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="reports-filter-coverage-from">From</Label>
                          <Input
                            id="reports-filter-coverage-from"
                            onChange={(event) =>
                              setDraftFilters((current) => ({
                                ...current,
                                coverageDateFrom: event.target.value || null,
                              }))
                            }
                            type="date"
                            value={draftFilters.coverageDateFrom ?? ""}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="reports-filter-coverage-to">To</Label>
                          <Input
                            id="reports-filter-coverage-to"
                            onChange={(event) =>
                              setDraftFilters((current) => ({
                                ...current,
                                coverageDateTo: event.target.value || null,
                              }))
                            }
                            type="date"
                            value={draftFilters.coverageDateTo ?? ""}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </FilterSection>
            </div>
          </div>

          <div className="sticky bottom-0 shrink-0 border-t border-border/70 bg-background px-6 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <Button onClick={resetDraft} type="button" variant="outline">
                Clear All
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <SheetClose asChild>
                  <Button type="button" variant="outline">
                    Close
                  </Button>
                </SheetClose>
                <Button
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => {
                    props.onApply(draftFilters);
                    setOpen(false);
                  }}
                  type="button"
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
