"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { appendBackNavigationToHref, buildReturnTo } from "@/app/dashboard/back-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateAnalyticsReportAction } from "@/app/dashboard/reports/actions";
import {
  REPORTS_DATE_RANGE_PRESET_OPTIONS,
  isReportsCustomDatePreset,
} from "@/app/dashboard/reports/date-range-presets";
import { initialGenerateAnalyticsReportState } from "@/app/dashboard/reports/state";
import type {
  ReportsAnalyticsTemplateOption,
  ReportsBranchOption,
  ReportsCollectorOption,
  ReportsDateRangePreset,
  ReportsReadyAccessState,
  ReportsTemplateCategoryDefinition,
  ReportsTemplateCategoryKey,
} from "@/app/dashboard/reports/types";

function SubmitButton(props: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending || props.disabled} type="submit">
      {pending ? "Generating..." : "Generate and Save Report"}
    </Button>
  );
}

function currentMonthStart() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

function currentMonthValue() {
  return currentMonthStart().slice(0, 7);
}

function currentDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function templateRequiresDateMode(
  templates: ReportsAnalyticsTemplateOption[],
  key: string,
): "none" | "month" | "range" {
  return templates.find((template) => template.key === key)?.dateMode ?? "none";
}

export function AnalyticsReportGenerationForm(props: {
  access: ReportsReadyAccessState;
  branchOptions: ReportsBranchOption[];
  collectorOptions: ReportsCollectorOption[];
  analyticsTemplates: ReportsAnalyticsTemplateOption[];
  analyticsTemplateCategories: ReportsTemplateCategoryDefinition[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, formAction] = useActionState(
    generateAnalyticsReportAction,
    initialGenerateAnalyticsReportState,
  );
  const handledSuccessReportIdRef = useRef<number | null>(null);
  const currentReturnTo = buildReturnTo(pathname, searchParams);

  const initialCategory =
    props.analyticsTemplateCategories.find((category) =>
      props.analyticsTemplates.some(
        (template) => template.category === category.key && template.available,
      ),
    )?.key ??
    props.analyticsTemplateCategories[0]?.key ??
    "financials";

  const [selectedCategory, setSelectedCategory] = useState<ReportsTemplateCategoryKey>(
    initialCategory,
  );
  const effectiveSelectedCategory = props.analyticsTemplateCategories.some(
    (category) => category.key === selectedCategory,
  )
    ? selectedCategory
    : initialCategory;

  const categoryTemplates = useMemo(
    () =>
      props.analyticsTemplates.filter((template) => template.category === effectiveSelectedCategory),
    [effectiveSelectedCategory, props.analyticsTemplates],
  );
  const availableTemplates = useMemo(
    () => categoryTemplates.filter((template) => template.available),
    [categoryTemplates],
  );
  const unavailableTemplates = useMemo(
    () => categoryTemplates.filter((template) => !template.available),
    [categoryTemplates],
  );
  const allAvailableTemplates = useMemo(
    () => props.analyticsTemplates.filter((template) => template.available),
    [props.analyticsTemplates],
  );

  const [templateKey, setTemplateKey] = useState<string>(availableTemplates[0]?.key ?? "");
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(
    props.access.fixedBranchId !== null ? [String(props.access.fixedBranchId)] : [],
  );
  const [collectorId, setCollectorId] = useState("");
  const [datePreset, setDatePreset] = useState<ReportsDateRangePreset>("this_month");
  const [month, setMonth] = useState(currentMonthValue());
  const [dateFrom, setDateFrom] = useState(currentMonthStart());
  const [dateTo, setDateTo] = useState(currentDateValue());

  const effectiveTemplateKey = categoryTemplates.some((template) => template.key === templateKey)
    ? templateKey
    : availableTemplates[0]?.key ?? "";
  const dateMode = templateRequiresDateMode(props.analyticsTemplates, effectiveTemplateKey);
  const selectedTemplate =
    props.analyticsTemplates.find((template) => template.key === effectiveTemplateKey) ?? null;
  const usingFixedBranch = props.access.fixedBranchId !== null;
  const effectiveSelectedBranchIds = useMemo(
    () =>
      usingFixedBranch
        ? [String(props.access.fixedBranchId)]
        : selectedBranchIds,
    [props.access.fixedBranchId, selectedBranchIds, usingFixedBranch],
  );
  const collectorSelectionRequired = selectedTemplate?.key === "collector_performance_report";
  const filteredCollectorOptions = useMemo(() => {
    const selectedBranchIdSet = new Set(
      effectiveSelectedBranchIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    );

    if (selectedBranchIdSet.size === 0) {
      return usingFixedBranch ? props.collectorOptions : [];
    }

    return props.collectorOptions.filter((item) => selectedBranchIdSet.has(item.branchId));
  }, [effectiveSelectedBranchIds, props.collectorOptions, usingFixedBranch]);
  const effectiveCollectorId = filteredCollectorOptions.some(
    (item) => item.collectorId === collectorId,
  )
    ? collectorId
    : filteredCollectorOptions[0]?.collectorId ?? "";
  const selectedBranchCount = effectiveSelectedBranchIds.length;
  const branchSelectionError =
    selectedTemplate?.maxBranchCount === 1 && selectedBranchCount !== 1
      ? "This template requires exactly one selected branch."
      : selectedTemplate?.minBranchCount && selectedBranchCount < selectedTemplate.minBranchCount
        ? selectedTemplate.minBranchCount > 1
          ? "This template requires at least two selected branches."
          : "Select a valid branch for this template."
        : null;
  const selectedCategoryDefinition =
    props.analyticsTemplateCategories.find(
      (category) => category.key === effectiveSelectedCategory,
    ) ?? null;
  const hasAvailableTemplates = availableTemplates.length > 0 && Boolean(effectiveTemplateKey);

  useEffect(() => {
    if (state.status !== "success" || !state.result) {
      return;
    }

    if (handledSuccessReportIdRef.current === state.result.reportId) {
      return;
    }

    handledSuccessReportIdRef.current = state.result.reportId;
    toast.success(`${state.result.templateLabel} saved. Opening report...`);
    router.push(
      appendBackNavigationToHref(`/dashboard/reports/${state.result.reportId}`, {
        source: "reports-create",
        returnTo: currentReturnTo,
      }),
    );
  }, [currentReturnTo, router, state.result, state.status]);

  return (
    <Card className="mx-auto w-full max-w-3xl border-border/70 bg-background">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl">Generate Manual Analytics Report</CardTitle>
            <Badge className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800 hover:bg-emerald-50">
              PASS 2
            </Badge>
          </div>
          <CardDescription>
            Generate and save analytics snapshots into the existing reports table. Saved reports can be opened immediately from the dedicated viewer page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-6">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="template_category">Template Category</Label>
                <p className="text-xs text-muted-foreground">
                  Choose a reporting category first, then select a template inside it.
                </p>
              </div>
              <Select
                onValueChange={(value) => {
                  const nextCategory = value as ReportsTemplateCategoryKey;
                  setSelectedCategory(nextCategory);
                  const nextTemplate =
                    props.analyticsTemplates.find(
                      (template) =>
                        template.category === nextCategory && template.available,
                    )?.key ?? "";
                  setTemplateKey(nextTemplate);
                }}
                value={effectiveSelectedCategory}
              >
                <SelectTrigger className="w-full" id="template_category">
                  <SelectValue placeholder="Select template category" />
                </SelectTrigger>
                <SelectContent>
                  {props.analyticsTemplateCategories.map((category) => {
                    const availableCount = props.analyticsTemplates.filter(
                      (template) => template.category === category.key && template.available,
                    ).length;

                    return (
                      <SelectItem key={category.key} value={category.key}>
                        {category.label} {availableCount > 0 ? `(${availableCount} available)` : "(planned / unavailable)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedCategoryDefinition ? (
                <div className="rounded-md border border-dashed border-border/80 bg-muted/15 px-3 py-3 text-sm text-muted-foreground">
                  {selectedCategoryDefinition.description}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="template_key">Template</Label>
                <Select onValueChange={setTemplateKey} value={effectiveTemplateKey}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select analytics template" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTemplates.map((template) => (
                      <SelectItem key={template.key} value={template.key}>
                        {template.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input name="template_key" type="hidden" value={effectiveTemplateKey} />
                {categoryTemplates.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {categoryTemplates.length} template{categoryTemplates.length === 1 ? "" : "s"} in {selectedCategoryDefinition?.label ?? "this category"}.
                  </p>
                ) : null}
                {state.fieldErrors?.template_key ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.template_key}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Leave blank to use the default generated title"
                />
                <p className="text-xs text-muted-foreground">
                  Saved reports always need a title. If you leave this blank, the system will generate one from the template, date, and branch scope.
                </p>
                {state.fieldErrors?.title ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.title}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Branch Scope</Label>
              {usingFixedBranch ? (
                <div className="rounded-md border bg-muted/20 px-3 py-3 text-sm">
                  <p className="font-medium text-foreground">
                    {props.access.fixedBranchName ?? "Assigned branch"}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Your role is fixed to a single branch for manual analytics generation.
                  </p>
                  <input name="branch_ids" type="hidden" value={String(props.access.fixedBranchId)} />
                </div>
              ) : (
                <div className="space-y-2 rounded-md border p-3">
                  <p className="text-sm text-muted-foreground">
                    Select one or more branches within your current reporting scope.
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {props.branchOptions.map((item) => {
                      const checked = selectedBranchIds.includes(String(item.branchId));

                      return (
                        <label className="flex items-center gap-2 text-sm" key={item.branchId}>
                          <input
                            checked={checked}
                            className="h-4 w-4"
                            name="branch_ids"
                            onChange={(event) => {
                              const value = String(item.branchId);
                              setSelectedBranchIds((previous) => {
                                if (event.target.checked) {
                                  return previous.includes(value) ? previous : [...previous, value];
                                }

                                return previous.filter((branchId) => branchId !== value);
                              });
                            }}
                            type="checkbox"
                            value={String(item.branchId)}
                          />
                          <span>{item.branchName}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
                {state.fieldErrors?.branch_ids ? (
                <p className="text-sm text-destructive">{state.fieldErrors.branch_ids}</p>
              ) : null}
              {selectedTemplate?.key === "branch_performance_overview" ? (
                <p className="text-xs text-muted-foreground">
                  This template is the single-branch branch snapshot. Select exactly one branch.
                </p>
              ) : null}
              {selectedTemplate?.key === "branch_performance_comparison" ? (
                <p className="text-xs text-muted-foreground">
                  This template is the cross-branch comparison report. Select two or more branches.
                </p>
              ) : null}
              {selectedTemplate?.category === "branches" &&
              selectedTemplate.key !== "branch_performance_overview" &&
              selectedTemplate.key !== "branch_performance_comparison" ? (
                <p className="text-xs text-muted-foreground">
                  These branch comparison templates use the exact branches you choose here. Single-branch output is allowed, but 2 or more selected branches make the comparison much more useful.
                </p>
              ) : null}
              {branchSelectionError ? (
                <p className="text-sm text-destructive">{branchSelectionError}</p>
              ) : null}
            </div>

            {collectorSelectionRequired ? (
              <div className="space-y-2">
                <Label htmlFor="collector_id">Collector</Label>
                <Select onValueChange={setCollectorId} value={effectiveCollectorId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select collector" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCollectorOptions.map((collector) => (
                      <SelectItem key={collector.collectorId} value={collector.collectorId}>
                        {collector.collectorName} ({collector.companyId})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input name="collector_id" type="hidden" value={effectiveCollectorId} />
                {filteredCollectorOptions.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    This is a single-collector report. Choose the collector you want to analyze inside the selected branch scope.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No collectors are available in the currently selected branch scope.
                  </p>
                )}
                {state.fieldErrors?.collector_id ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.collector_id}</p>
                ) : null}
              </div>
            ) : null}

            {dateMode === "range" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="date_preset">Date Range</Label>
                  <Select
                    onValueChange={(value) => setDatePreset(value as ReportsDateRangePreset)}
                    value={datePreset}
                  >
                    <SelectTrigger className="w-full" id="date_preset">
                      <SelectValue placeholder="Select date range" />
                    </SelectTrigger>
                    <SelectContent>
                      {REPORTS_DATE_RANGE_PRESET_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input name="date_preset" type="hidden" value={datePreset} />
                  {state.fieldErrors?.date_preset ? (
                    <p className="text-sm text-destructive">{state.fieldErrors.date_preset}</p>
                  ) : null}
                </div>

                {isReportsCustomDatePreset(datePreset) ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="date_from">Start Date</Label>
                      <Input
                        id="date_from"
                        name="date_from"
                        onChange={(event) => setDateFrom(event.target.value)}
                        type="date"
                        value={dateFrom}
                      />
                      {state.fieldErrors?.date_from ? (
                        <p className="text-sm text-destructive">{state.fieldErrors.date_from}</p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="date_to">End Date</Label>
                      <Input
                        id="date_to"
                        name="date_to"
                        onChange={(event) => setDateTo(event.target.value)}
                        type="date"
                        value={dateTo}
                      />
                      {state.fieldErrors?.date_to ? (
                        <p className="text-sm text-destructive">{state.fieldErrors.date_to}</p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {dateMode === "month" ? (
              <div className="space-y-2">
                <Label htmlFor="month">Reporting Month</Label>
                <Input
                  id="month"
                  name="month"
                  onChange={(event) => setMonth(event.target.value)}
                  type="month"
                  value={month}
                />
                <p className="text-xs text-muted-foreground">
                  This template saves finalized historical data for a single month only.
                </p>
                {state.fieldErrors?.month ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.month}</p>
                ) : null}
              </div>
            ) : null}

            {dateMode === "none" ? (
              <div className="rounded-md border border-dashed border-border/80 bg-muted/15 px-3 py-3 text-sm text-muted-foreground">
                This template saves a live-loan snapshot without an additional date filter.
              </div>
            ) : null}

            {unavailableTemplates.length > 0 ? (
              <div className="rounded-md border border-dashed border-border/80 bg-muted/15 px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  Unavailable in {selectedCategoryDefinition?.label ?? "this category"}
                </p>
                <div className="mt-2 space-y-1">
                  {unavailableTemplates.map((template) => (
                    <p className="text-sm text-muted-foreground" key={template.key}>
                      {template.label}: {template.availabilityNote}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            {!hasAvailableTemplates && allAvailableTemplates.length > 0 ? (
              <div className="rounded-md border border-dashed border-border/80 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
                No templates in {selectedCategoryDefinition?.label ?? "this category"} are ready to generate yet. Choose another category to continue.
              </div>
            ) : null}

            {state.status === "error" && state.message ? (
              <p className="text-sm text-destructive">{state.message}</p>
            ) : null}

            <SubmitButton disabled={!hasAvailableTemplates || branchSelectionError !== null} />
          </form>
      </CardContent>
    </Card>
  );
}
