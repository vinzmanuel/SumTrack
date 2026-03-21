import type {
  AnalyticsReportTemplateKey,
  OperationalDocumentTemplateKey,
} from "@/app/dashboard/reports/types";

type AnalyticsReportFieldName =
  | "title"
  | "template_key"
  | "branch_ids"
  | "collector_id"
  | "date_preset"
  | "month"
  | "date_from"
  | "date_to";

export type GenerateAnalyticsReportState = {
  status: "idle" | "error" | "success";
  message: string | null;
  fieldErrors?: Partial<Record<AnalyticsReportFieldName, string>>;
  result?: {
    reportId: number;
    title: string;
    templateKey: AnalyticsReportTemplateKey;
    templateLabel: string;
    generatedAt: string;
    branchCount: number;
    dateFrom: string | null;
    dateTo: string | null;
  };
};

export const initialGenerateAnalyticsReportState: GenerateAnalyticsReportState = {
  status: "idle",
  message: null,
};

export type GenerateOperationalDocumentState = {
  status: "idle" | "error" | "success";
  message: string | null;
  result?: {
    reportId: number;
    title: string;
    templateKey: OperationalDocumentTemplateKey;
    templateLabel: string;
    generatedAt: string;
    sourceEntityType: "loan" | "collection";
    sourceEntityId: number;
  };
};

export const initialGenerateOperationalDocumentState: GenerateOperationalDocumentState = {
  status: "idle",
  message: null,
};
