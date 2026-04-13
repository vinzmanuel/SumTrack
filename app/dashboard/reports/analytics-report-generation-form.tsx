"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { appendBackNavigationToHref, buildReturnTo } from "@/app/dashboard/back-navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { cn } from "@/lib/utils";

const REPORTS_CONTROL_CLASS_NAME = "!h-11 rounded-md bg-white py-0 text-sm dark:bg-background";
const REPORTS_SURFACE_CLASS_NAME = "rounded-md border border-border/70 bg-card shadow-sm";

function FieldLabel(props: { children: string; htmlFor?: string; required?: boolean }) {
  return (
    <Label htmlFor={props.htmlFor}>
      {props.children}
      {props.required ? <span className="ml-1 text-destructive">*</span> : null}
    </Label>
  );
}

function Field(props: { children: ReactNode; className?: string; invalid?: boolean }) {
  return (
    <div
      className={cn("space-y-2 data-[invalid=true]:[&_label]:text-destructive", props.className)}
      data-invalid={props.invalid || undefined}
    >
      {props.children}
    </div>
  );
}

function FormSection(props: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight text-foreground md:text-[1.05rem]">
          {props.title}
        </h2>
        <p className="text-sm text-muted-foreground">{props.description}</p>
      </div>
      {props.children}
    </section>
  );
}

function SubmitButton(props: { disabled?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      className="h-11 rounded-md bg-emerald-600 px-4 text-sm text-white hover:bg-emerald-700 hover:text-white dark:bg-green-500/60 dark:text-white dark:hover:bg-green-500/80 dark:hover:text-white"
      disabled={pending || props.disabled}
      type="submit"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

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
  const shouldShowBranchSelectionError = hasAttemptedSubmit && branchSelectionError !== null;
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
    <div className="space-y-4">
      <div className={REPORTS_SURFACE_CLASS_NAME}>
        <form
          action={formAction}
          className="space-y-4 px-4 py-4 md:px-5"
          onSubmit={(event) => {
            setHasAttemptedSubmit(true);

            if (branchSelectionError !== null) {
              event.preventDefault();
            }
          }}
        >
          {usingFixedBranch ? (
            <input name="branch_ids" type="hidden" value={String(props.access.fixedBranchId)} />
          ) : null}
          <FormSection
            description="Choose the report lane, select the saved template, and set the output title before generating a report snapshot."
            title="Report Setup"
          >
            <div className="space-y-2">
              <div className="grid gap-4 md:grid-cols-2">
                <Field invalid={Boolean(state.fieldErrors?.template_key)}>
                  <FieldLabel htmlFor="template_category" required>
                    Template Category
                  </FieldLabel>
                  <Select
                    onValueChange={(value) => {
                      const nextCategory = value as ReportsTemplateCategoryKey;
                      setSelectedCategory(nextCategory);
                      const nextTemplate =
                        props.analyticsTemplates.find(
                          (template) => template.category === nextCategory && template.available,
                        )?.key ?? "";
                      setTemplateKey(nextTemplate);
                    }}
                    value={effectiveSelectedCategory}
                  >
                    <SelectTrigger className={`${REPORTS_CONTROL_CLASS_NAME} w-full`} id="template_category">
                      <SelectValue placeholder="Select template category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Template Category</SelectLabel>
                        {props.analyticsTemplateCategories.map((category) => {
                          const availableCount = props.analyticsTemplates.filter(
                            (template) => template.category === category.key && template.available,
                          ).length;

                          return (
                            <SelectItem key={category.key} value={category.key}>
                              {category.label}{" "}
                              {availableCount > 0 ? `(${availableCount} available)` : "(planned / unavailable)"}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field invalid={Boolean(state.fieldErrors?.template_key)}>
                  <FieldLabel htmlFor="template_key" required>
                    Template
                  </FieldLabel>
                  <Select onValueChange={setTemplateKey} value={effectiveTemplateKey}>
                    <SelectTrigger
                      aria-invalid={Boolean(state.fieldErrors?.template_key) || undefined}
                      className={`${REPORTS_CONTROL_CLASS_NAME} w-full`}
                      id="template_key"
                    >
                      <SelectValue placeholder="Select analytics template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Template</SelectLabel>
                        {availableTemplates.map((template) => (
                          <SelectItem key={template.key} value={template.key}>
                            {template.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <input name="template_key" type="hidden" value={effectiveTemplateKey} />
                  {state.fieldErrors?.template_key ? (
                    <p className="text-sm text-destructive">{state.fieldErrors.template_key}</p>
                  ) : null}
                </Field>
              </div>

              <div>
                <Field invalid={Boolean(state.fieldErrors?.title)}>
                  <FieldLabel htmlFor="title">Report Title</FieldLabel>
                  <Input
                    aria-invalid={Boolean(state.fieldErrors?.title) || undefined}
                    className={REPORTS_CONTROL_CLASS_NAME}
                    id="title"
                    name="title"
                    placeholder="Leave blank to use the generated default title"
                  />
                  {state.fieldErrors?.title ? (
                    <p className="text-sm text-destructive">{state.fieldErrors.title}</p>
                  ) : null}
                </Field>
              </div>
            </div>
          </FormSection>

          <div className="border-t border-border/70" />

          <FormSection
            description="Define the branch scope and any record-specific targets required by the selected template."
            title="Scope and Targets"
          >
            {!usingFixedBranch ? (
              <Field invalid={Boolean(state.fieldErrors?.branch_ids) || shouldShowBranchSelectionError}>
                <FieldLabel required>Branch Scope</FieldLabel>
                <div
                  className="space-y-2 rounded-md border border-border/70 bg-background/70 p-3 data-[invalid=true]:border-destructive"
                  data-invalid={Boolean(state.fieldErrors?.branch_ids) || shouldShowBranchSelectionError || undefined}
                >
                  <p className="text-sm text-muted-foreground">
                    Select one or more branches within your current reporting scope.
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {props.branchOptions.map((item) => {
                      const checked = selectedBranchIds.includes(String(item.branchId));

                      return (
                        <label className="flex items-center gap-2 text-sm" key={item.branchId}>
                          <input
                            aria-invalid={Boolean(state.fieldErrors?.branch_ids) || shouldShowBranchSelectionError || undefined}
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
                {state.fieldErrors?.branch_ids ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.branch_ids}</p>
                ) : null}
                {shouldShowBranchSelectionError ? (
                  <p className="text-sm text-destructive">{branchSelectionError}</p>
                ) : null}
                {selectedTemplate?.key === "branch_performance_overview" ? (
                  <p className="text-sm text-muted-foreground">
                    This template is the single-branch branch snapshot. Select exactly one branch.
                  </p>
                ) : null}
                {selectedTemplate?.key === "branch_performance_comparison" ? (
                  <p className="text-sm text-muted-foreground">
                    This template compares branches side by side. Select two or more branches.
                  </p>
                ) : null}
                {selectedTemplate?.category === "branches" &&
                selectedTemplate.key !== "branch_performance_overview" &&
                selectedTemplate.key !== "branch_performance_comparison" ? (
                  <p className="text-sm text-muted-foreground">
                    Branch-focused templates use the exact branches you choose here. Single-branch output is still allowed unless the template requires otherwise.
                  </p>
                ) : null}
              </Field>
            ) : null}

            {collectorSelectionRequired ? (
              <Field invalid={Boolean(state.fieldErrors?.collector_id)}>
                <FieldLabel htmlFor="collector_id" required>
                  Collector
                </FieldLabel>
                <Select onValueChange={setCollectorId} value={effectiveCollectorId}>
                  <SelectTrigger
                    aria-invalid={Boolean(state.fieldErrors?.collector_id) || undefined}
                    className={`${REPORTS_CONTROL_CLASS_NAME} w-full`}
                    id="collector_id"
                  >
                    <SelectValue placeholder="Select collector" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Collector</SelectLabel>
                      {filteredCollectorOptions.map((collector) => (
                        <SelectItem key={collector.collectorId} value={collector.collectorId}>
                          {collector.collectorName} ({collector.companyId})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <input name="collector_id" type="hidden" value={effectiveCollectorId} />
                {filteredCollectorOptions.length > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This is a single-collector report. Choose the collector inside the currently selected branch scope.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No collectors are available in the selected branch scope right now.
                  </p>
                )}
                {state.fieldErrors?.collector_id ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.collector_id}</p>
                ) : null}
              </Field>
            ) : null}

          </FormSection>

          <div className="border-t border-border/70" />

          <FormSection
            description="Choose the coverage period required by the selected template. Some report types save monthly history, while others use flexible date ranges."
            title="Coverage Period"
          >
            {dateMode === "range" ? (
              <div className="space-y-4">
                <Field invalid={Boolean(state.fieldErrors?.date_preset)}>
                  <FieldLabel htmlFor="date_preset" required>
                    Date Range
                  </FieldLabel>
                  <Select
                    onValueChange={(value) => setDatePreset(value as ReportsDateRangePreset)}
                    value={datePreset}
                  >
                    <SelectTrigger
                      aria-invalid={Boolean(state.fieldErrors?.date_preset) || undefined}
                      className={`${REPORTS_CONTROL_CLASS_NAME} w-full md:w-1/2`}
                      id="date_preset"
                    >
                      <SelectValue placeholder="Select date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Date Range</SelectLabel>
                        {REPORTS_DATE_RANGE_PRESET_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <input name="date_preset" type="hidden" value={datePreset} />
                  {state.fieldErrors?.date_preset ? (
                    <p className="text-sm text-destructive">{state.fieldErrors.date_preset}</p>
                  ) : null}
                </Field>

                {isReportsCustomDatePreset(datePreset) ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field invalid={Boolean(state.fieldErrors?.date_from)}>
                      <FieldLabel htmlFor="date_from" required>
                        Start Date
                      </FieldLabel>
                      <Input
                        aria-invalid={Boolean(state.fieldErrors?.date_from) || undefined}
                        className={REPORTS_CONTROL_CLASS_NAME}
                        id="date_from"
                        name="date_from"
                        onChange={(event) => setDateFrom(event.target.value)}
                        type="date"
                        value={dateFrom}
                      />
                      {state.fieldErrors?.date_from ? (
                        <p className="text-sm text-destructive">{state.fieldErrors.date_from}</p>
                      ) : null}
                    </Field>

                    <Field invalid={Boolean(state.fieldErrors?.date_to)}>
                      <FieldLabel htmlFor="date_to" required>
                        End Date
                      </FieldLabel>
                      <Input
                        aria-invalid={Boolean(state.fieldErrors?.date_to) || undefined}
                        className={REPORTS_CONTROL_CLASS_NAME}
                        id="date_to"
                        name="date_to"
                        onChange={(event) => setDateTo(event.target.value)}
                        type="date"
                        value={dateTo}
                      />
                      {state.fieldErrors?.date_to ? (
                        <p className="text-sm text-destructive">{state.fieldErrors.date_to}</p>
                      ) : null}
                    </Field>
                  </div>
                ) : null}
              </div>
            ) : null}

            {dateMode === "month" ? (
              <Field invalid={Boolean(state.fieldErrors?.month)} className="md:max-w-[240px]">
                <FieldLabel htmlFor="month" required>
                  Reporting Month
                </FieldLabel>
                <Input
                  aria-invalid={Boolean(state.fieldErrors?.month) || undefined}
                  className={REPORTS_CONTROL_CLASS_NAME}
                  id="month"
                  name="month"
                  onChange={(event) => setMonth(event.target.value)}
                  type="month"
                  value={month}
                />
                <p className="text-sm text-muted-foreground">
                  This template saves finalized historical data for one reporting month only.
                </p>
                {state.fieldErrors?.month ? (
                  <p className="text-sm text-destructive">{state.fieldErrors.month}</p>
                ) : null}
              </Field>
            ) : null}

            {dateMode === "none" ? (
              <div className="rounded-md border border-dashed border-border/80 bg-muted/15 px-4 py-3 text-sm text-muted-foreground">
                This template saves a live-loan or current-state snapshot without an additional coverage date filter.
              </div>
            ) : null}
          </FormSection>

          {unavailableTemplates.length > 0 || (!hasAvailableTemplates && allAvailableTemplates.length > 0) ? (
            <>
              <div className="border-t border-border/70" />

              <FormSection
                description="Template availability differs by implementation state and role support. These notes explain what is currently unavailable."
                title="Availability Notes"
              >
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
                  <Alert className="border-amber-200 bg-amber-50/80 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-amber-800 dark:text-amber-200">
                      No templates in {selectedCategoryDefinition?.label ?? "this category"} are ready to generate yet. Choose another category to continue.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </FormSection>
            </>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {state.status === "error" && state.message ? (
              <Alert className="border-destructive/30 bg-destructive/5 text-destructive sm:max-w-2xl">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : (
              <div />
            )}
            <SubmitButton disabled={!hasAvailableTemplates} />
          </div>
        </form>
      </div>
    </div>
  );
}
