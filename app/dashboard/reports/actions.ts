"use server";

import { getDashboardAuthContext } from "@/app/dashboard/auth";
import { resolveReportsPageAccess } from "@/app/dashboard/reports/access";
import {
  generateAnalyticsReport,
  generateOperationalDocument,
} from "@/app/dashboard/reports/queries";
import {
  initialGenerateAnalyticsReportState,
  initialGenerateOperationalDocumentState,
  type GenerateAnalyticsReportState,
  type GenerateOperationalDocumentState,
} from "@/app/dashboard/reports/state";
import {
  getAnalyticsTemplateDefinition,
  getOperationalDocumentTemplateDefinition,
} from "@/app/dashboard/reports/templates";
import type {
  AnalyticsReportTemplateKey,
  OperationalDocumentTemplateKey,
} from "@/app/dashboard/reports/types";

type FieldErrors = Partial<
  Record<"title" | "template_key" | "branch_ids" | "month" | "date_from" | "date_to", string>
>;

function getTrimmed(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseBranchIds(formData: FormData) {
  return formData
    .getAll("branch_ids")
    .map((value) => String(value))
    .filter((value) => /^\d+$/.test(value))
    .map((value) => Number(value));
}

export async function generateAnalyticsReportAction(
  prevState: GenerateAnalyticsReportState = initialGenerateAnalyticsReportState,
  formData: FormData,
): Promise<GenerateAnalyticsReportState> {
  void prevState;

  const title = getTrimmed(formData, "title");
  const templateKeyRaw = getTrimmed(formData, "template_key");
  const month = getTrimmed(formData, "month");
  const dateFrom = getTrimmed(formData, "date_from");
  const dateTo = getTrimmed(formData, "date_to");
  const branchIds = parseBranchIds(formData);

  const fieldErrors: FieldErrors = {};
  const template = getAnalyticsTemplateDefinition(templateKeyRaw as AnalyticsReportTemplateKey);

  if (!template) {
    fieldErrors.template_key = "Select a valid analytics report template.";
  }

  if (branchIds.length === 0) {
    fieldErrors.branch_ids = "Select at least one branch.";
  }

  if (template?.dateMode === "month" && !month) {
    fieldErrors.month = "Select a month for this report.";
  }

  if (template?.dateMode === "range") {
    if (!dateFrom) {
      fieldErrors.date_from = "Start date is required.";
    }

    if (!dateTo) {
      fieldErrors.date_to = "End date is required.";
    }

    if (dateFrom && dateTo && dateTo < dateFrom) {
      fieldErrors.date_to = "End date cannot be earlier than start date.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  if (!template) {
    return {
      status: "error",
      message: "Select a valid analytics report template.",
      fieldErrors: {
        template_key: "Select a valid analytics report template.",
      },
    };
  }

  const auth = await getDashboardAuthContext();
  const access = resolveReportsPageAccess(auth);

  if (access.view !== "ready") {
    return {
      status: "error",
      message:
        access.view === "unauthenticated"
          ? access.message
          : "You are not authorized to generate analytical reports.",
    };
  }

  const result = await generateAnalyticsReport(access, {
    title,
    templateKey: template.key,
    branchIds,
    month: month || null,
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  return {
    status: "success",
    message: "Analytics report generated and saved.",
    result: {
      reportId: result.reportId,
      title: result.title,
      templateKey: result.templateKey,
      templateLabel: result.templateLabel,
      generatedAt: result.generatedAt,
      branchCount: result.branchCount,
      dateFrom: result.dateFrom,
      dateTo: result.dateTo,
    },
  };
}

export async function generateOperationalDocumentAction(
  prevState: GenerateOperationalDocumentState = initialGenerateOperationalDocumentState,
  formData: FormData,
): Promise<GenerateOperationalDocumentState> {
  void prevState;

  const templateKeyRaw = getTrimmed(formData, "template_key");
  const sourceEntityIdRaw = getTrimmed(formData, "source_entity_id");
  const sourceEntityId = /^\d+$/.test(sourceEntityIdRaw) ? Number(sourceEntityIdRaw) : null;
  const template = getOperationalDocumentTemplateDefinition(
    templateKeyRaw as OperationalDocumentTemplateKey,
  );

  if (!template || sourceEntityId === null) {
    return {
      status: "error",
      message: "Unable to generate this document from the selected record.",
    };
  }

  const auth = await getDashboardAuthContext();
  const access = resolveReportsPageAccess(auth);

  if (access.view !== "ready") {
    return {
      status: "error",
      message:
        access.view === "unauthenticated"
          ? access.message
          : "You are not authorized to generate operational documents.",
    };
  }

  const result = await generateOperationalDocument(access, {
    templateKey: template.key,
    sourceEntityId,
  });

  if (!result.ok) {
    return {
      status: "error",
      message: result.message,
    };
  }

  return {
    status: "success",
    message: `${result.templateLabel} generated and saved.`,
    result: {
      reportId: result.reportId,
      title: result.title,
      templateKey: result.templateKey,
      templateLabel: result.templateLabel,
      generatedAt: result.generatedAt,
      sourceEntityType: result.sourceEntityType,
      sourceEntityId: result.sourceEntityId,
    },
  };
}
