import "server-only";

import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  loadCollectorPerformanceRowsForCustomRange,
  loadCollectorTrendBucketsForCustomRange,
} from "@/app/dashboard/collectors/queries";
import {
  CLOSED_VISIBLE_LOAN_STATUSES,
  CLOSED_STORED_LOAN_STATUSES,
  LIVE_STORED_LOAN_STATUSES,
  buildLoanDerivedMetricsSubquery,
  buildStoredLoanStatusEqualsSql,
  buildStoredLoanStatusInSql,
} from "@/app/dashboard/loans/loan-derived-status-sql";
import {
  buildLoanComputedState,
  getVisibleLoanStatusFromStoredStatus,
  isLoanPaidOff,
} from "@/app/dashboard/loans/loan-state";
import { getReportsDatePresetLabel } from "@/app/dashboard/reports/date-range-presets";
import {
  buildActiveLoansSummarySnapshot,
  buildBranchCollectionsComparisonSnapshot,
  buildBranchLoansComparisonSnapshot,
  buildBranchPerformanceComparisonSnapshot,
  buildBranchPerformanceOverviewSnapshot,
  buildBorrowerSummarySnapshot,
  buildBorrowersWithOverdueLoansSnapshot,
  buildBorrowerLoanScheduleSnapshot,
  buildClosedLoansReportSnapshot,
  buildCollectionReceiptSnapshot,
  buildCollectionsSummarySnapshot,
  buildCollectorLeaderboardReportSnapshot,
  buildCollectorPerformanceReportSnapshot,
  buildCollectionsByCollectorSnapshot,
  buildFinancialOverviewSnapshot,
  buildLoanReceiptSummarySnapshot,
  buildLoansSummarySnapshot,
  buildOverdueLoansReportSnapshot,
  buildReleasedLoansReportSnapshot,
} from "@/app/dashboard/reports/snapshot-builders";
import {
  buildAnalyticsTemplateCategoryOptions,
  buildAnalyticsTemplateOptions,
  buildOperationalDocumentTemplateOptions,
  getAnalyticsTemplateDefinition,
  getOperationalDocumentTemplateDefinition,
  getReportTemplateKeysForCategory,
  getSystemGeneratedTemplateKeysForRole,
  isSystemGeneratedTemplateAllowedForRole,
  normalizeReportTemplateKey,
  resolveReportTemplateFilterKeys,
  resolveReportTemplateCategory,
  resolveReportTemplateLabel,
} from "@/app/dashboard/reports/templates";
import type {
  AnalyticsReportTemplateKey,
  OperationalDocumentTemplateKey,
  ReportsBranchOption,
  ReportsDateRangePreset,
  ReportsLibraryFilterState,
  ReportsLibraryPageData,
  ReportsLibraryRow,
  ReportsPageData,
  ReportsReadyAccessState,
  ReportsSystemRecipientRole,
  ReportsViewerPageData,
  SavedReportSnapshot,
} from "@/app/dashboard/reports/types";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  branch,
  collections,
  employee_branch_assignment,
  employee_info,
  expenses,
  loan_records,
  reports,
  roles,
  users,
  employee_area_assignment,
} from "@/db/schema";
import type { CollectorsAccessState } from "@/app/dashboard/collectors/types";

const borrowerUsers = alias(users, "reports_borrower_users");
const collectorUsers = alias(users, "reports_collector_users");
const REPORTS_LIBRARY_PAGE_SIZE = 10;
type ReportsCollectorAnalyticsAccess = Extract<CollectorsAccessState, { view: "analytics" }>;

type GenerateAnalyticsReportInput = {
  title: string;
  templateKey: AnalyticsReportTemplateKey;
  branchIds: number[];
  collectorId: string | null;
  datePreset: ReportsDateRangePreset | null;
  dateFrom: string | null;
  dateTo: string | null;
  month: string | null;
};

type GenerateOperationalDocumentInput = {
  templateKey: OperationalDocumentTemplateKey;
  sourceEntityId: number;
};

type GenerateAnalyticsReportOptions = {
  generatedType?: "user" | "system";
  generatedByUserId?: string;
  additionalFilters?: Record<string, unknown>;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function whereFrom(conditions: Array<SQL | undefined>) {
  const resolvedConditions = conditions.filter((value): value is SQL => Boolean(value));

  if (resolvedConditions.length === 0) {
    return undefined;
  }

  if (resolvedConditions.length === 1) {
    return resolvedConditions[0];
  }

  return and(...resolvedConditions);
}

function calculateLoanDurationDays(startDate: string, dueDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const due = new Date(`${dueDate}T00:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) {
    return null;
  }

  const diff = Math.ceil((due.getTime() - start.getTime()) / 86400000);
  return diff > 0 ? diff : null;
}

function isLoanReceiptSummaryEligible(status: string, outstandingBalance: number) {
  return (
    CLOSED_VISIBLE_LOAN_STATUSES.includes(status as (typeof CLOSED_VISIBLE_LOAN_STATUSES)[number]) &&
    isLoanPaidOff(outstandingBalance)
  );
}

type DateBucketMode = "day" | "week" | "month";

function countInclusiveDays(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }

  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function resolveDateBucketMode(dateFrom: string, dateTo: string): DateBucketMode {
  return countInclusiveDays(dateFrom, dateTo) <= 45 ? "day" : "month";
}

function resolveAdaptiveRangeBucketMode(dateFrom: string, dateTo: string): DateBucketMode {
  const inclusiveDays = countInclusiveDays(dateFrom, dateTo);

  if (inclusiveDays <= 31) {
    return "day";
  }

  if (inclusiveDays <= 180) {
    return "week";
  }

  return "month";
}

function startOfIsoWeek(dateValue: string) {
  const parsed = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return dateValue;
  }

  const dayOfWeek = parsed.getUTCDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  parsed.setUTCDate(parsed.getUTCDate() + offset);
  return parsed.toISOString().slice(0, 10);
}

function bucketKeyForIsoDate(date: string, mode: DateBucketMode) {
  if (mode === "day") {
    return date;
  }

  if (mode === "week") {
    return startOfIsoWeek(date);
  }

  return date.slice(0, 7);
}

function bucketLabelFromKey(bucketKey: string, mode: DateBucketMode) {
  if (mode === "day") {
    const parsed = new Date(`${bucketKey}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      return bucketKey;
    }

    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "2-digit",
      timeZone: "UTC",
    }).format(parsed);
  }

  if (mode === "week") {
    const parsed = new Date(`${bucketKey}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) {
      return bucketKey;
    }

    const end = new Date(parsed);
    end.setUTCDate(end.getUTCDate() + 6);

    const startLabel = new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "2-digit",
      timeZone: "UTC",
    }).format(parsed);
    const endLabel = new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "2-digit",
      timeZone: "UTC",
    }).format(end);

    return `${startLabel} - ${endLabel}`;
  }

  const parsed = new Date(`${bucketKey}-01T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return bucketKey;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function enumerateBucketLabels(dateFrom: string, dateTo: string, mode: DateBucketMode) {
  const startKey = mode === "week" ? startOfIsoWeek(dateFrom) : dateFrom;
  const start = new Date(`${startKey}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [] as Array<{ key: string; label: string }>;
  }

  const rows: Array<{ key: string; label: string }> = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const year = cursor.getUTCFullYear();
    const month = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    const day = String(cursor.getUTCDate()).padStart(2, "0");
    const key =
      mode === "day"
        ? `${year}-${month}-${day}`
        : mode === "week"
          ? `${year}-${month}-${day}`
          : `${year}-${month}`;

    if (!rows.some((row) => row.key === key)) {
      rows.push({
        key,
        label: bucketLabelFromKey(key, mode),
      });
    }

    if (mode === "day") {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    } else if (mode === "week") {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    } else {
      cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    }
  }

  return rows;
}

function getReportSeriesColor(index: number) {
  const palette = ["#16a34a", "#0ea5e9", "#f59e0b", "#6366f1", "#ef4444", "#0f172a"] as const;
  return palette[index % palette.length];
}

function enumerateIsoDates(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [] as string[];
  }

  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function buildUserDisplayName(params: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  username?: string | null;
  fallback?: string | null;
}) {
  const fullName = [params.firstName, params.middleName, params.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || params.username || params.fallback || "Unknown";
}

function sortBranchIds(branchIds: number[]) {
  return Array.from(new Set(branchIds)).sort((left, right) => left - right);
}

function formatIsoDate(value: string) {
  const parsed = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatMoney(value: number) {
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function currentManilaIsoDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

function calculateDaysBetweenIsoDates(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  return Math.max(Math.floor((end.getTime() - start.getTime()) / 86400000), 0);
}

function resolveMonthWindow(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 1 || monthIndex > 12) {
    return null;
  }

  const start = new Date(Date.UTC(year, monthIndex - 1, 1));
  const end = new Date(Date.UTC(year, monthIndex, 0));

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat("en-PH", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(start),
  };
}

function buildScopeLabel(branchNames: string[]) {
  if (branchNames.length === 0) {
    return "No branch scope";
  }

  if (branchNames.length === 1) {
    return branchNames[0];
  }

  return `${branchNames.length} selected branches`;
}

function buildDateRangeLabel(dateFrom: string, dateTo: string) {
  if (dateFrom === dateTo) {
    return formatIsoDate(dateFrom);
  }

  return `${formatIsoDate(dateFrom)} to ${formatIsoDate(dateTo)}`;
}

function formatAssignedBranchScopeLabel(branchCount: number) {
  if (branchCount <= 0) {
    return "No branch scope";
  }

  if (branchCount === 1) {
    return "1 assigned branch";
  }

  return `${branchCount} assigned branches`;
}

function resolvePreviousCompletedMonthWindow(referenceDate = currentManilaIsoDate()) {
  const parsed = new Date(`${referenceDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const previousMonthDate = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() - 1, 1));
  const coverageMonth = `${previousMonthDate.getUTCFullYear()}-${String(
    previousMonthDate.getUTCMonth() + 1,
  ).padStart(2, "0")}`;

  const monthWindow = resolveMonthWindow(coverageMonth);
  if (!monthWindow) {
    return null;
  }

  return {
    coverageMonth,
    coverageLabel: monthWindow.label,
    dateFrom: monthWindow.start,
    dateTo: monthWindow.end,
  };
}

type ReportsSystemGeneratedMetadata = {
  coverageMonth: string | null;
  recipientRole: ReportsSystemRecipientRole | null;
  recipientUserId: string | null;
  scopeKey: string | null;
};

type ReportsSystemDuplicateLookupInput = {
  templateKey: string;
  coverageMonth: string;
  branchScope: number[];
  recipientRole: ReportsSystemRecipientRole;
  recipientUserId?: string | null;
};

type ReportsSystemGeneratedVisibilityRow = {
  templateKey: string;
  generatedType: "user" | "system";
  generatedByUserId?: string;
  branchScope: number[];
  filters: unknown;
};

type ReportsSystemUserLookupResult =
  | {
      ok: true;
      user: {
        userId: string;
        username: string;
        companyId: string | null;
        roleName: string | null;
        status: string;
      };
    }
  | {
      ok: false;
      message: string;
    };

type ReportsSystemGenerationAccessState = Extract<ReportsReadyAccessState, { view: "ready" }>;

type ReportsSystemGenerationRecipient = {
  userId: string;
  roleName: ReportsSystemRecipientRole;
  scopeBranchIds: number[];
  scopeLabel: string;
  fixedBranchId: number | null;
  fixedBranchName: string | null;
};

type ReportsSystemMonthlyGenerationItem = {
  roleName: ReportsSystemRecipientRole;
  recipientUserId: string;
  scopeLabel: string;
  templateKey: string;
  outcome: "created" | "duplicate" | "skipped" | "error";
  message: string;
  reportId?: number;
};

type ReportsSystemMonthlyGenerationResult =
  | {
      ok: true;
      coverageMonth: string;
      coverageLabel: string;
      dateFrom: string;
      dateTo: string;
      totals: {
        recipients: number;
        created: number;
        duplicates: number;
        skipped: number;
        errors: number;
      };
      items: ReportsSystemMonthlyGenerationItem[];
    }
  | {
      ok: false;
      message: string;
    };

function isReportsSystemRecipientRole(value: unknown): value is ReportsSystemRecipientRole {
  return value === "Admin" || value === "Auditor" || value === "Branch Manager";
}

function readStringRecordValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildSystemGeneratedScopeKey(branchScope: number[]) {
  const normalizedScope = sortBranchIds(branchScope);
  return normalizedScope.join(",");
}

function buildIntegerArraySql(values: number[]) {
  return sql`array[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )}]::integer[]`;
}

function parseSystemGeneratedMetadata(filters: unknown): ReportsSystemGeneratedMetadata {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return {
      coverageMonth: null,
      recipientRole: null,
      recipientUserId: null,
      scopeKey: null,
    };
  }

  const record = filters as Record<string, unknown>;
  const recipientRoleValue = record["systemRecipientRole"];

  return {
    coverageMonth: readStringRecordValue(record, "systemCoverageMonth"),
    recipientRole: isReportsSystemRecipientRole(recipientRoleValue) ? recipientRoleValue : null,
    recipientUserId: readStringRecordValue(record, "systemRecipientUserId"),
    scopeKey: readStringRecordValue(record, "systemScopeKey"),
  };
}

function buildSystemGeneratedFiltersMetadata(input: ReportsSystemDuplicateLookupInput) {
  return {
    systemCoverageMonth: input.coverageMonth,
    systemRecipientRole: input.recipientRole,
    systemRecipientUserId: input.recipientUserId ?? null,
    systemScopeKey: buildSystemGeneratedScopeKey(input.branchScope),
  };
}

function isSystemGeneratedReportVisibleToAccess(
  access: ReportsReadyAccessState,
  row: ReportsSystemGeneratedVisibilityRow,
) {
  if (row.generatedType !== "system") {
    return true;
  }

  if (!isSystemGeneratedTemplateAllowedForRole(row.templateKey, access.roleName)) {
    return false;
  }

  if (access.roleName === "Secretary") {
    return false;
  }

  const metadata = parseSystemGeneratedMetadata(row.filters);

  if (metadata.recipientRole && metadata.recipientRole !== access.roleName) {
    return false;
  }

  if (metadata.recipientUserId && metadata.recipientUserId !== access.userId) {
    return false;
  }

  if (metadata.scopeKey) {
    return metadata.scopeKey === buildSystemGeneratedScopeKey(row.branchScope);
  }

  return true;
}

function buildSystemRecipientAccessState(
  recipient: ReportsSystemGenerationRecipient,
): ReportsSystemGenerationAccessState {
  return {
    view: "ready",
    userId: recipient.userId,
    roleName: recipient.roleName,
    canAccessAnalytics: true,
    canAccessOperationalDocuments: recipient.roleName !== "Auditor",
    scopeLabel: recipient.scopeLabel,
    scopeDetail: "System-generated monthly reporting context.",
    allowedBranchIds: recipient.scopeBranchIds,
    fixedBranchId: recipient.fixedBranchId,
    fixedBranchName: recipient.fixedBranchName,
  };
}

function buildReportsLibraryScopeWhere(access: ReportsReadyAccessState) {
  if (access.roleName === "Admin") {
    return undefined;
  }

  const conditions: SQL[] = [];

  if (access.roleName === "Auditor") {
    conditions.push(eq(reports.report_category, "analytics"));
  }

  if (access.roleName === "Secretary") {
    conditions.push(eq(reports.report_category, "document"));
  }

  if (access.fixedBranchId !== null) {
    conditions.push(sql`${reports.branch_scope} && ${buildIntegerArraySql([access.fixedBranchId])}`);
  } else if (access.allowedBranchIds.length > 0) {
    conditions.push(buildReportsBranchScopeOverlapWhere(access.allowedBranchIds)!);
  } else {
    conditions.push(eq(reports.report_id, -1));
  }

  if (conditions.length === 0) {
    return undefined;
  }

  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

function buildReportsBranchScopeOverlapWhere(branchIds: number[]) {
  if (branchIds.length === 0) {
    return undefined;
  }

  return sql`${reports.branch_scope} && ${buildIntegerArraySql(branchIds)}`;
}

function buildReportsSystemVisibilityWhere(access: ReportsReadyAccessState) {
  if (access.roleName === "Secretary") {
    return eq(reports.generated_type, "user");
  }

  const allowedSystemTemplateKeys = getSystemGeneratedTemplateKeysForRole(access.roleName);
  const systemTemplateWhere =
    allowedSystemTemplateKeys.length === 0
      ? eq(reports.report_id, -1)
      : inArray(reports.template_key, [...allowedSystemTemplateKeys]);
  const scopeKeyExpression = sql<string>`array_to_string(${reports.branch_scope}, ',')`;

  return or(
    ne(reports.generated_type, "system"),
    and(
      eq(reports.generated_type, "system"),
      systemTemplateWhere,
      sql`((${reports.filters} ->> 'systemRecipientRole') is null or (${reports.filters} ->> 'systemRecipientRole') = ${access.roleName})`,
      sql`((${reports.filters} ->> 'systemRecipientUserId') is null or (${reports.filters} ->> 'systemRecipientUserId') = ${access.userId})`,
      sql`((${reports.filters} ->> 'systemScopeKey') is null or (${reports.filters} ->> 'systemScopeKey') = ${scopeKeyExpression})`,
    ),
  );
}

function buildReportsLibraryAdvancedWhere(filters: ReportsLibraryFilterState) {
  const conditions: SQL[] = [];

  if (filters.templateCategory) {
    if (filters.templateCategory === "documents") {
      conditions.push(eq(reports.report_category, "document"));
    } else {
      const templateKeys = getReportTemplateKeysForCategory(filters.templateCategory);
      conditions.push(
        templateKeys.length > 0
          ? inArray(reports.template_key, templateKeys)
          : eq(reports.report_id, -1),
      );
    }
  }

  if (filters.templateKey) {
    const templateKeys = resolveReportTemplateFilterKeys(filters.templateKey);
    conditions.push(
      templateKeys.length > 0 ? inArray(reports.template_key, templateKeys) : eq(reports.report_id, -1),
    );
  }

  if (filters.generatedType !== "all") {
    conditions.push(eq(reports.generated_type, filters.generatedType));
  }

  if (filters.generatedByRoleName) {
    conditions.push(eq(roles.role_name, filters.generatedByRoleName));
  }

  if (filters.generatedByUserId) {
    conditions.push(eq(reports.generated_by, filters.generatedByUserId));
  }

  const branchScopeWhere = buildReportsBranchScopeOverlapWhere(filters.branchIds);
  if (branchScopeWhere) {
    conditions.push(branchScopeWhere);
  }

  if (filters.generatedDateFrom) {
    conditions.push(sql`date(${reports.generated_at}) >= ${filters.generatedDateFrom}`);
  }

  if (filters.generatedDateTo) {
    conditions.push(sql`date(${reports.generated_at}) <= ${filters.generatedDateTo}`);
  }

  if (filters.coverageDateFrom) {
    conditions.push(gte(reports.date_to, filters.coverageDateFrom));
  }

  if (filters.coverageDateTo) {
    conditions.push(lte(reports.date_from, filters.coverageDateTo));
  }

  return whereFrom(conditions);
}

function buildReportsLibraryCategoryWhere(category: ReportsLibraryFilterState["category"]) {
  if (category === "all") {
    return undefined;
  }

  return eq(reports.report_category, category === "documents" ? "document" : "analytics");
}

async function countReportsForLibrary(
  whereCondition: SQL | undefined,
  options?: {
    includeGeneratedByRoleJoin?: boolean;
  },
) {
  const includeGeneratedByRoleJoin = options?.includeGeneratedByRoleJoin ?? false;

  const query = db
    .select({ value: sql<number>`count(*)` })
    .from(reports);

  const joinedQuery = includeGeneratedByRoleJoin
    ? query
        .innerJoin(users, eq(users.user_id, reports.generated_by))
        .leftJoin(roles, eq(roles.role_id, users.role_id))
    : query;

  return joinedQuery
    .where(whereCondition)
    .then((rows) => Number(rows[0]?.value) || 0)
    .catch(() => 0);
}

function buildReportsLibraryRow(row: {
  reportId: number;
  title: string;
  reportCategory: "analytics" | "document";
  templateKey: string;
  generatedType: "user" | "system";
  generatedAt: string;
  status: "active" | "archived";
  generatedByUserId: string;
  generatedByName: string;
  generatedByCompanyId: string | null;
  generatedByRoleName: string | null;
  branchScope: number[];
  dateFrom: string | null;
  dateTo: string | null;
  sourceEntityType: "loan" | "collection" | null;
  sourceEntityId: number | null;
}): ReportsLibraryRow {
  const normalizedTemplateKey = normalizeReportTemplateKey(row.templateKey);
  const templateCategory = resolveReportTemplateCategory(normalizedTemplateKey);

  return {
    reportId: row.reportId,
    title: row.title,
    reportCategory: row.reportCategory,
    templateCategory:
      templateCategory?.key ?? (row.reportCategory === "document" ? "documents" : "financials"),
    templateCategoryLabel:
      templateCategory?.label ?? (row.reportCategory === "document" ? "Documents" : "Financials"),
    templateKey: normalizedTemplateKey,
    templateLabel: resolveReportTemplateLabel(normalizedTemplateKey),
    generatedType: row.generatedType,
    generatedAt: row.generatedAt,
    status: row.status,
    generatedByUserId: row.generatedByUserId,
    generatedByName: row.generatedByName,
    generatedByCompanyId: row.generatedByCompanyId,
    generatedByRoleName: row.generatedByRoleName,
    branchScope: row.branchScope,
    dateFrom: row.dateFrom,
    dateTo: row.dateTo,
    sourceEntityType: row.sourceEntityType,
    sourceEntityId: row.sourceEntityId,
  };
}

function buildReportUserOptionLabel(params: {
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  companyId: string | null;
  username: string | null;
}) {
  const first = params.firstName?.trim() ?? "";
  const middle = params.middleName?.trim() ?? "";
  const last = params.lastName?.trim() ?? "";
  const middleInitial = middle ? `${middle[0].toUpperCase()}.` : "";
  const fullName = [first, middleInitial, last].filter(Boolean).join(" ").trim();
  const identity = fullName || params.username || "Unknown User";
  const company = params.companyId?.trim() || "N/A";

  return `${identity} (${company})`;
}

async function loadVisibleLibraryBranchOptions(
  access: ReportsReadyAccessState,
): Promise<ReportsBranchOption[]> {
  if (access.roleName === "Admin") {
    return db
      .select({
        branchId: branch.branch_id,
        branchName: branch.branch_name,
      })
      .from(branch)
      .orderBy(asc(branch.branch_name))
      .catch(() => []);
  }

  if (access.allowedBranchIds.length === 0) {
    return [];
  }

  return db
    .select({
      branchId: branch.branch_id,
      branchName: branch.branch_name,
    })
    .from(branch)
    .where(inArray(branch.branch_id, access.allowedBranchIds))
    .orderBy(asc(branch.branch_name))
    .catch(() => []);
}

async function loadVisibleBranchOptions(access: ReportsReadyAccessState): Promise<ReportsBranchOption[]> {
  if (!access.canAccessAnalytics || access.allowedBranchIds.length === 0) {
    return [];
  }

  return db
    .select({
      branchId: branch.branch_id,
      branchName: branch.branch_name,
    })
    .from(branch)
    .where(inArray(branch.branch_id, access.allowedBranchIds))
    .orderBy(asc(branch.branch_name))
    .catch(() => []);
}

async function loadSelectedBranchRows(branchIds: number[]) {
  if (branchIds.length === 0) {
    return [];
  }

  return db
    .select({
      branchId: branch.branch_id,
      branchName: branch.branch_name,
    })
    .from(branch)
    .where(inArray(branch.branch_id, branchIds))
    .orderBy(asc(branch.branch_name))
    .catch(() => []);
}

async function loadVisibleCollectorOptions(access: ReportsReadyAccessState) {
  if (!access.canAccessAnalytics || access.allowedBranchIds.length === 0) {
    return [];
  }

  return db
    .select({
      collectorId: users.user_id,
      collectorName: sql<string>`coalesce(nullif(trim(concat_ws(' ', ${employee_info.first_name}, ${employee_info.middle_name}, ${employee_info.last_name})), ''), ${users.username})`,
      companyId: users.company_id,
      branchId: branch.branch_id,
      branchName: branch.branch_name,
    })
    .from(employee_area_assignment)
    .innerJoin(users, eq(users.user_id, employee_area_assignment.employee_user_id))
    .innerJoin(roles, eq(roles.role_id, users.role_id))
    .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
    .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .where(
      and(
        eq(roles.role_name, "Collector"),
        isNull(employee_area_assignment.end_date),
        inArray(branch.branch_id, access.allowedBranchIds),
      ),
    )
    .groupBy(
      users.user_id,
      users.company_id,
      users.username,
      employee_info.first_name,
      employee_info.middle_name,
      employee_info.last_name,
      branch.branch_id,
      branch.branch_name,
    )
    .orderBy(asc(branch.branch_name), asc(employee_info.last_name), asc(employee_info.first_name))
    .catch(() => []);
}

function buildReportsCollectorAnalyticsAccess(
  access: ReportsReadyAccessState,
  branchIds: number[],
): ReportsCollectorAnalyticsAccess {
  return {
    view: "analytics",
    roleName: access.roleName,
    allowedBranchIds: branchIds,
    selectedBranchId: null,
    canChooseBranch: false,
    branchFilterLabel: "Branch",
    fixedBranchName: null,
  };
}

function resolveCollectorTrendBucketMode(dateFrom: string, dateTo: string) {
  const dayCount = countInclusiveDays(dateFrom, dateTo);

  if (dayCount <= 31) {
    return "day" as const;
  }

  if (dayCount <= 120) {
    return "week" as const;
  }

  return "month" as const;
}

function bucketKeyToCollectorPeriodLabel(bucketKey: string, mode: "day" | "week" | "month") {
  if (mode === "month") {
    return bucketLabelFromKey(bucketKey.slice(0, 7), "month");
  }

  if (mode === "day") {
    return bucketLabelFromKey(bucketKey, "day");
  }

  const parsed = new Date(`${bucketKey}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return bucketKey;
  }

  const end = new Date(parsed);
  end.setUTCDate(end.getUTCDate() + 6);

  const startLabel = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(parsed);
  const endLabel = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(end);

  return `${startLabel} - ${endLabel}`;
}

function enumerateCollectorBucketDefinitions(
  dateFrom: string,
  dateTo: string,
  mode: "day" | "week" | "month",
) {
  if (mode === "day") {
    return enumerateBucketLabels(dateFrom, dateTo, "day");
  }

  if (mode === "month") {
    return enumerateBucketLabels(dateFrom, dateTo, "month");
  }

  const start = new Date(`${startOfIsoWeek(dateFrom)}T00:00:00Z`);
  const end = new Date(`${dateTo}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [] as Array<{ key: string; label: string }>;
  }

  const rows: Array<{ key: string; label: string }> = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    rows.push({
      key,
      label: bucketKeyToCollectorPeriodLabel(key, "week"),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return rows;
}

async function loadLoanPaymentSummary(
  loanIds: number[],
  options?: {
    dateTo?: string | null;
  },
) {
  const safeLoanIds = Array.from(new Set(loanIds));
  if (safeLoanIds.length === 0) {
    return new Map<number, { totalPaid: number; completionDate: string | null }>();
  }

  const [loanRows, collectionRows] = await Promise.all([
    db
      .select({
        loanId: loan_records.loan_id,
        principal: loan_records.principal,
        interest: loan_records.interest,
      })
      .from(loan_records)
      .where(inArray(loan_records.loan_id, safeLoanIds))
      .catch(() => []),
    db
      .select({
        loanId: collections.loan_id,
        collectionId: collections.collection_id,
        collectionDate: collections.collection_date,
        amount: collections.amount,
      })
      .from(collections)
      .where(
        options?.dateTo
          ? and(
              inArray(collections.loan_id, safeLoanIds),
              lte(collections.collection_date, options.dateTo),
            )
          : inArray(collections.loan_id, safeLoanIds),
      )
      .orderBy(asc(collections.loan_id), asc(collections.collection_date), asc(collections.collection_id))
      .catch(() => []),
  ]);

  const totalPayableByLoanId = new Map(
    loanRows.map((row) => {
      const principal = toNumber(row.principal);
      const interestRate = toNumber(row.interest);

      return [row.loanId, principal + (principal * interestRate) / 100] as const;
    }),
  );

  const paymentSummaryByLoanId = new Map<number, { totalPaid: number; completionDate: string | null }>();

  for (const loanId of safeLoanIds) {
    paymentSummaryByLoanId.set(loanId, {
      totalPaid: 0,
      completionDate: null,
    });
  }

  // Completion happens on the first collection that reduces the remaining balance to zero.
  for (const row of collectionRows) {
    const paymentSummary = paymentSummaryByLoanId.get(row.loanId) ?? {
      totalPaid: 0,
      completionDate: null,
    };
    const totalPayable = totalPayableByLoanId.get(row.loanId) ?? 0;

    paymentSummary.totalPaid += toNumber(row.amount);

    if (paymentSummary.completionDate === null) {
      const remainingBalance = Math.max(totalPayable - paymentSummary.totalPaid, 0);

      if (isLoanPaidOff(remainingBalance)) {
        paymentSummary.completionDate = row.collectionDate;
      }
    }

    paymentSummaryByLoanId.set(row.loanId, paymentSummary);
  }

  return paymentSummaryByLoanId;
}

async function loadLiveLoanBranchMetrics(branchIds: number[]) {
  const safeBranchIds = sortBranchIds(branchIds);
  if (safeBranchIds.length === 0) {
    return new Map<number, {
      activeLoans: number;
      overdueLoans: number;
      principalExposure: number;
      totalPayableActive: number;
      outstandingBalance: number;
    }>();
  }

  const liveLoanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "reports_live_loan_branch_metrics",
    currentDate: currentManilaIsoDate(),
    where: inArray(loan_records.branch_id, safeBranchIds),
  });

  const loanRows = await db
    .select({
      branchId: liveLoanMetrics.branchId,
      activeLoans: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusEqualsSql(liveLoanMetrics.storedStatus, "active")} then 1 else 0 end), 0)`,
      overdueLoans: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusEqualsSql(liveLoanMetrics.storedStatus, "overdue")} then 1 else 0 end), 0)`,
      principalExposure: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusInSql(liveLoanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)} then ${liveLoanMetrics.principal} else 0 end), 0)`,
      totalPayableActive: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusInSql(liveLoanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)} then ${liveLoanMetrics.totalPayable} else 0 end), 0)`,
      paidAgainstActive: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusInSql(liveLoanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)} then ${liveLoanMetrics.totalCollected} else 0 end), 0)`,
    })
    .from(liveLoanMetrics)
    .groupBy(liveLoanMetrics.branchId)
    .catch(() => []);

  return new Map(
    loanRows.map((row) => {
      const totalPayableActive = toNumber(row.totalPayableActive);
      const paidAgainstActive = toNumber(row.paidAgainstActive);

      return [
        row.branchId,
        {
          activeLoans: toNumber(row.activeLoans),
          overdueLoans: toNumber(row.overdueLoans),
          principalExposure: toNumber(row.principalExposure),
          totalPayableActive,
          outstandingBalance: Math.max(totalPayableActive - paidAgainstActive, 0),
        },
      ];
    }),
  );
}

async function loadFinancialOverviewData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string | null,
  dateTo: string | null,
) {
  const branchIds = branchRows.map((row) => row.branchId);
  const liveLoanMetrics = await loadLiveLoanBranchMetrics(branchIds);
  const collectionConditions: SQL[] = [inArray(loan_records.branch_id, branchIds)];
  const expenseConditions: SQL[] = [inArray(expenses.branch_id, branchIds)];

  if (dateFrom && dateTo) {
    collectionConditions.push(gte(collections.collection_date, dateFrom), lte(collections.collection_date, dateTo));
    expenseConditions.push(gte(expenses.expense_date, dateFrom), lte(expenses.expense_date, dateTo));
  }

  const [collectionRows, expenseRows] = await Promise.all([
    db
      .select({
        branchId: loan_records.branch_id,
        activityDate: collections.collection_date,
        totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(and(...collectionConditions))
      .groupBy(loan_records.branch_id, collections.collection_date)
      .catch(() => []),
    db
      .select({
        branchId: expenses.branch_id,
        activityDate: expenses.expense_date,
        totalAmount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(and(...expenseConditions))
      .groupBy(expenses.branch_id, expenses.expense_date)
      .catch(() => []),
  ]);

  const collectionTotals = new Map<number, number>();
  const expenseTotals = new Map<number, number>();
  const bucketCollectionTotals = new Map<string, number>();
  const bucketExpenseTotals = new Map<string, number>();
  const activityDates = new Set<string>();

  for (const row of collectionRows) {
    activityDates.add(row.activityDate);
  }

  for (const row of expenseRows) {
    activityDates.add(row.activityDate);
  }

  const sortedActivityDates = Array.from(activityDates).sort((left, right) => left.localeCompare(right));
  const effectiveDateFrom = dateFrom ?? sortedActivityDates[0] ?? currentManilaIsoDate();
  const effectiveDateTo = dateTo ?? sortedActivityDates.at(-1) ?? currentManilaIsoDate();
  const bucketMode = resolveDateBucketMode(effectiveDateFrom, effectiveDateTo);
  const bucketLabels = enumerateBucketLabels(effectiveDateFrom, effectiveDateTo, bucketMode);

  for (const row of collectionRows) {
    const amount = toNumber(row.totalAmount);
    collectionTotals.set(row.branchId, (collectionTotals.get(row.branchId) ?? 0) + amount);
    const bucketKey = bucketKeyForIsoDate(row.activityDate, bucketMode);
    bucketCollectionTotals.set(bucketKey, (bucketCollectionTotals.get(bucketKey) ?? 0) + amount);
  }

  for (const row of expenseRows) {
    const amount = toNumber(row.totalAmount);
    expenseTotals.set(row.branchId, (expenseTotals.get(row.branchId) ?? 0) + amount);
    const bucketKey = bucketKeyForIsoDate(row.activityDate, bucketMode);
    bucketExpenseTotals.set(bucketKey, (bucketExpenseTotals.get(bucketKey) ?? 0) + amount);
  }

  const branchSummaryRows = branchRows.map((row) => {
    const collectionsAmount = collectionTotals.get(row.branchId) ?? 0;
    const expensesAmount = expenseTotals.get(row.branchId) ?? 0;
    const loanMetrics = liveLoanMetrics.get(row.branchId) ?? {
      activeLoans: 0,
      overdueLoans: 0,
      principalExposure: 0,
      totalPayableActive: 0,
      outstandingBalance: 0,
    };

    return {
      branchName: row.branchName,
      collectionsAmount,
      expensesAmount,
      netAmount: collectionsAmount - expensesAmount,
      activeLoans: loanMetrics.activeLoans,
      overdueLoans: loanMetrics.overdueLoans,
      outstandingBalance: loanMetrics.outstandingBalance,
    };
  });

  const periodRows = bucketLabels.map((bucket) => {
    const collectionsAmount = bucketCollectionTotals.get(bucket.key) ?? 0;
    const expensesAmount = bucketExpenseTotals.get(bucket.key) ?? 0;

    return {
      bucket: bucket.label,
      collectionsAmount,
      expensesAmount,
      netAmount: collectionsAmount - expensesAmount,
    };
  });

  const summary = branchSummaryRows.reduce(
    (totals, row) => ({
      collectionsTotal: totals.collectionsTotal + row.collectionsAmount,
      expensesTotal: totals.expensesTotal + row.expensesAmount,
      netTotal: totals.netTotal + row.netAmount,
    }),
    {
      collectionsTotal: 0,
      expensesTotal: 0,
      netTotal: 0,
    },
  );

  return {
    summary,
    periodRows,
    branchRows: branchSummaryRows,
  };
}

async function loadCollectionsSummaryData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string | null,
  dateTo: string | null,
) {
  const branchIds = branchRows.map((row) => row.branchId);
  const collectorLoanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "reports_collections_by_collector_metrics",
    currentDate: currentManilaIsoDate(),
    where: inArray(loan_records.branch_id, branchIds),
  });
  const collectionConditions: SQL[] = [inArray(collectorLoanMetrics.branchId, branchIds)];

  if (dateFrom && dateTo) {
    collectionConditions.push(gte(collections.collection_date, dateFrom));
    collectionConditions.push(lte(collections.collection_date, dateTo));
  }
  const [summaryRows, trendRows, branchBreakdownRows] = await Promise.all([
    db
      .select({
        totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
        totalEntries: sql<number>`count(*)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(and(...collectionConditions))
      .limit(1)
      .catch(() => []),
    db
      .select({
        branchId: loan_records.branch_id,
        activityDate: collections.collection_date,
        totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(and(...collectionConditions))
      .groupBy(loan_records.branch_id, collections.collection_date)
      .orderBy(collections.collection_date, loan_records.branch_id)
      .catch(() => []),
    db
      .select({
        branchId: loan_records.branch_id,
        totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
        totalEntries: sql<number>`count(*)`,
        averageAmount: sql<number>`coalesce(avg(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(and(...collectionConditions))
      .groupBy(loan_records.branch_id)
      .catch(() => []),
  ]);

  const summaryRow = summaryRows[0];
  const sortedTrendDates = Array.from(new Set(trendRows.map((row) => row.activityDate))).sort((left, right) =>
    left.localeCompare(right),
  );
  const effectiveDateFrom = dateFrom ?? sortedTrendDates[0] ?? currentManilaIsoDate();
  const effectiveDateTo = dateTo ?? sortedTrendDates.at(-1) ?? currentManilaIsoDate();
  const bucketMode = resolveAdaptiveRangeBucketMode(effectiveDateFrom, effectiveDateTo);
  const bucketLabels = enumerateBucketLabels(effectiveDateFrom, effectiveDateTo, bucketMode);
  const branchNameMap = new Map(branchRows.map((row) => [row.branchId, row.branchName]));
  const branchSeries = branchRows.map((row, index) => ({
    key: `branch_${row.branchId}`,
    label: row.branchName,
    color: getReportSeriesColor(index),
  }));
  const rawColumns: Array<{ key: string; label: string; format?: "currency" | "number" | "text" }> = [
    { key: "bucket", label: bucketMode === "day" ? "Date" : "Period" },
    ...branchSeries.map((series) => ({
      key: series.key,
      label: series.label,
      format: "currency" as const,
    })),
    { key: "totalAmount", label: "Total Collections", format: "currency" as const },
  ];
  const trendLookup = new Map<string, Record<string, number>>();

  for (const row of trendRows) {
    const bucketKey = bucketKeyForIsoDate(row.activityDate, bucketMode);
    const branchKey = `branch_${row.branchId}`;
    const existing = trendLookup.get(bucketKey) ?? {};
    existing[branchKey] = (existing[branchKey] ?? 0) + toNumber(row.totalAmount);
    trendLookup.set(bucketKey, existing);
  }

  let highestBucketLabel = "N/A";
  let highestBucketAmount = 0;

  const normalizedTrendRows = bucketLabels.map((bucket) => {
    const values = trendLookup.get(bucket.key) ?? {};
    let totalAmount = 0;

    for (const series of branchSeries) {
      totalAmount += values[series.key] ?? 0;
    }

    if (totalAmount > highestBucketAmount) {
      highestBucketAmount = totalAmount;
      highestBucketLabel = `${bucket.label} (${formatMoney(totalAmount)})`;
    }

    return {
      bucket: bucket.label,
      values: branchSeries.length > 1 ? values : { collections: totalAmount },
    };
  });

  return {
    summary: {
      totalAmount: toNumber(summaryRow?.totalAmount),
      totalEntries: toNumber(summaryRow?.totalEntries),
      averagePerDay:
        bucketLabels.length > 0 ? toNumber(summaryRow?.totalAmount) / bucketLabels.length : 0,
      highestCollectionDay: highestBucketLabel,
    },
    chartSeries:
      branchSeries.length > 1
        ? branchSeries
        : [{ key: "collections", label: "Collections", color: "#16a34a" }],
    trendRows: normalizedTrendRows,
    rawColumns,
    rawRows: bucketLabels.map((bucket) => {
      const values = trendLookup.get(bucket.key) ?? {};

      return {
        bucket: bucket.label,
        ...Object.fromEntries(branchSeries.map((series) => [series.key, values[series.key] ?? 0])),
        totalAmount: branchSeries.reduce((sum, series) => sum + (values[series.key] ?? 0), 0),
      };
    }),
    branchRows: branchBreakdownRows
      .map((row) => ({
        branchName: branchNameMap.get(row.branchId) ?? `Branch ${row.branchId}`,
        totalAmount: toNumber(row.totalAmount),
        totalEntries: toNumber(row.totalEntries),
        averageAmount: toNumber(row.averageAmount),
      }))
      .sort((left, right) => left.branchName.localeCompare(right.branchName)),
    bucketMode,
  };
}

async function loadActiveLoansSummaryData(branchRows: Array<{ branchId: number; branchName: string }>) {
  const branchIds = branchRows.map((row) => row.branchId);
  const liveLoanMetrics = await loadLiveLoanBranchMetrics(branchIds);
  const branchLoanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "reports_active_loans_summary_metrics",
    currentDate: currentManilaIsoDate(),
    where: inArray(loan_records.branch_id, branchIds),
  });

  const [collectorRows, borrowerRows] = await Promise.all([
    db
    .select({
      userId: branchLoanMetrics.collectorId,
      username: users.username,
      firstName: employee_info.first_name,
      middleName: employee_info.middle_name,
      lastName: employee_info.last_name,
      liveLoanCount: sql<number>`count(*)`,
      overdueLoanCount: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusEqualsSql(branchLoanMetrics.storedStatus, "overdue")} then 1 else 0 end), 0)`,
      principalExposure: sql<number>`coalesce(sum(${branchLoanMetrics.principal}), 0)`,
      totalPayableActive: sql<number>`coalesce(sum(${branchLoanMetrics.totalPayable}), 0)`,
      paidAgainstActive: sql<number>`coalesce(sum(${branchLoanMetrics.totalCollected}), 0)`,
    })
    .from(branchLoanMetrics)
    .leftJoin(users, eq(users.user_id, branchLoanMetrics.collectorId))
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .where(buildStoredLoanStatusInSql(branchLoanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES))
    .groupBy(
      branchLoanMetrics.collectorId,
      users.username,
      employee_info.first_name,
      employee_info.middle_name,
      employee_info.last_name,
    )
    .orderBy(desc(sql<number>`count(*)`), asc(users.username))
    .catch(() => []),
    db
      .select({
        branchId: branchLoanMetrics.branchId,
        borrowerCount: sql<number>`count(distinct ${branchLoanMetrics.borrowerId})`,
      })
      .from(branchLoanMetrics)
      .where(buildStoredLoanStatusInSql(branchLoanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES))
      .groupBy(branchLoanMetrics.branchId)
      .catch(() => []),
  ]);

  const borrowerMap = new Map(
    borrowerRows.map((row) => [row.branchId, toNumber(row.borrowerCount)]),
  );

  const branchSummaryRows = branchRows.map((row) => {
    const loanMetrics = liveLoanMetrics.get(row.branchId) ?? {
      activeLoans: 0,
      overdueLoans: 0,
      principalExposure: 0,
      totalPayableActive: 0,
      outstandingBalance: 0,
    };
    const liveLoanCount = loanMetrics.activeLoans + loanMetrics.overdueLoans;

    return {
      branchName: row.branchName,
      borrowerCount: borrowerMap.get(row.branchId) ?? 0,
      activeLoans: loanMetrics.activeLoans,
      overdueLoans: loanMetrics.overdueLoans,
      principalExposure: loanMetrics.principalExposure,
      outstandingBalance: loanMetrics.outstandingBalance,
      averageOutstandingPerLoan: liveLoanCount > 0 ? loanMetrics.outstandingBalance / liveLoanCount : 0,
    };
  });

  const summary = branchSummaryRows.reduce(
    (totals, row) => ({
      activeLoanCount: totals.activeLoanCount + row.activeLoans,
      overdueLoanCount: totals.overdueLoanCount + row.overdueLoans,
      outstandingBalance: totals.outstandingBalance + row.outstandingBalance,
      borrowerCount: totals.borrowerCount + row.borrowerCount,
    }),
    {
      activeLoanCount: 0,
      overdueLoanCount: 0,
      outstandingBalance: 0,
      borrowerCount: 0,
    },
  );
  const liveLoanCount = summary.activeLoanCount + summary.overdueLoanCount;

  return {
    summary: {
      ...summary,
      averageOutstandingPerLoan: liveLoanCount > 0 ? summary.outstandingBalance / liveLoanCount : 0,
    },
    chartRows: branchSummaryRows.map((row) => ({
      bucket: row.branchName,
      values: {
        activeLoans: row.activeLoans,
      },
    })),
    branchRows: branchSummaryRows,
    collectorRows: collectorRows.map((row) => ({
      collectorName:
        [row.firstName, row.middleName, row.lastName].filter(Boolean).join(" ").trim() ||
        row.username ||
        "Unassigned",
      liveLoanCount: toNumber(row.liveLoanCount),
      overdueLoanCount: toNumber(row.overdueLoanCount),
      principalExposure: toNumber(row.principalExposure),
      outstandingBalance: Math.max(
        toNumber(row.totalPayableActive) - toNumber(row.paidAgainstActive),
        0,
      ),
    })),
  };
}

async function loadLoansSummaryData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string | null,
  dateTo: string | null,
) {
  const branchIds = branchRows.map((row) => row.branchId);
  const effectiveDateFrom = dateFrom ?? "1900-01-01";
  const effectiveDateTo = dateTo ?? currentManilaIsoDate();
  const loanRows = await db
    .select({
      loanId: loan_records.loan_id,
      branchId: loan_records.branch_id,
      startDate: loan_records.start_date,
      dueDate: loan_records.due_date,
      principal: loan_records.principal,
      interest: loan_records.interest,
      status: loan_records.status,
    })
    .from(loan_records)
  .where(
      and(
        inArray(loan_records.branch_id, branchIds),
        lte(loan_records.start_date, effectiveDateTo),
      ),
    )
    .catch(() => []);

  if (loanRows.length === 0) {
    return {
      summary: {
        activeLoansAtPeriodEnd: 0,
        loansThatBecameOverdue: 0,
        closedLoansInPeriod: 0,
        outstandingBalanceAtPeriodEnd: 0,
      },
      chartRows: [
        {
          bucket: "Selected Scope",
          values: {
            activeLoans: 0,
            becameOverdue: 0,
            closedLoans: 0,
          },
        },
      ],
      rawRows: [
        { metric: "Active Loans at Period End", value: 0 },
        { metric: "Loans that Became Overdue in Period", value: 0 },
        { metric: "Closed Loans in Period", value: 0 },
        { metric: "Outstanding Balance at Period End", value: 0 },
      ],
    };
  }

  const paymentMap = await loadLoanPaymentSummary(
    loanRows.map((row) => row.loanId),
    {
      dateTo: effectiveDateTo,
    },
  );

  let activeLoansAtPeriodEnd = 0;
  let loansThatBecameOverdue = 0;
  let closedLoansInPeriod = 0;
  let outstandingBalanceAtPeriodEnd = 0;

  for (const row of loanRows) {
    const paymentSummary = paymentMap.get(row.loanId);
    const principal = toNumber(row.principal);
    const interestRate = toNumber(row.interest);
    const totalPaidThroughEnd = paymentSummary?.totalPaid ?? 0;
    const completionDate = paymentSummary?.completionDate ?? null;
    const computedState = buildLoanComputedState({
      principal,
      interest: interestRate,
      totalCollected: totalPaidThroughEnd,
      dueDate: row.dueDate,
      storedStatus: row.status,
      currentDate: effectiveDateTo,
    });
    const isClosedByPeriodEnd =
      isLoanPaidOff(computedState.remainingBalance) && Boolean(completionDate && completionDate <= effectiveDateTo);

    if (isClosedByPeriodEnd) {
      if (completionDate && completionDate >= effectiveDateFrom && completionDate <= effectiveDateTo) {
        closedLoansInPeriod += 1;
      }
      continue;
    }

    if (computedState.visibleStatus === "Overdue") {
      outstandingBalanceAtPeriodEnd += computedState.remainingBalance;

      if (row.dueDate >= effectiveDateFrom && row.dueDate < effectiveDateTo) {
        loansThatBecameOverdue += 1;
      }
      continue;
    }

    if (computedState.visibleStatus === "Active") {
      outstandingBalanceAtPeriodEnd += computedState.remainingBalance;
      activeLoansAtPeriodEnd += 1;
    }
  }

  return {
    summary: {
      activeLoansAtPeriodEnd,
      loansThatBecameOverdue,
      closedLoansInPeriod,
      outstandingBalanceAtPeriodEnd,
    },
    chartRows: [
      {
        bucket: "Selected Scope",
        values: {
          activeLoans: activeLoansAtPeriodEnd,
          becameOverdue: loansThatBecameOverdue,
          closedLoans: closedLoansInPeriod,
        },
      },
    ],
    rawRows: [
      {
        metric: "Active Loans at Period End",
        value: activeLoansAtPeriodEnd,
      },
      {
        metric: "Loans that Became Overdue in Period",
        value: loansThatBecameOverdue,
      },
      {
        metric: "Closed Loans in Period",
        value: closedLoansInPeriod,
      },
      {
        metric: "Outstanding Balance at Period End",
        value: outstandingBalanceAtPeriodEnd,
      },
    ],
  };
}

async function loadOverdueLoansReportData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string | null,
  dateTo: string | null,
) {
  const branchIds = branchRows.map((row) => row.branchId);
  const overdueLoanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "reports_overdue_loans_metrics",
    currentDate: currentManilaIsoDate(),
    where: inArray(loan_records.branch_id, branchIds),
  });
  const overdueConditions: SQL[] = [buildStoredLoanStatusEqualsSql(overdueLoanMetrics.storedStatus, "overdue")];

  if (dateFrom && dateTo) {
    overdueConditions.push(gte(overdueLoanMetrics.dueDate, dateFrom));
    overdueConditions.push(lte(overdueLoanMetrics.dueDate, dateTo));
  }

  const overdueLoanRows = await db
    .select({
      loanId: overdueLoanMetrics.loanId,
      borrowerId: overdueLoanMetrics.borrowerId,
      branchId: overdueLoanMetrics.branchId,
      branchName: branch.branch_name,
      loanCode: overdueLoanMetrics.loanCode,
      releaseDate: overdueLoanMetrics.startDate,
      dueDate: overdueLoanMetrics.dueDate,
      principal: overdueLoanMetrics.principal,
      interest: overdueLoanMetrics.interest,
      collectorUsername: collectorUsers.username,
      collectorFirstName: employee_info.first_name,
      collectorMiddleName: employee_info.middle_name,
      collectorLastName: employee_info.last_name,
      borrowerFirstName: borrower_info.first_name,
      borrowerMiddleName: borrower_info.middle_name,
      borrowerLastName: borrower_info.last_name,
      borrowerUsername: borrowerUsers.username,
      borrowerCompanyId: borrowerUsers.company_id,
      status: overdueLoanMetrics.storedStatus,
      totalCollected: overdueLoanMetrics.totalCollected,
      totalPayable: overdueLoanMetrics.totalPayable,
      remainingBalance: overdueLoanMetrics.remainingBalance,
    })
    .from(overdueLoanMetrics)
    .innerJoin(branch, eq(branch.branch_id, overdueLoanMetrics.branchId))
    .innerJoin(borrower_info, eq(borrower_info.user_id, overdueLoanMetrics.borrowerId))
    .leftJoin(borrowerUsers, eq(borrowerUsers.user_id, overdueLoanMetrics.borrowerId))
    .leftJoin(collectorUsers, eq(collectorUsers.user_id, overdueLoanMetrics.collectorId))
    .leftJoin(employee_info, eq(employee_info.user_id, collectorUsers.user_id))
    .where(and(...overdueConditions))
    .orderBy(asc(branch.branch_name), asc(overdueLoanMetrics.dueDate), asc(overdueLoanMetrics.loanCode))
    .catch(() => []);

  const today = currentManilaIsoDate();

  const rawRows = overdueLoanRows
    .map((row) => {
      return {
        borrowerId: row.borrowerId,
        branchName: row.branchName,
        borrowerName:
          [row.borrowerFirstName, row.borrowerMiddleName, row.borrowerLastName]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          row.borrowerCompanyId ||
          row.borrowerUsername ||
          row.borrowerId,
        loanCode: row.loanCode,
        releaseDate: row.releaseDate,
        dueDate: row.dueDate,
        daysOverdue: calculateDaysBetweenIsoDates(row.dueDate, today),
        outstandingBalance: toNumber(row.remainingBalance),
        totalPaid: toNumber(row.totalCollected),
        expectedTotal: toNumber(row.totalPayable),
        collectorName: buildUserDisplayName({
          firstName: row.collectorFirstName,
          middleName: row.collectorMiddleName,
          lastName: row.collectorLastName,
          username: row.collectorUsername,
          fallback: "Unassigned",
        }),
        status: getVisibleLoanStatusFromStoredStatus(row.status),
      };
    })
    .sort((left, right) => {
      if (right.daysOverdue !== left.daysOverdue) {
        return right.daysOverdue - left.daysOverdue;
      }

      return left.dueDate.localeCompare(right.dueDate);
    });

  const branchCountMap = new Map<string, number>();
  for (const row of rawRows) {
    branchCountMap.set(row.branchName, (branchCountMap.get(row.branchName) ?? 0) + 1);
  }

  const totalDaysOverdue = rawRows.reduce((sum, row) => sum + row.daysOverdue, 0);

  return {
    summary: {
      overdueLoansCount: rawRows.length,
      totalOverdueBalance: rawRows.reduce((sum, row) => sum + row.outstandingBalance, 0),
      averageDaysOverdue: rawRows.length > 0 ? Number((totalDaysOverdue / rawRows.length).toFixed(1)) : 0,
      maxDaysOverdue: rawRows.reduce((max, row) => Math.max(max, row.daysOverdue), 0),
      affectedBorrowers: new Set(rawRows.map((row) => row.borrowerId)).size,
    },
    chartRows: branchRows.map((row) => ({
      bucket: row.branchName,
      values: {
        overdueLoans: branchCountMap.get(row.branchName) ?? 0,
      },
    })),
    rawRows: rawRows.map((row) => ({
      branchName: row.branchName,
      borrowerName: row.borrowerName,
      loanCode: row.loanCode,
      releaseDate: row.releaseDate,
      dueDate: row.dueDate,
      daysOverdue: row.daysOverdue,
      outstandingBalance: row.outstandingBalance,
      totalPaid: row.totalPaid,
      expectedTotal: row.expectedTotal,
      collectorName: row.collectorName,
      status: row.status,
    })),
  };
}

async function loadCollectionsByCollectorData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string | null,
  dateTo: string | null,
) {
  const branchIds = branchRows.map((row) => row.branchId);
  const collectorLoanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "reports_collections_by_collector_metrics",
    currentDate: currentManilaIsoDate(),
    where: inArray(loan_records.branch_id, branchIds),
  });
  const collectionConditions: SQL[] = [inArray(collectorLoanMetrics.branchId, branchIds)];

  if (dateFrom && dateTo) {
    collectionConditions.push(gte(collections.collection_date, dateFrom));
    collectionConditions.push(lte(collections.collection_date, dateTo));
  }

  const [groupedRows, summaryRows] = await Promise.all([
    db
      .select({
        collectorId: collections.collector_id,
        companyId: collectorUsers.company_id,
        branchId: loan_records.branch_id,
        branchName: branch.branch_name,
        collectorUsername: collectorUsers.username,
        collectorFirstName: employee_info.first_name,
        collectorMiddleName: employee_info.middle_name,
        collectorLastName: employee_info.last_name,
        totalCollectedAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
        numberOfCollections: sql<number>`count(*)`,
        borrowersHandled: sql<number>`count(distinct ${collectorLoanMetrics.borrowerId})`,
        activeLoansTouched: sql<number>`count(distinct case when ${buildStoredLoanStatusInSql(collectorLoanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)} then ${collectorLoanMetrics.loanId} end)`,
      })
      .from(collections)
      .innerJoin(collectorLoanMetrics, eq(collectorLoanMetrics.loanId, collections.loan_id))
      .innerJoin(branch, eq(branch.branch_id, collectorLoanMetrics.branchId))
      .leftJoin(collectorUsers, eq(collectorUsers.user_id, collections.collector_id))
      .leftJoin(employee_info, eq(employee_info.user_id, collectorUsers.user_id))
      .where(and(...collectionConditions))
      .groupBy(
        collections.collector_id,
        collectorUsers.company_id,
        collectorLoanMetrics.branchId,
        branch.branch_name,
        collectorUsers.username,
        employee_info.first_name,
        employee_info.middle_name,
        employee_info.last_name,
      )
      .orderBy(desc(sql<number>`coalesce(sum(${collections.amount}), 0)`), asc(branch.branch_name))
      .catch(() => []),
    db
      .select({
        totalCollectedAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
        totalCollectionsCount: sql<number>`count(*)`,
        totalBorrowersHandled: sql<number>`count(distinct ${collectorLoanMetrics.borrowerId})`,
      })
      .from(collections)
      .innerJoin(collectorLoanMetrics, eq(collectorLoanMetrics.loanId, collections.loan_id))
      .where(and(...collectionConditions))
      .limit(1)
      .catch(() => []),
  ]);

  const rawRows = groupedRows
    .map((row) => {
      const collectorName = buildUserDisplayName({
        firstName: row.collectorFirstName,
        middleName: row.collectorMiddleName,
        lastName: row.collectorLastName,
        username: row.collectorUsername,
        fallback: "Unassigned",
      });

      return {
        collectorKey: row.collectorId ?? `unassigned-${row.branchId}`,
        collectorLabel:
          row.companyId && row.companyId.trim()
            ? `${collectorName} (${row.companyId})`
            : collectorName,
        collectorName,
        companyId: row.companyId?.trim() || "-",
        branchName: row.branchName,
        totalCollectedAmount: toNumber(row.totalCollectedAmount),
        numberOfCollections: toNumber(row.numberOfCollections),
        averagePerCollection:
          toNumber(row.numberOfCollections) > 0
            ? toNumber(row.totalCollectedAmount) / toNumber(row.numberOfCollections)
            : 0,
        borrowersHandled: toNumber(row.borrowersHandled),
        activeLoansTouched: toNumber(row.activeLoansTouched),
      };
    })
    .sort((left, right) => {
      if (right.totalCollectedAmount !== left.totalCollectedAmount) {
        return right.totalCollectedAmount - left.totalCollectedAmount;
      }

      return left.collectorName.localeCompare(right.collectorName);
    });

  const collectorTotals = new Map<
    string,
    { label: string; totalCollectedAmount: number }
  >();
  for (const row of rawRows) {
    const existing = collectorTotals.get(row.collectorKey) ?? {
      label: row.collectorLabel,
      totalCollectedAmount: 0,
    };
    existing.totalCollectedAmount += row.totalCollectedAmount;
    collectorTotals.set(row.collectorKey, existing);
  }

  const summaryRow = summaryRows[0];
  const totalCollectionsCount = toNumber(summaryRow?.totalCollectionsCount);

  return {
    summary: {
      totalCollectedAmount: toNumber(summaryRow?.totalCollectedAmount),
      totalCollectionsCount,
      averagePerCollection:
        totalCollectionsCount > 0 ? toNumber(summaryRow?.totalCollectedAmount) / totalCollectionsCount : 0,
      totalCollectorsIncluded: collectorTotals.size,
      totalBorrowersHandled: toNumber(summaryRow?.totalBorrowersHandled),
    },
    chartRows: Array.from(collectorTotals.values())
      .sort((left, right) => right.totalCollectedAmount - left.totalCollectedAmount)
      .map((row) => ({
        bucket: row.label,
        values: {
          totalCollectedAmount: row.totalCollectedAmount,
        },
      })),
    rawRows: rawRows.map((row) => ({
      collectorName: row.collectorName,
      companyId: row.companyId,
      branchName: row.branchName,
      totalCollectedAmount: row.totalCollectedAmount,
      numberOfCollections: row.numberOfCollections,
      averagePerCollection: row.averagePerCollection,
      borrowersHandled: row.borrowersHandled,
      activeLoansTouched: row.activeLoansTouched,
    })),
  };
}

async function loadReleasedLoansReportData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string | null,
  dateTo: string | null,
) {
  const branchIds = branchRows.map((row) => row.branchId);
  const releasedLoanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "reports_released_loans_metrics",
    currentDate: currentManilaIsoDate(),
    where: inArray(loan_records.branch_id, branchIds),
  });
  const releasedConditions: SQL[] = [inArray(releasedLoanMetrics.branchId, branchIds)];

  if (dateFrom && dateTo) {
    releasedConditions.push(gte(releasedLoanMetrics.startDate, dateFrom));
    releasedConditions.push(lte(releasedLoanMetrics.startDate, dateTo));
  }

  const releasedLoanRows = await db
    .select({
      loanId: releasedLoanMetrics.loanId,
      borrowerId: releasedLoanMetrics.borrowerId,
      branchName: branch.branch_name,
      loanCode: releasedLoanMetrics.loanCode,
      releaseDate: releasedLoanMetrics.startDate,
      principal: releasedLoanMetrics.principal,
      interest: releasedLoanMetrics.interest,
      collectorUsername: collectorUsers.username,
      collectorFirstName: employee_info.first_name,
      collectorMiddleName: employee_info.middle_name,
      collectorLastName: employee_info.last_name,
      borrowerFirstName: borrower_info.first_name,
      borrowerMiddleName: borrower_info.middle_name,
      borrowerLastName: borrower_info.last_name,
      borrowerUsername: borrowerUsers.username,
      borrowerCompanyId: borrowerUsers.company_id,
      status: releasedLoanMetrics.storedStatus,
    })
    .from(releasedLoanMetrics)
    .innerJoin(branch, eq(branch.branch_id, releasedLoanMetrics.branchId))
    .innerJoin(borrower_info, eq(borrower_info.user_id, releasedLoanMetrics.borrowerId))
    .leftJoin(borrowerUsers, eq(borrowerUsers.user_id, releasedLoanMetrics.borrowerId))
    .leftJoin(collectorUsers, eq(collectorUsers.user_id, releasedLoanMetrics.collectorId))
    .leftJoin(employee_info, eq(employee_info.user_id, collectorUsers.user_id))
    .where(and(...releasedConditions))
    .orderBy(desc(releasedLoanMetrics.startDate), asc(branch.branch_name), asc(releasedLoanMetrics.loanCode))
    .catch(() => []);

  const branchCountMap = new Map<string, number>();
  const rawRows = releasedLoanRows.map((row) => {
    const principal = toNumber(row.principal);
    const interestRate = toNumber(row.interest);
    const totalExpected = principal + (principal * interestRate) / 100;
    branchCountMap.set(row.branchName, (branchCountMap.get(row.branchName) ?? 0) + 1);

    return {
      borrowerId: row.borrowerId,
      releaseDate: row.releaseDate,
      branchName: row.branchName,
      borrowerName:
        [row.borrowerFirstName, row.borrowerMiddleName, row.borrowerLastName]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        row.borrowerCompanyId ||
        row.borrowerUsername ||
        row.borrowerId,
      loanCode: row.loanCode,
      principal,
      interestRate: `${interestRate.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%`,
      totalExpected,
      collectorName: buildUserDisplayName({
        firstName: row.collectorFirstName,
        middleName: row.collectorMiddleName,
        lastName: row.collectorLastName,
        username: row.collectorUsername,
        fallback: "Unassigned",
      }),
      status: getVisibleLoanStatusFromStoredStatus(row.status),
    };
  });

  return {
    summary: {
      releasedLoansCount: rawRows.length,
      totalReleasedPrincipal: rawRows.reduce((sum, row) => sum + row.principal, 0),
      totalReleasedExpectedAmount: rawRows.reduce((sum, row) => sum + row.totalExpected, 0),
      totalBorrowersInvolved: new Set(rawRows.map((row) => row.borrowerId)).size,
    },
    chartRows: branchRows.map((row) => ({
      bucket: row.branchName,
      values: {
        releasedLoans: branchCountMap.get(row.branchName) ?? 0,
      },
    })),
    rawRows: rawRows.map((row) => ({
      releaseDate: row.releaseDate,
      branchName: row.branchName,
      borrowerName: row.borrowerName,
      loanCode: row.loanCode,
      principal: row.principal,
      interestRate: row.interestRate,
      totalExpected: row.totalExpected,
      collectorName: row.collectorName,
      status: row.status,
    })),
  };
}

async function loadClosedLoansReportData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string | null,
  dateTo: string | null,
) {
  const branchIds = branchRows.map((row) => row.branchId);
  const closedLoanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "reports_closed_loans_metrics",
    currentDate: currentManilaIsoDate(),
    where: inArray(loan_records.branch_id, branchIds),
  });
  const closedLoanRows = await db
    .select({
      loanId: closedLoanMetrics.loanId,
      borrowerId: closedLoanMetrics.borrowerId,
      branchName: branch.branch_name,
      loanCode: closedLoanMetrics.loanCode,
      releaseDate: closedLoanMetrics.startDate,
      dueDate: closedLoanMetrics.dueDate,
      principal: closedLoanMetrics.principal,
      collectorUsername: collectorUsers.username,
      collectorFirstName: employee_info.first_name,
      collectorMiddleName: employee_info.middle_name,
      collectorLastName: employee_info.last_name,
      borrowerFirstName: borrower_info.first_name,
      borrowerMiddleName: borrower_info.middle_name,
      borrowerLastName: borrower_info.last_name,
      borrowerUsername: borrowerUsers.username,
      borrowerCompanyId: borrowerUsers.company_id,
      status: closedLoanMetrics.storedStatus,
      totalPaid: closedLoanMetrics.totalCollected,
    })
    .from(closedLoanMetrics)
    .innerJoin(branch, eq(branch.branch_id, closedLoanMetrics.branchId))
    .innerJoin(borrower_info, eq(borrower_info.user_id, closedLoanMetrics.borrowerId))
    .leftJoin(borrowerUsers, eq(borrowerUsers.user_id, closedLoanMetrics.borrowerId))
    .leftJoin(collectorUsers, eq(collectorUsers.user_id, closedLoanMetrics.collectorId))
    .leftJoin(employee_info, eq(employee_info.user_id, collectorUsers.user_id))
    .where(buildStoredLoanStatusInSql(closedLoanMetrics.storedStatus, CLOSED_STORED_LOAN_STATUSES))
    .orderBy(desc(closedLoanMetrics.startDate), asc(branch.branch_name), asc(closedLoanMetrics.loanCode))
    .catch(() => []);

  const paymentSummaryMap = await loadLoanPaymentSummary(
    closedLoanRows.map((row) => row.loanId),
  );

  const branchCountMap = new Map<string, number>();
  const filteredRows = closedLoanRows
    .map((row) => {
      const paymentSummary = paymentSummaryMap.get(row.loanId);
      const completionDate = paymentSummary?.completionDate ?? null;
      const totalPaid = paymentSummary?.totalPaid ?? toNumber(row.totalPaid);

      return {
        borrowerId: row.borrowerId,
        completionDate,
        branchName: row.branchName,
        borrowerName:
          [row.borrowerFirstName, row.borrowerMiddleName, row.borrowerLastName]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          row.borrowerCompanyId ||
          row.borrowerUsername ||
          row.borrowerId,
        loanCode: row.loanCode,
        releaseDate: row.releaseDate,
        principal: toNumber(row.principal),
        totalPaid,
        collectorName: buildUserDisplayName({
          firstName: row.collectorFirstName,
          middleName: row.collectorMiddleName,
          lastName: row.collectorLastName,
          username: row.collectorUsername,
          fallback: "Unassigned",
        }),
        status: getVisibleLoanStatusFromStoredStatus(row.status),
      };
    })
    .filter((row) => {
      if (!row.completionDate) {
        return false;
      }

      if (!dateFrom || !dateTo) {
        return true;
      }

      return row.completionDate >= dateFrom && row.completionDate <= dateTo;
    })
    .map((row) => ({
      ...row,
      completionDate: row.completionDate!,
    }))
    .sort((left, right) => right.completionDate!.localeCompare(left.completionDate!));

  for (const row of filteredRows) {
    branchCountMap.set(row.branchName, (branchCountMap.get(row.branchName) ?? 0) + 1);
  }

  return {
    summary: {
      closedLoansCount: filteredRows.length,
      totalPrincipal: filteredRows.reduce((sum, row) => sum + row.principal, 0),
      totalPaidAmount: filteredRows.reduce((sum, row) => sum + row.totalPaid, 0),
      totalBorrowersInvolved: new Set(filteredRows.map((row) => row.borrowerId)).size,
    },
    chartRows: branchRows.map((row) => ({
      bucket: row.branchName,
      values: {
        closedLoans: branchCountMap.get(row.branchName) ?? 0,
      },
    })),
    rawRows: filteredRows.map((row) => ({
      completionDate: row.completionDate,
      branchName: row.branchName,
      borrowerName: row.borrowerName,
      loanCode: row.loanCode,
      releaseDate: row.releaseDate,
      principal: row.principal,
      totalPaid: row.totalPaid,
      collectorName: row.collectorName,
      status: row.status,
    })),
  };
}

async function loadBranchPerformanceComparisonData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string | null,
  dateTo: string | null,
  options?: { trimLargeComparisons?: boolean },
) {
  const branchIds = branchRows.map((row) => row.branchId);
  const collectionConditions: SQL[] = [inArray(loan_records.branch_id, branchIds)];
  const expenseConditions: SQL[] = [inArray(expenses.branch_id, branchIds)];
  const branchLoanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "reports_branch_performance_metrics",
    currentDate: currentManilaIsoDate(),
    where: inArray(loan_records.branch_id, branchIds),
  });

  if (dateFrom && dateTo) {
    collectionConditions.push(gte(collections.collection_date, dateFrom));
    collectionConditions.push(lte(collections.collection_date, dateTo));
    expenseConditions.push(gte(expenses.expense_date, dateFrom));
    expenseConditions.push(lte(expenses.expense_date, dateTo));
  }

  const [
    borrowerCountRows,
    loanCountRows,
    collectionRows,
    expenseRows,
  ] = await Promise.all([
    db
      .select({
        branchId: areas.branch_id,
        borrowerCount: sql<number>`count(distinct ${borrower_info.user_id})`,
      })
      .from(borrower_info)
      .innerJoin(users, eq(users.user_id, borrower_info.user_id))
      .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
      .where(and(inArray(areas.branch_id, branchIds), eq(users.status, "active")))
      .groupBy(areas.branch_id)
      .catch(() => []),
    db
      .select({
        branchId: branchLoanMetrics.branchId,
        activeLoanCount: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusEqualsSql(branchLoanMetrics.storedStatus, "active")} then 1 else 0 end), 0)`,
        overdueLoanCount: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusEqualsSql(branchLoanMetrics.storedStatus, "overdue")} then 1 else 0 end), 0)`,
        completedLoanCount: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusInSql(branchLoanMetrics.storedStatus, CLOSED_STORED_LOAN_STATUSES)} then 1 else 0 end), 0)`,
      })
      .from(branchLoanMetrics)
      .groupBy(branchLoanMetrics.branchId)
      .catch(() => []),
    db
      .select({
        branchId: loan_records.branch_id,
        collectionsThisMonth: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(and(...collectionConditions))
      .groupBy(loan_records.branch_id)
      .catch(() => []),
    db
      .select({
        branchId: expenses.branch_id,
        expensesAmount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(and(...expenseConditions))
      .groupBy(expenses.branch_id)
      .catch(() => []),
  ]);

  const borrowerMap = new Map(borrowerCountRows.map((row) => [row.branchId, toNumber(row.borrowerCount)]));
  const loanMap = new Map(
    loanCountRows.map((row) => [
      row.branchId,
      {
        activeLoanCount: toNumber(row.activeLoanCount),
        overdueLoanCount: toNumber(row.overdueLoanCount),
        completedLoanCount: toNumber(row.completedLoanCount),
      },
    ]),
  );
  const collectionMap = new Map(collectionRows.map((row) => [row.branchId, toNumber(row.collectionsThisMonth)]));
  const expenseMap = new Map(expenseRows.map((row) => [row.branchId, toNumber(row.expensesAmount)]));

  const comparisonRows = branchRows.map((row) => {
    const collectionsAmount = collectionMap.get(row.branchId) ?? 0;
    const expensesAmount = expenseMap.get(row.branchId) ?? 0;

    return {
      branchName: row.branchName,
      borrowerCount: borrowerMap.get(row.branchId) ?? 0,
      collectionsAmount,
      expensesAmount,
      netAmount: collectionsAmount - expensesAmount,
      activeLoanCount: loanMap.get(row.branchId)?.activeLoanCount ?? 0,
      overdueLoanCount: loanMap.get(row.branchId)?.overdueLoanCount ?? 0,
      completedLoanCount: loanMap.get(row.branchId)?.completedLoanCount ?? 0,
    };
  });

  let displayedBranchRows = comparisonRows;
  let comparisonNote: string | null = null;

  if (options?.trimLargeComparisons && comparisonRows.length > 10) {
    const rankedRows = comparisonRows
      .slice()
      .sort((left, right) => {
        if (right.collectionsAmount !== left.collectionsAmount) {
          return right.collectionsAmount - left.collectionsAmount;
        }

        return left.branchName.localeCompare(right.branchName);
      });
    const topRows = rankedRows.slice(0, 5);
    const bottomRows = rankedRows
      .slice(-5)
      .sort((left, right) => {
        if (left.collectionsAmount !== right.collectionsAmount) {
          return left.collectionsAmount - right.collectionsAmount;
        }

        return left.branchName.localeCompare(right.branchName);
      });

    displayedBranchRows = [...topRows, ...bottomRows];
    comparisonNote = `This report covers ${comparisonRows.length} selected branches, so the comparison view is trimmed to the Top 5 and Bottom 5 branches by Total Collections for readability.`;
  }

  return {
    summary: {
      branchesCompared: comparisonRows.length,
      totalBorrowers: comparisonRows.reduce((sum, row) => sum + row.borrowerCount, 0),
      totalCollections: comparisonRows.reduce((sum, row) => sum + row.collectionsAmount, 0),
      totalExpenses: comparisonRows.reduce((sum, row) => sum + row.expensesAmount, 0),
      totalNet: comparisonRows.reduce((sum, row) => sum + row.netAmount, 0),
      totalActiveLoans: comparisonRows.reduce((sum, row) => sum + row.activeLoanCount, 0),
      totalOverdueLoans: comparisonRows.reduce((sum, row) => sum + row.overdueLoanCount, 0),
      totalCompletedLoans: comparisonRows.reduce((sum, row) => sum + row.completedLoanCount, 0),
    },
    branchRows: displayedBranchRows,
    comparisonNote,
  };
}

async function loadBranchPerformanceOverviewData(
  branchRow: { branchId: number; branchName: string },
  dateFrom: string | null,
  dateTo: string | null,
) {
  const branchIds = [branchRow.branchId];
  const collectionConditions: SQL[] = [inArray(loan_records.branch_id, branchIds)];
  const expenseConditions: SQL[] = [eq(expenses.branch_id, branchRow.branchId)];
  const branchLoanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "reports_branch_overview_metrics",
    currentDate: currentManilaIsoDate(),
    where: eq(loan_records.branch_id, branchRow.branchId),
  });

  if (dateFrom && dateTo) {
    collectionConditions.push(gte(collections.collection_date, dateFrom));
    collectionConditions.push(lte(collections.collection_date, dateTo));
    expenseConditions.push(gte(expenses.expense_date, dateFrom));
    expenseConditions.push(lte(expenses.expense_date, dateTo));
  }

  const [
    collectionRows,
    expenseRows,
    borrowerLoanRows,
    closedLoanRows,
  ] = await Promise.all([
    db
      .select({
        activityDate: collections.collection_date,
        totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(and(...collectionConditions))
      .groupBy(collections.collection_date)
      .orderBy(asc(collections.collection_date))
      .catch(() => []),
    db
      .select({
        activityDate: expenses.expense_date,
        totalAmount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(and(...expenseConditions))
      .groupBy(expenses.expense_date)
      .orderBy(asc(expenses.expense_date))
      .catch(() => []),
    db
      .select({
        borrowerId: branchLoanMetrics.borrowerId,
        status: branchLoanMetrics.storedStatus,
      })
      .from(branchLoanMetrics)
      .catch(() => []),
    db
      .select({
        loanId: branchLoanMetrics.loanId,
        principal: branchLoanMetrics.principal,
        interest: branchLoanMetrics.interest,
        status: branchLoanMetrics.storedStatus,
        dueDate: branchLoanMetrics.dueDate,
        totalPaid: branchLoanMetrics.totalCollected,
      })
      .from(branchLoanMetrics)
      .where(buildStoredLoanStatusInSql(branchLoanMetrics.storedStatus, CLOSED_STORED_LOAN_STATUSES))
      .catch(() => []),
  ]);

  const borrowerWithActiveLoans = new Set<string>();
  const borrowerWithOverdueLoans = new Set<string>();
  let activeLoans = 0;
  let overdueLoans = 0;

  for (const row of borrowerLoanRows) {
    if (row.status === "active") {
      activeLoans += 1;
      borrowerWithActiveLoans.add(row.borrowerId);
    }

    if (row.status === "overdue") {
      overdueLoans += 1;
      borrowerWithOverdueLoans.add(row.borrowerId);
    }
  }

  const closedPaymentSummaryMap = await loadLoanPaymentSummary(closedLoanRows.map((row) => row.loanId));
  const closedLoans = closedLoanRows.filter((row) => {
    const completionDate = closedPaymentSummaryMap.get(row.loanId)?.completionDate ?? null;
    if (!completionDate) {
      return false;
    }

    if (!dateFrom || !dateTo) {
      return true;
    }

    return completionDate >= dateFrom && completionDate <= dateTo;
  }).length;

  const totalCollections = collectionRows.reduce((sum, row) => sum + toNumber(row.totalAmount), 0);
  const totalExpenses = expenseRows.reduce((sum, row) => sum + toNumber(row.totalAmount), 0);

  return {
    summary: {
      collections: totalCollections,
      expenses: totalExpenses,
      net: totalCollections - totalExpenses,
      borrowersWithActiveLoans: borrowerWithActiveLoans.size,
      borrowersWithOverdueLoans: borrowerWithOverdueLoans.size,
      activeLoans,
      overdueLoans,
      closedLoans,
    },
    financialChartRows: [
      {
        bucket: branchRow.branchName,
        values: {
          collections: totalCollections,
          expenses: totalExpenses,
          net: totalCollections - totalExpenses,
        },
      },
    ],
    operationalChartRows: [
      {
        bucket: branchRow.branchName,
        values: {
          borrowersWithActiveLoans: borrowerWithActiveLoans.size,
          borrowersWithOverdueLoans: borrowerWithOverdueLoans.size,
          activeLoans,
          overdueLoans,
          closedLoans,
        },
      },
    ],
    rawRows: [
      { metric: "Collections", value: totalCollections, valueFormat: "currency" as const },
      { metric: "Expenses", value: totalExpenses, valueFormat: "currency" as const },
      { metric: "Net", value: totalCollections - totalExpenses, valueFormat: "currency" as const },
      { metric: "Borrowers with Active Loans", value: borrowerWithActiveLoans.size, valueFormat: "number" as const },
      { metric: "Borrowers with Overdue Loans", value: borrowerWithOverdueLoans.size, valueFormat: "number" as const },
      { metric: "Active Loans", value: activeLoans, valueFormat: "number" as const },
      { metric: "Overdue Loans", value: overdueLoans, valueFormat: "number" as const },
      { metric: "Closed Loans", value: closedLoans, valueFormat: "number" as const },
    ],
  };
}

async function loadBranchCollectionsComparisonData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string | null,
  dateTo: string | null,
) {
  const branchIds = branchRows.map((row) => row.branchId);
  const collectionConditions: SQL[] = [inArray(loan_records.branch_id, branchIds)];

  if (dateFrom && dateTo) {
    collectionConditions.push(gte(collections.collection_date, dateFrom));
    collectionConditions.push(lte(collections.collection_date, dateTo));
  }

  const groupedRows = await db
    .select({
      branchId: loan_records.branch_id,
      branchName: branch.branch_name,
      totalCollectedAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      collectionsCount: sql<number>`count(*)`,
      borrowersServed: sql<number>`count(distinct ${loan_records.borrower_id})`,
      collectorsInvolved: sql<number>`count(distinct ${collections.collector_id})`,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .innerJoin(branch, eq(branch.branch_id, loan_records.branch_id))
    .where(and(...collectionConditions))
    .groupBy(loan_records.branch_id, branch.branch_name)
    .catch(() => []);

  const groupedMap = new Map(
    groupedRows.map((row) => [
      row.branchId,
      {
        totalCollectedAmount: toNumber(row.totalCollectedAmount),
        collectionsCount: toNumber(row.collectionsCount),
        borrowersServed: toNumber(row.borrowersServed),
        collectorsInvolved: toNumber(row.collectorsInvolved),
      },
    ]),
  );

  const rawRows = branchRows.map((row) => {
    const metrics = groupedMap.get(row.branchId) ?? {
      totalCollectedAmount: 0,
      collectionsCount: 0,
      borrowersServed: 0,
      collectorsInvolved: 0,
    };

    return {
      branchName: row.branchName,
      totalCollectedAmount: metrics.totalCollectedAmount,
      collectionsCount: metrics.collectionsCount,
      averageCollectionAmount:
        metrics.collectionsCount > 0
          ? metrics.totalCollectedAmount / metrics.collectionsCount
          : 0,
      borrowersServed: metrics.borrowersServed,
      collectorsInvolved: metrics.collectorsInvolved,
    };
  });

  const totalCollectedAmount = rawRows.reduce((sum, row) => sum + row.totalCollectedAmount, 0);
  const totalCollectionsCount = rawRows.reduce((sum, row) => sum + row.collectionsCount, 0);
  const highestCollectingBranch =
    rawRows
      .slice()
      .sort((left, right) => {
        if (right.totalCollectedAmount !== left.totalCollectedAmount) {
          return right.totalCollectedAmount - left.totalCollectedAmount;
        }

        return left.branchName.localeCompare(right.branchName);
      })[0]?.branchName ?? "N/A";

  return {
    summary: {
      branchesCompared: rawRows.length,
      totalCollectedAmount,
      totalCollectionsCount,
      highestCollectingBranch,
      averageCollectionAmount:
        totalCollectionsCount > 0 ? totalCollectedAmount / totalCollectionsCount : 0,
    },
    chartRows: rawRows.map((row) => ({
      bucket: row.branchName,
      values: {
        totalCollectedAmount: row.totalCollectedAmount,
        collectionsCount: row.collectionsCount,
      },
    })),
    rawRows,
  };
}

async function loadBranchLoansComparisonData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string | null,
  dateTo: string | null,
) {
  const branchIds = branchRows.map((row) => row.branchId);
  const branchLoanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "reports_branch_loans_comparison_metrics",
    currentDate: currentManilaIsoDate(),
    where: inArray(loan_records.branch_id, branchIds),
  });
  const loanConditions: SQL[] = [inArray(branchLoanMetrics.branchId, branchIds)];

  if (dateFrom && dateTo) {
    loanConditions.push(gte(branchLoanMetrics.startDate, dateFrom));
    loanConditions.push(lte(branchLoanMetrics.startDate, dateTo));
  }

  const loanRows = await db
    .select({
      loanId: branchLoanMetrics.loanId,
      branchId: branchLoanMetrics.branchId,
      branchName: branch.branch_name,
      borrowerId: branchLoanMetrics.borrowerId,
      principal: branchLoanMetrics.principal,
      status: branchLoanMetrics.storedStatus,
      remainingBalance: branchLoanMetrics.remainingBalance,
    })
    .from(branchLoanMetrics)
    .innerJoin(branch, eq(branch.branch_id, branchLoanMetrics.branchId))
    .where(and(...loanConditions))
    .catch(() => []);

  const branchMetrics = new Map<
    number,
    {
      branchName: string;
      activeLoans: number;
      overdueLoans: number;
      completedLoans: number;
      borrowers: Set<string>;
      outstandingBalance: number;
    }
  >();

  for (const row of loanRows) {
    const metrics = branchMetrics.get(row.branchId) ?? {
      branchName: row.branchName,
      activeLoans: 0,
      overdueLoans: 0,
      completedLoans: 0,
      borrowers: new Set<string>(),
      outstandingBalance: 0,
    };

    if (row.status === "active") {
      metrics.activeLoans += 1;
    } else if (row.status === "overdue") {
      metrics.overdueLoans += 1;
    } else if (row.status === "completed" || row.status === "archived") {
      metrics.completedLoans += 1;
    }

    metrics.borrowers.add(row.borrowerId);
    metrics.outstandingBalance += toNumber(row.remainingBalance);

    branchMetrics.set(row.branchId, metrics);
  }

  const rawRows = branchRows.map((row) => {
    const metrics = branchMetrics.get(row.branchId);

    return {
      branchName: row.branchName,
      activeLoans: metrics?.activeLoans ?? 0,
      overdueLoans: metrics?.overdueLoans ?? 0,
      completedLoans: metrics?.completedLoans ?? 0,
      borrowersCount: metrics?.borrowers.size ?? 0,
      outstandingBalance: metrics?.outstandingBalance ?? 0,
    };
  });

  return {
    summary: {
      branchesCompared: rawRows.length,
      totalActiveLoans: rawRows.reduce((sum, row) => sum + row.activeLoans, 0),
      totalOverdueLoans: rawRows.reduce((sum, row) => sum + row.overdueLoans, 0),
      totalCompletedLoans: rawRows.reduce((sum, row) => sum + row.completedLoans, 0),
      totalOutstandingBalance: rawRows.reduce((sum, row) => sum + row.outstandingBalance, 0),
    },
    chartRows: rawRows.map((row) => ({
      bucket: row.branchName,
      values: {
        activeLoans: row.activeLoans,
        overdueLoans: row.overdueLoans,
        completedLoans: row.completedLoans,
      },
    })),
    rawRows,
  };
}

async function loadBorrowerSummaryData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string | null,
  dateTo: string | null,
) {
  const branchIds = branchRows.map((row) => row.branchId);
  const borrowerLoanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "reports_borrower_summary_metrics",
    currentDate: currentManilaIsoDate(),
    where: inArray(loan_records.branch_id, branchIds),
  });
  const borrowerLoanRows = await db
    .select({
      branchId: borrowerLoanMetrics.branchId,
      branchName: branch.branch_name,
      borrowerId: borrowerLoanMetrics.borrowerId,
      borrowerCreatedAt: sql<string | null>`${borrowerUsers.date_created}::text`,
      status: borrowerLoanMetrics.storedStatus,
    })
    .from(borrowerLoanMetrics)
    .innerJoin(branch, eq(branch.branch_id, borrowerLoanMetrics.branchId))
    .leftJoin(borrowerUsers, eq(borrowerUsers.user_id, borrowerLoanMetrics.borrowerId))
    .where(inArray(borrowerLoanMetrics.branchId, branchIds))
    .catch(() => []);

  const branchMetrics = new Map<
    number,
    {
      totalBorrowers: Set<string>;
      activeBorrowers: Set<string>;
      overdueBorrowers: Set<string>;
      completedBorrowers: Set<string>;
      newBorrowers: Set<string>;
    }
  >();
  const totalBorrowers = new Set<string>();
  const activeBorrowers = new Set<string>();
  const overdueBorrowers = new Set<string>();
  const completedBorrowers = new Set<string>();
  const newBorrowers = new Set<string>();

  for (const row of borrowerLoanRows) {
    const metrics = branchMetrics.get(row.branchId) ?? {
      totalBorrowers: new Set<string>(),
      activeBorrowers: new Set<string>(),
      overdueBorrowers: new Set<string>(),
      completedBorrowers: new Set<string>(),
      newBorrowers: new Set<string>(),
    };

    metrics.totalBorrowers.add(row.borrowerId);
    totalBorrowers.add(row.borrowerId);

    if (row.status === "active") {
      metrics.activeBorrowers.add(row.borrowerId);
      activeBorrowers.add(row.borrowerId);
    }

    if (row.status === "overdue") {
      metrics.overdueBorrowers.add(row.borrowerId);
      overdueBorrowers.add(row.borrowerId);
    }

    if (row.status === "completed" || row.status === "archived") {
      metrics.completedBorrowers.add(row.borrowerId);
      completedBorrowers.add(row.borrowerId);
    }

    const borrowerCreatedDate = row.borrowerCreatedAt?.slice(0, 10) ?? null;
    if (
      borrowerCreatedDate &&
      (!dateFrom || !dateTo || (borrowerCreatedDate >= dateFrom && borrowerCreatedDate <= dateTo))
    ) {
      metrics.newBorrowers.add(row.borrowerId);
      newBorrowers.add(row.borrowerId);
    }

    branchMetrics.set(row.branchId, metrics);
  }

  const rawRows = branchRows.map((row) => {
    const metrics = branchMetrics.get(row.branchId);

    return {
      branchName: row.branchName,
      totalBorrowers: metrics?.totalBorrowers.size ?? 0,
      borrowersWithActiveLoans: metrics?.activeBorrowers.size ?? 0,
      borrowersWithOverdueLoans: metrics?.overdueBorrowers.size ?? 0,
      borrowersWithCompletedLoans: metrics?.completedBorrowers.size ?? 0,
      newBorrowers: metrics?.newBorrowers.size ?? 0,
    };
  });

  return {
    summary: {
      totalBorrowers: totalBorrowers.size,
      borrowersWithActiveLoans: activeBorrowers.size,
      borrowersWithOverdueLoans: overdueBorrowers.size,
      borrowersWithCompletedLoans: completedBorrowers.size,
      newBorrowers: newBorrowers.size,
    },
    chartRows: rawRows.map((row) => ({
      bucket: row.branchName,
      values: {
        totalBorrowers: row.totalBorrowers,
      },
    })),
    rawRows,
  };
}

async function loadBorrowersWithOverdueLoansData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string | null,
  dateTo: string | null,
) {
  const branchIds = branchRows.map((row) => row.branchId);
  const overdueLoanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "reports_borrowers_with_overdue_metrics",
    currentDate: currentManilaIsoDate(),
    where: inArray(loan_records.branch_id, branchIds),
  });
  const overdueConditions: SQL[] = [buildStoredLoanStatusEqualsSql(overdueLoanMetrics.storedStatus, "overdue")];

  if (dateFrom && dateTo) {
    overdueConditions.push(gte(overdueLoanMetrics.dueDate, dateFrom));
    overdueConditions.push(lte(overdueLoanMetrics.dueDate, dateTo));
  }

  const overdueLoanRows = await db
    .select({
      loanId: overdueLoanMetrics.loanId,
      borrowerId: overdueLoanMetrics.borrowerId,
      branchName: branch.branch_name,
      dueDate: overdueLoanMetrics.dueDate,
      principal: overdueLoanMetrics.principal,
      interest: overdueLoanMetrics.interest,
      collectorUsername: collectorUsers.username,
      collectorFirstName: employee_info.first_name,
      collectorMiddleName: employee_info.middle_name,
      collectorLastName: employee_info.last_name,
      borrowerFirstName: borrower_info.first_name,
      borrowerMiddleName: borrower_info.middle_name,
      borrowerLastName: borrower_info.last_name,
      borrowerUsername: borrowerUsers.username,
      borrowerCompanyId: borrowerUsers.company_id,
      totalCollected: overdueLoanMetrics.totalCollected,
      totalPayable: overdueLoanMetrics.totalPayable,
      remainingBalance: overdueLoanMetrics.remainingBalance,
    })
    .from(overdueLoanMetrics)
    .innerJoin(branch, eq(branch.branch_id, overdueLoanMetrics.branchId))
    .innerJoin(borrower_info, eq(borrower_info.user_id, overdueLoanMetrics.borrowerId))
    .leftJoin(borrowerUsers, eq(borrowerUsers.user_id, overdueLoanMetrics.borrowerId))
    .leftJoin(collectorUsers, eq(collectorUsers.user_id, overdueLoanMetrics.collectorId))
    .leftJoin(employee_info, eq(employee_info.user_id, collectorUsers.user_id))
    .where(and(...overdueConditions))
    .orderBy(asc(branch.branch_name), asc(overdueLoanMetrics.dueDate))
    .catch(() => []);

  const today = currentManilaIsoDate();
  const borrowerMap = new Map<
    string,
    {
      borrowerName: string;
      branchNames: Set<string>;
      collectorNames: Set<string>;
      overdueLoansCount: number;
      totalOverdueBalance: number;
      maxDaysOverdue: number;
      latestOverdueDueDate: string;
    }
  >();
  const branchBorrowerMap = new Map<string, Set<string>>();

  for (const row of overdueLoanRows) {
    const daysOverdue = calculateDaysBetweenIsoDates(row.dueDate, today);
    const overdueBalance = toNumber(row.remainingBalance);
    const collectorName = buildUserDisplayName({
      firstName: row.collectorFirstName,
      middleName: row.collectorMiddleName,
      lastName: row.collectorLastName,
      username: row.collectorUsername,
      fallback: "Unassigned",
    });
    const borrowerName =
      [row.borrowerFirstName, row.borrowerMiddleName, row.borrowerLastName]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      row.borrowerCompanyId ||
      row.borrowerUsername ||
      row.borrowerId;

    const borrowerMetrics = borrowerMap.get(row.borrowerId) ?? {
      borrowerName,
      branchNames: new Set<string>(),
      collectorNames: new Set<string>(),
      overdueLoansCount: 0,
      totalOverdueBalance: 0,
      maxDaysOverdue: 0,
      latestOverdueDueDate: row.dueDate,
    };

    borrowerMetrics.branchNames.add(row.branchName);
    borrowerMetrics.collectorNames.add(collectorName);
    borrowerMetrics.overdueLoansCount += 1;
    borrowerMetrics.totalOverdueBalance += overdueBalance;
    borrowerMetrics.maxDaysOverdue = Math.max(borrowerMetrics.maxDaysOverdue, daysOverdue);
    if (row.dueDate > borrowerMetrics.latestOverdueDueDate) {
      borrowerMetrics.latestOverdueDueDate = row.dueDate;
    }

    borrowerMap.set(row.borrowerId, borrowerMetrics);

    const branchBorrowers = branchBorrowerMap.get(row.branchName) ?? new Set<string>();
    branchBorrowers.add(row.borrowerId);
    branchBorrowerMap.set(row.branchName, branchBorrowers);
  }

  const rawRows = Array.from(borrowerMap.values())
    .map((row) => ({
      borrowerName: row.borrowerName,
      branch:
        row.branchNames.size === 1
          ? Array.from(row.branchNames)[0]!
          : Array.from(row.branchNames).sort((left, right) => left.localeCompare(right)).join(", "),
      collector:
        row.collectorNames.size === 1
          ? Array.from(row.collectorNames)[0]!
          : Array.from(row.collectorNames).sort((left, right) => left.localeCompare(right)).join(", "),
      overdueLoansCount: row.overdueLoansCount,
      totalOverdueBalance: row.totalOverdueBalance,
      maxDaysOverdue: row.maxDaysOverdue,
      latestOverdueDueDate: row.latestOverdueDueDate,
    }))
    .sort((left, right) => {
      if (right.maxDaysOverdue !== left.maxDaysOverdue) {
        return right.maxDaysOverdue - left.maxDaysOverdue;
      }

      return left.borrowerName.localeCompare(right.borrowerName);
    });

  return {
    summary: {
      overdueBorrowersCount: rawRows.length,
      overdueLoansCount: Array.from(borrowerMap.values()).reduce(
        (sum, row) => sum + row.overdueLoansCount,
        0,
      ),
      totalOverdueBalance: rawRows.reduce((sum, row) => sum + row.totalOverdueBalance, 0),
      averageOverdueBalancePerBorrower:
        rawRows.length > 0
          ? rawRows.reduce((sum, row) => sum + row.totalOverdueBalance, 0) / rawRows.length
          : 0,
      maxDaysOverdue: rawRows.reduce((max, row) => Math.max(max, row.maxDaysOverdue), 0),
      totalAffectedBranches: new Set(overdueLoanRows.map((row) => row.branchName)).size,
    },
    chartRows: branchRows.map((row) => ({
      bucket: row.branchName,
      values: {
        overdueBorrowers: branchBorrowerMap.get(row.branchName)?.size ?? 0,
      },
    })),
    rawRows,
  };
}

async function loadCollectorPerformanceReportData(
  access: ReportsReadyAccessState,
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string | null,
  dateTo: string | null,
  collectorId: string,
) {
  const collectorAccess = buildReportsCollectorAnalyticsAccess(
    access,
    branchRows.map((row) => row.branchId),
  );
  const lifetimeStart = "1900-01-01";
  const lifetimeEnd = currentManilaIsoDate();
  const resolvedDateFrom = dateFrom ?? lifetimeStart;
  const resolvedDateTo = dateTo ?? lifetimeEnd;
  const isLifetime = !dateFrom || !dateTo;
  const bucketMode = isLifetime ? ("month" as const) : resolveCollectorTrendBucketMode(resolvedDateFrom, resolvedDateTo);
  const collectorLoanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "reports_collector_detail_metrics",
    currentDate: currentManilaIsoDate(),
    where: inArray(loan_records.branch_id, branchRows.map((row) => row.branchId)),
  });
  const [{ rows }, trendBuckets, bucketRows] = await Promise.all([
    loadCollectorPerformanceRowsForCustomRange(collectorAccess, {
      dateFrom: resolvedDateFrom,
      dateTo: resolvedDateTo,
      collectorId,
      includePrevious: !isLifetime,
      mode: isLifetime ? "career" : "window",
    }),
    (async () => {
      return {
        bucketMode,
        rows: await loadCollectorTrendBucketsForCustomRange(collectorAccess, {
          collectorId,
          dateFrom: resolvedDateFrom,
          dateTo: resolvedDateTo,
          granularity: bucketMode,
        }),
      };
    })(),
    (async () => {
      const bucketExpression =
        bucketMode === "day"
          ? sql<string>`${collections.collection_date}::text`
          : bucketMode === "week"
            ? sql<string>`to_char(date_trunc('week', ${collections.collection_date}), 'YYYY-MM-DD')`
            : sql<string>`to_char(date_trunc('month', ${collections.collection_date}), 'YYYY-MM-01')`;

      return db
        .select({
          bucketKey: bucketExpression,
          totalCollected: sql<number>`coalesce(sum(${collections.amount}), 0)`,
          collectionsCount: sql<number>`count(*)`,
          borrowersHandled: sql<number>`count(distinct ${collectorLoanMetrics.borrowerId})`,
          activeLoansHandled: sql<number>`count(distinct case when ${buildStoredLoanStatusInSql(collectorLoanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)} then ${collectorLoanMetrics.loanId} end)`,
        })
        .from(collections)
        .innerJoin(collectorLoanMetrics, eq(collectorLoanMetrics.loanId, collections.loan_id))
        .where(
          and(
            eq(collections.collector_id, collectorId),
            inArray(collectorLoanMetrics.branchId, branchRows.map((row) => row.branchId)),
            gte(collections.collection_date, resolvedDateFrom),
            lte(collections.collection_date, resolvedDateTo),
          ),
        )
        .groupBy(bucketExpression)
        .orderBy(asc(bucketExpression))
        .catch(() => []);
    })(),
  ]);

  const collectorRow = rows.find((row) => row.collectorId === collectorId) ?? null;
  if (!collectorRow) {
    return null;
  }

  const bucketDefinitions = isLifetime
    ? trendBuckets.rows.map((row) => ({
        key: row.bucketKey,
        label: bucketKeyToCollectorPeriodLabel(row.bucketKey, trendBuckets.bucketMode),
      }))
    : enumerateCollectorBucketDefinitions(
        resolvedDateFrom,
        resolvedDateTo,
        trendBuckets.bucketMode,
      );
  const trendMap = new Map(trendBuckets.rows.map((row) => [row.bucketKey, row.totalCollected]));
  const bucketRowMap = new Map(
    bucketRows.map((row) => [
      row.bucketKey,
      {
        totalCollected: toNumber(row.totalCollected),
        collectionsCount: toNumber(row.collectionsCount),
        borrowersHandled: toNumber(row.borrowersHandled),
        activeLoansHandled: toNumber(row.activeLoansHandled),
      },
    ]),
  );

  return {
    collectorLabel: `${collectorRow.fullName} (${collectorRow.companyId})`,
    summary: {
      totalCollected: collectorRow.totalCollected,
      averageCollectionAmount: collectorRow.averageCollectionAmount,
      collectionEntries: collectorRow.collectionEntries,
      assignedActiveLoans: collectorRow.assignedActiveLoans,
      portfolioRecoveryRate: `${collectorRow.portfolioRecoveryRate.toLocaleString("en-PH", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`,
      missedPaymentRate: `${collectorRow.missedPaymentRate.toLocaleString("en-PH", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`,
      completionRate: `${collectorRow.completionRate.toLocaleString("en-PH", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}%`,
    },
    chartRows: bucketDefinitions.map((bucket) => ({
      bucket: bucket.label,
      values: {
        totalCollected: trendMap.get(bucket.key) ?? 0,
      },
    })),
    rawRows: bucketDefinitions.map((bucket) => {
      const metrics = bucketRowMap.get(bucket.key);
      const totalCollected = metrics?.totalCollected ?? 0;
      const collectionsCount = metrics?.collectionsCount ?? 0;

      return {
        period: bucket.label,
        totalCollected,
        collectionsCount,
        averagePerCollection: collectionsCount > 0 ? totalCollected / collectionsCount : 0,
        borrowersHandled: metrics?.borrowersHandled ?? 0,
        activeLoansHandled: metrics?.activeLoansHandled ?? 0,
      };
    }),
  };
}

async function loadCollectorLeaderboardReportData(
  access: ReportsReadyAccessState,
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string | null,
  dateTo: string | null,
) {
  const collectorAccess = buildReportsCollectorAnalyticsAccess(
    access,
    branchRows.map((row) => row.branchId),
  );
  const lifetimeEnd = currentManilaIsoDate();
  const { rows } = await loadCollectorPerformanceRowsForCustomRange(collectorAccess, {
    dateFrom: dateFrom ?? "1900-01-01",
    dateTo: dateTo ?? lifetimeEnd,
    includePrevious: Boolean(dateFrom && dateTo),
    mode: dateFrom && dateTo ? "window" : "career",
  });

  const sortedRows = rows.slice();
  const rawRows = sortedRows.map((row, index) => ({
    rank: index + 1,
    collectorLabel: row.fullName,
    companyId: row.companyId,
    branchName: row.branchName,
    areaLabel: row.areaLabel,
    averageMonthlyCollections: row.averageMonthlyCollections,
    totalCollected: row.totalCollected,
    assignedActiveLoans: row.assignedActiveLoans,
    portfolioRecoveryRate: `${row.portfolioRecoveryRate.toLocaleString("en-PH", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`,
    missedPaymentRate: `${row.missedPaymentRate.toLocaleString("en-PH", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}%`,
    periodChangePercent:
      row.periodChangePercent === null
        ? "-"
        : `${row.periodChangePercent >= 0 ? "+" : ""}${row.periodChangePercent.toLocaleString("en-PH", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}%`,
  }));
  const topCollector = sortedRows[0] ?? null;

  return {
    summary: {
      totalCollectorsRanked: rawRows.length,
      topCollector: topCollector ? `${topCollector.fullName} (${topCollector.companyId})` : "N/A",
      topCollectorAverageMonthlyCollections: topCollector?.averageMonthlyCollections ?? 0,
      totalCollectedAcrossRankedCollectors: rawRows.reduce((sum, row) => sum + row.totalCollected, 0),
      averageCollectedPerCollector:
        rawRows.length > 0
          ? rawRows.reduce((sum, row) => sum + row.totalCollected, 0) / rawRows.length
          : 0,
    },
    chartRows: sortedRows.slice(0, 10).map((row) => ({
      bucket: `${row.fullName} (${row.companyId})`,
      values: {
        averageMonthlyCollections: row.averageMonthlyCollections,
      },
    })),
    rawRows,
  };
}

function buildDefaultTitle(
  templateKey: AnalyticsReportTemplateKey,
  scopeLabel: string,
  dateLabel: string | null,
) {
  const template = getAnalyticsTemplateDefinition(templateKey);
  const baseLabel = template?.label ?? "Analytics Report";

  if (dateLabel) {
    return `${baseLabel} - ${dateLabel} - ${scopeLabel}`;
  }

  return `${baseLabel} - ${scopeLabel}`;
}

function buildSystemMonthlyDefaultTitle(
  templateKey: AnalyticsReportTemplateKey,
  scopeLabel: string,
  coverageLabel: string,
) {
  const template = getAnalyticsTemplateDefinition(templateKey);
  const baseLabel = template?.label ?? "System Report";

  return `${baseLabel} - ${coverageLabel} - ${scopeLabel}`;
}

async function loadAllBranchRows() {
  return db
    .select({
      branchId: branch.branch_id,
      branchName: branch.branch_name,
    })
    .from(branch)
    .orderBy(asc(branch.branch_name))
    .catch(() => []);
}

async function loadSystemMonthlyGenerationRecipients(
  systemUserId: string,
): Promise<ReportsSystemGenerationRecipient[]> {
  const [allBranchRows, adminUserRows, assignedUserRows] = await Promise.all([
    loadAllBranchRows(),
    db
      .select({
        userId: users.user_id,
      })
      .from(users)
      .innerJoin(roles, eq(roles.role_id, users.role_id))
      .where(
        and(
          eq(users.status, "active"),
          eq(roles.role_name, "Admin"),
          ne(users.user_id, systemUserId),
        ),
      )
      .catch(() => []),
    db
      .select({
        userId: users.user_id,
        roleName: roles.role_name,
        branchId: employee_branch_assignment.branch_id,
        branchName: branch.branch_name,
      })
      .from(users)
      .innerJoin(roles, eq(roles.role_id, users.role_id))
      .innerJoin(
        employee_branch_assignment,
        and(
          eq(employee_branch_assignment.employee_user_id, users.user_id),
          isNull(employee_branch_assignment.end_date),
        ),
      )
      .innerJoin(branch, eq(branch.branch_id, employee_branch_assignment.branch_id))
      .where(
        and(
          eq(users.status, "active"),
          inArray(roles.role_name, ["Auditor", "Branch Manager"]),
          ne(users.user_id, systemUserId),
        ),
      )
      .orderBy(asc(roles.role_name), asc(users.user_id), asc(branch.branch_name))
      .catch(() => []),
  ]);

  const recipients: ReportsSystemGenerationRecipient[] = [];
  const allBranchIds = allBranchRows.map((row) => row.branchId);

  for (const row of adminUserRows) {
    if (allBranchIds.length === 0) {
      continue;
    }

    recipients.push({
      userId: row.userId,
      roleName: "Admin",
      scopeBranchIds: allBranchIds,
      scopeLabel: "Global Scope",
      fixedBranchId: null,
      fixedBranchName: null,
    });
  }

  const assignmentsByUser = new Map<
    string,
    {
      roleName: ReportsSystemRecipientRole;
      branches: Array<{ branchId: number; branchName: string }>;
    }
  >();

  for (const row of assignedUserRows) {
    if (row.roleName !== "Auditor" && row.roleName !== "Branch Manager") {
      continue;
    }

    const entry = assignmentsByUser.get(row.userId) ?? {
      roleName: row.roleName,
      branches: [],
    };

    entry.branches.push({
      branchId: row.branchId,
      branchName: row.branchName,
    });
    assignmentsByUser.set(row.userId, entry);
  }

  for (const [userId, entry] of assignmentsByUser.entries()) {
    const dedupedBranches = Array.from(
      new Map(entry.branches.map((branchRow) => [branchRow.branchId, branchRow])).values(),
    ).sort((left, right) => left.branchName.localeCompare(right.branchName));

    if (dedupedBranches.length === 0) {
      continue;
    }

    if (entry.roleName === "Auditor") {
      recipients.push({
        userId,
        roleName: "Auditor",
        scopeBranchIds: dedupedBranches.map((branchRow) => branchRow.branchId),
        scopeLabel: formatAssignedBranchScopeLabel(dedupedBranches.length),
        fixedBranchId: null,
        fixedBranchName: null,
      });
      continue;
    }

    if (dedupedBranches.length !== 1) {
      continue;
    }

    recipients.push({
      userId,
      roleName: "Branch Manager",
      scopeBranchIds: [dedupedBranches[0]!.branchId],
      scopeLabel: dedupedBranches[0]!.branchName,
      fixedBranchId: dedupedBranches[0]!.branchId,
      fixedBranchName: dedupedBranches[0]!.branchName,
    });
  }

  return recipients;
}

export async function loadReportsPageData(access: ReportsReadyAccessState): Promise<ReportsPageData> {
  const [branchOptions, collectorOptions] = await Promise.all([
    loadVisibleBranchOptions(access),
    loadVisibleCollectorOptions(access),
  ]);
  const analyticsTemplates = buildAnalyticsTemplateOptions(
    branchOptions.length,
    access.roleName,
    access.canAccessAnalytics,
  );
  const analyticsTemplateCategories = buildAnalyticsTemplateCategoryOptions().filter((category) =>
    analyticsTemplates.some((template) => template.category === category.key),
  );

  return {
    branchOptions,
    collectorOptions,
    analyticsTemplates,
    analyticsTemplateCategories,
    operationalDocumentTemplates: buildOperationalDocumentTemplateOptions(access.roleName),
  };
}

export async function loadReportsLibraryPageData(
  access: ReportsReadyAccessState,
  filters: ReportsLibraryFilterState,
): Promise<ReportsLibraryPageData> {
  const needsGeneratedByRoleJoin = Boolean(filters.generatedByRoleName);
  const scopeWhere = buildReportsLibraryScopeWhere(access);
  const visibilityWhere = buildReportsSystemVisibilityWhere(access);
  const visibleScopedWhere = whereFrom(
    [scopeWhere, visibilityWhere].filter((value): value is SQL => Boolean(value)),
  );
  const advancedWhere = buildReportsLibraryAdvancedWhere(filters);
  const advancedScopedWhere = whereFrom(
    [visibleScopedWhere, advancedWhere].filter((value): value is SQL => Boolean(value)),
  );
  const categoryWhere = buildReportsLibraryCategoryWhere(filters.category);
  const categoryScopedWhere = whereFrom(
    [advancedScopedWhere, categoryWhere].filter((value): value is SQL => Boolean(value)),
  );
  const finalWhere = whereFrom(
    [categoryScopedWhere, eq(reports.status, filters.status)].filter((value): value is SQL => Boolean(value)),
  );

  const [
    visibleBranchOptions,
    templateSourceRows,
    generatedByUserSourceRows,
    allCount,
    analyticsCount,
    documentsCount,
    activeCount,
    archivedCount,
    totalCount,
  ] = await Promise.all([
    loadVisibleLibraryBranchOptions(access),
    db
      .selectDistinct({
        templateKey: reports.template_key,
        reportCategory: reports.report_category,
      })
      .from(reports)
      .where(visibleScopedWhere)
      .catch(() => []),
    db
      .selectDistinct({
        generatedByUserId: reports.generated_by,
        generatedByFirstName: employee_info.first_name,
        generatedByMiddleName: employee_info.middle_name,
        generatedByLastName: employee_info.last_name,
        generatedByUsername: users.username,
        generatedByCompanyId: users.company_id,
        generatedByRoleName: roles.role_name,
      })
      .from(reports)
      .innerJoin(users, eq(users.user_id, reports.generated_by))
      .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
      .leftJoin(roles, eq(roles.role_id, users.role_id))
      .where(
        whereFrom([
          visibleScopedWhere,
          eq(reports.generated_type, "user"),
        ].filter((value): value is SQL => Boolean(value))),
      )
      .orderBy(asc(users.username))
      .catch(() => []),
    countReportsForLibrary(advancedScopedWhere, {
      includeGeneratedByRoleJoin: needsGeneratedByRoleJoin,
    }),
    countReportsForLibrary(
      whereFrom([advancedScopedWhere, eq(reports.report_category, "analytics")].filter((value): value is SQL => Boolean(value))),
      {
        includeGeneratedByRoleJoin: needsGeneratedByRoleJoin,
      },
    ),
    countReportsForLibrary(
      whereFrom([advancedScopedWhere, eq(reports.report_category, "document")].filter((value): value is SQL => Boolean(value))),
      {
        includeGeneratedByRoleJoin: needsGeneratedByRoleJoin,
      },
    ),
    countReportsForLibrary(
      whereFrom([categoryScopedWhere, eq(reports.status, "active")].filter((value): value is SQL => Boolean(value))),
      {
        includeGeneratedByRoleJoin: needsGeneratedByRoleJoin,
      },
    ),
    countReportsForLibrary(
      whereFrom([categoryScopedWhere, eq(reports.status, "archived")].filter((value): value is SQL => Boolean(value))),
      {
        includeGeneratedByRoleJoin: needsGeneratedByRoleJoin,
      },
    ),
    countReportsForLibrary(finalWhere, {
      includeGeneratedByRoleJoin: needsGeneratedByRoleJoin,
    }),
  ]);

  const templates = Array.from(
    new Map(
      templateSourceRows
        .map((row) => {
          const normalizedTemplateKey = normalizeReportTemplateKey(row.templateKey);
          const templateCategory = resolveReportTemplateCategory(normalizedTemplateKey);

          return [
            normalizedTemplateKey,
            {
              templateKey: normalizedTemplateKey,
              label: resolveReportTemplateLabel(normalizedTemplateKey),
              templateCategory:
                templateCategory?.key ?? (row.reportCategory === "document" ? "documents" : "financials"),
            },
          ] as const;
        })
        .sort((left, right) => left[1].label.localeCompare(right[1].label)),
    ).values(),
  );

  const templateCategories = Array.from(
    new Map(
      templates
        .map((row) => {
          const templateCategory = resolveReportTemplateCategory(row.templateKey);

          return [
            row.templateCategory,
            {
              key: row.templateCategory,
              label: templateCategory?.label ?? (row.templateCategory === "documents" ? "Documents" : "Financials"),
              reportCategory: templateCategory?.reportCategory ?? (row.templateCategory === "documents" ? "document" : "analytics"),
            },
          ] as const;
        })
        .sort((left, right) => left[1].label.localeCompare(right[1].label)),
    ).values(),
  );

  const generatedByUsers = Array.from(
    new Map(
      generatedByUserSourceRows
        .map((row) => [
          row.generatedByUserId,
          {
            userId: row.generatedByUserId,
            displayName: buildReportUserOptionLabel({
              firstName: row.generatedByFirstName,
              middleName: row.generatedByMiddleName,
              lastName: row.generatedByLastName,
              companyId: row.generatedByCompanyId,
              username: row.generatedByUsername,
            }),
            roleName: row.generatedByRoleName,
          },
        ] as const)
        .sort((left, right) => left[1].displayName.localeCompare(right[1].displayName)),
    ).values(),
  );

  const generatedByRoles = Array.from(
    new Map(
      generatedByUsers
        .filter((row) => Boolean(row.roleName))
        .map((row) => [row.roleName as string, { roleName: row.roleName as string }] as const)
        .sort((left, right) => left[0].localeCompare(right[0])),
    ).values(),
  );

  const totalPages = Math.max(Math.ceil(totalCount / REPORTS_LIBRARY_PAGE_SIZE), 1);
  const safePage = Math.min(Math.max(filters.page, 1), totalPages);
  const paginatedRowsSource = await db
    .select({
      reportId: reports.report_id,
      title: reports.title,
      reportCategory: reports.report_category,
      templateKey: reports.template_key,
      generatedType: reports.generated_type,
      generatedAt: reports.generated_at,
      status: reports.status,
      generatedByUserId: reports.generated_by,
      generatedByName: sql<string>`coalesce(nullif(trim(concat_ws(' ', ${employee_info.first_name}, ${employee_info.middle_name}, ${employee_info.last_name})), ''), ${users.username})`,
      generatedByCompanyId: users.company_id,
      generatedByRoleName: roles.role_name,
      branchScope: reports.branch_scope,
      dateFrom: reports.date_from,
      dateTo: reports.date_to,
      sourceEntityType: reports.source_entity_type,
      sourceEntityId: reports.source_entity_id,
    })
    .from(reports)
    .innerJoin(users, eq(users.user_id, reports.generated_by))
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .leftJoin(roles, eq(roles.role_id, users.role_id))
    .where(finalWhere)
    .orderBy(desc(reports.generated_at), desc(reports.report_id))
    .limit(REPORTS_LIBRARY_PAGE_SIZE)
    .offset((safePage - 1) * REPORTS_LIBRARY_PAGE_SIZE)
    .catch(() => []);

  const paginatedRows = paginatedRowsSource.map((row) =>
    buildReportsLibraryRow({
      reportId: row.reportId,
      title: row.title,
      reportCategory: row.reportCategory,
      templateKey: row.templateKey,
      generatedType: row.generatedType,
      generatedAt: row.generatedAt,
      status: row.status,
      generatedByUserId: row.generatedByUserId,
      generatedByName: row.generatedByName,
      generatedByCompanyId: row.generatedByCompanyId,
      generatedByRoleName: row.generatedByRoleName,
      branchScope: row.branchScope,
      dateFrom: row.dateFrom,
      dateTo: row.dateTo,
      sourceEntityType: row.sourceEntityType,
      sourceEntityId: row.sourceEntityId,
    }),
  );

  return {
    filters: {
      ...filters,
      page: safePage,
    },
    rows: paginatedRows,
    page: safePage,
    pageSize: REPORTS_LIBRARY_PAGE_SIZE,
    totalCount,
    counts: {
      all: allCount,
      analytics: analyticsCount,
      documents: documentsCount,
      active: activeCount,
      archived: archivedCount,
    },
    filterOptions: {
      templateCategories,
      templates,
      generatedByRoles,
      generatedByUsers,
      branches: visibleBranchOptions,
    },
  };
}

type LoadReportViewerResult =
  | {
      ok: true;
      data: ReportsViewerPageData;
    }
  | {
      ok: false;
      code: "not_found" | "ineligible";
      message: string;
    };

type UpdateReportStatusResult =
  | {
      ok: true;
      reportId: number;
      status: "active" | "archived";
    }
  | {
      ok: false;
      code: "not_found" | "forbidden" | "unsupported";
      message: string;
    };

export async function loadReportViewerData(
  access: ReportsReadyAccessState,
  reportId: number,
): Promise<LoadReportViewerResult> {
  const scopeWhere = buildReportsLibraryScopeWhere(access);
  const reportRow = await db
    .select({
      reportId: reports.report_id,
      title: reports.title,
      reportCategory: reports.report_category,
      templateKey: reports.template_key,
      filters: reports.filters,
      generatedType: reports.generated_type,
      generatedAt: reports.generated_at,
      status: reports.status,
      generatedByName: sql<string>`coalesce(nullif(trim(concat_ws(' ', ${employee_info.first_name}, ${employee_info.middle_name}, ${employee_info.last_name})), ''), ${users.username})`,
      generatedByRoleName: roles.role_name,
      branchScope: reports.branch_scope,
      dateFrom: reports.date_from,
      dateTo: reports.date_to,
      sourceEntityType: reports.source_entity_type,
      sourceEntityId: reports.source_entity_id,
      snapshot: reports.snapshot,
    })
    .from(reports)
    .innerJoin(users, eq(users.user_id, reports.generated_by))
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .leftJoin(roles, eq(roles.role_id, users.role_id))
    .where(scopeWhere ? and(eq(reports.report_id, reportId), scopeWhere) : eq(reports.report_id, reportId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!reportRow) {
    return {
      ok: false,
      code: "not_found",
      message: "This saved report is not available in your current reporting scope.",
    };
  }

  if (
    !isSystemGeneratedReportVisibleToAccess(access, {
      templateKey: reportRow.templateKey,
      generatedType: reportRow.generatedType,
      branchScope: reportRow.branchScope,
      filters: reportRow.filters,
    })
  ) {
    return {
      ok: false,
      code: "not_found",
      message: "This saved report is not available in your current reporting scope.",
    };
  }

  if (
    reportRow.templateKey === "loan_receipt_summary" &&
    reportRow.sourceEntityType === "loan" &&
    reportRow.sourceEntityId !== null
  ) {
    const loanSource = await loadLoanDocumentSource(access, reportRow.sourceEntityId);
    if (!loanSource || !isLoanReceiptSummaryEligible(loanSource.status, loanSource.outstandingBalance)) {
      return {
        ok: false,
        code: "ineligible",
        message:
          "Loan receipt summaries are only viewable for loans that are completed or archived with zero remaining balance.",
      };
    }
  }

  const branchScopeNames =
    reportRow.branchScope.length > 0
      ? await db
          .select({
            branchId: branch.branch_id,
            branchName: branch.branch_name,
          })
          .from(branch)
          .where(inArray(branch.branch_id, reportRow.branchScope))
          .orderBy(asc(branch.branch_name))
          .then((rows) => rows.map((row) => row.branchName))
          .catch(() => [])
      : [];

  return {
    ok: true,
    data: {
      reportId: reportRow.reportId,
      title: reportRow.title,
      reportCategory: reportRow.reportCategory,
      templateKey: normalizeReportTemplateKey(reportRow.templateKey),
      templateLabel: resolveReportTemplateLabel(reportRow.templateKey),
      generatedType: reportRow.generatedType,
      generatedAt: reportRow.generatedAt,
      generatedByName: reportRow.generatedByName,
      generatedByRoleName: reportRow.generatedByRoleName,
      status: reportRow.status,
      branchScopeIds: reportRow.branchScope,
      branchScopeNames,
      dateFrom: reportRow.dateFrom,
      dateTo: reportRow.dateTo,
      sourceEntityType: reportRow.sourceEntityType,
      sourceEntityId: reportRow.sourceEntityId,
      snapshot: reportRow.snapshot as SavedReportSnapshot,
    },
  };
}

export async function updateSavedReportStatus(
  access: ReportsReadyAccessState,
  reportId: number,
  status: "active" | "archived",
): Promise<UpdateReportStatusResult> {
  const scopeWhere = buildReportsLibraryScopeWhere(access);
  const reportRow = await db
    .select({
      reportId: reports.report_id,
      generatedBy: reports.generated_by,
      generatedType: reports.generated_type,
      status: reports.status,
    })
    .from(reports)
    .where(scopeWhere ? and(eq(reports.report_id, reportId), scopeWhere) : eq(reports.report_id, reportId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!reportRow) {
    return {
      ok: false,
      code: "not_found",
      message: "This saved report is not available in your current reporting scope.",
    };
  }

  if (reportRow.generatedType !== "user") {
    return {
      ok: false,
      code: "unsupported",
      message: "Archive and restore are only available for user-generated reports right now.",
    };
  }

  if (access.roleName !== "Admin" && reportRow.generatedBy !== access.userId) {
    return {
      ok: false,
      code: "forbidden",
      message: "You can only archive or restore reports that you generated yourself.",
    };
  }

  if (reportRow.status === status) {
    return {
      ok: true,
      reportId: reportRow.reportId,
      status,
    };
  }
  
  const updatedRow = await db
    .update(reports)
    .set({ status })
    .where(eq(reports.report_id, reportId))
    .returning({
      reportId: reports.report_id,
      status: reports.status,
    })
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!updatedRow) {
    return {
      ok: false,
      code: "not_found",
      message: "Unable to update the saved report status right now.",
    };
  }

  return {
    ok: true,
    reportId: updatedRow.reportId,
    status: updatedRow.status,
  };
}

export async function resolveReportsSystemUser(): Promise<ReportsSystemUserLookupResult> {
  const configuredUserId = process.env.REPORTS_SYSTEM_USER_ID?.trim();
  const configuredUsername = process.env.REPORTS_SYSTEM_USERNAME?.trim();
  const configuredCompanyId = process.env.REPORTS_SYSTEM_COMPANY_ID?.trim();

  const selector =
    configuredUserId
      ? eq(users.user_id, configuredUserId)
      : configuredUsername
        ? eq(users.username, configuredUsername)
        : configuredCompanyId
          ? eq(users.company_id, configuredCompanyId)
          : null;

  if (!selector) {
    return {
      ok: false,
      message:
        "Set REPORTS_SYSTEM_USER_ID, REPORTS_SYSTEM_USERNAME, or REPORTS_SYSTEM_COMPANY_ID before creating system-generated reports.",
    };
  }

  const userRow = await db
    .select({
      userId: users.user_id,
      username: users.username,
      companyId: users.company_id,
      roleName: roles.role_name,
      status: users.status,
    })
    .from(users)
    .leftJoin(roles, eq(roles.role_id, users.role_id))
    .where(selector)
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!userRow) {
    return {
      ok: false,
      message:
        "The configured Reports system user could not be found. Check REPORTS_SYSTEM_USER_ID, REPORTS_SYSTEM_USERNAME, or REPORTS_SYSTEM_COMPANY_ID.",
    };
  }

  return {
    ok: true,
    user: userRow,
  };
}

export function buildSystemGeneratedReportFilters(input: ReportsSystemDuplicateLookupInput) {
  return buildSystemGeneratedFiltersMetadata(input);
}

export async function findExistingSystemGeneratedReportDuplicate(
  input: ReportsSystemDuplicateLookupInput,
) {
  const normalizedTemplateKey = normalizeReportTemplateKey(input.templateKey);
  const normalizedBranchScope = sortBranchIds(input.branchScope);
  const expectedScopeKey = buildSystemGeneratedScopeKey(normalizedBranchScope);
  const matchingRow = await db
    .select({
      reportId: reports.report_id,
      title: reports.title,
      generatedAt: reports.generated_at,
      status: reports.status,
    })
    .from(reports)
    .where(
      and(
        eq(reports.generated_type, "system"),
        eq(reports.template_key, normalizedTemplateKey),
        sql`coalesce(${reports.filters} ->> 'systemCoverageMonth', '') = ${input.coverageMonth}`,
        sql`coalesce(${reports.filters} ->> 'systemRecipientRole', '') = ${input.recipientRole}`,
        sql`coalesce(${reports.filters} ->> 'systemRecipientUserId', '') = ${input.recipientUserId ?? ""}`,
        sql`coalesce(${reports.filters} ->> 'systemScopeKey', array_to_string(${reports.branch_scope}, ',')) = ${expectedScopeKey}`,
      ),
    )
    .orderBy(desc(reports.generated_at), desc(reports.report_id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!matchingRow) {
    return {
      exists: false as const,
    };
  }

  return {
    exists: true as const,
    reportId: matchingRow.reportId,
    title: matchingRow.title,
    generatedAt: matchingRow.generatedAt,
    status: matchingRow.status,
  };
}

async function generateAnalyticsReportInternal(
  access: ReportsReadyAccessState,
  input: GenerateAnalyticsReportInput,
  options: GenerateAnalyticsReportOptions = {},
) {
  if (!access.canAccessAnalytics) {
    return {
      ok: false as const,
      message: "Analytical report generation is not available for your current role.",
    };
  }

  const template = getAnalyticsTemplateDefinition(input.templateKey);
  if (!template) {
    return {
      ok: false as const,
      message: "Select a valid analytics template.",
    };
  }

  if (!template.implemented) {
    return {
      ok: false as const,
      message: "This analytics template is planned but not implemented yet.",
    };
  }

  if (!template.allowedRoles.includes(access.roleName)) {
    return {
      ok: false as const,
      message: "This analytics template is not available for your current role.",
    };
  }

  const normalizedBranchIds = sortBranchIds(
    access.fixedBranchId !== null ? [access.fixedBranchId] : input.branchIds,
  );

  if (normalizedBranchIds.length === 0) {
    return {
      ok: false as const,
      message: "Select at least one branch before generating a report.",
    };
  }

  if (normalizedBranchIds.some((branchId) => !access.allowedBranchIds.includes(branchId))) {
    return {
      ok: false as const,
      message: "One or more selected branches are outside your reporting scope.",
    };
  }

  if (normalizedBranchIds.length < template.minBranchCount) {
    return {
      ok: false as const,
      message:
        template.minBranchCount > 1
          ? `${template.label} requires at least two selected branches.`
          : "Select a valid branch scope for this report.",
    };
  }

  if (template.maxBranchCount !== null && normalizedBranchIds.length > template.maxBranchCount) {
    return {
      ok: false as const,
      message:
        template.maxBranchCount === 1
          ? `${template.label} requires exactly one selected branch.`
          : `${template.label} supports at most ${template.maxBranchCount} selected branches.`,
    };
  }

  const selectedBranchRows = await loadSelectedBranchRows(normalizedBranchIds);
  if (selectedBranchRows.length !== normalizedBranchIds.length) {
    return {
      ok: false as const,
      message: "Unable to resolve the selected branch scope.",
    };
  }

  const scopeLabel = buildScopeLabel(selectedBranchRows.map((row) => row.branchName));
  let dateFrom: string | null = null;
  let dateTo: string | null = null;
  let generatedLabel: string;
  let dateLabel: string | null = null;

  if (template.dateMode === "range") {
    if (!input.datePreset) {
      return {
        ok: false as const,
        message: "Select a valid date range preset for this report.",
      };
    }

    if (input.datePreset === "custom") {
      if (!input.dateFrom || !input.dateTo) {
        return {
          ok: false as const,
          message: "Select a valid custom date range for this report.",
        };
      }

      if (input.dateTo < input.dateFrom) {
        return {
          ok: false as const,
          message: "End date cannot be earlier than start date.",
        };
      }

      dateFrom = input.dateFrom;
      dateTo = input.dateTo;
      dateLabel = buildDateRangeLabel(dateFrom, dateTo);
    } else if (input.datePreset === "lifetime") {
      dateFrom = null;
      dateTo = null;
      dateLabel = getReportsDatePresetLabel(input.datePreset);
    } else {
      if (!input.dateFrom || !input.dateTo) {
        return {
          ok: false as const,
          message: "Unable to resolve the selected date range preset.",
        };
      }

      dateFrom = input.dateFrom;
      dateTo = input.dateTo;
      dateLabel = getReportsDatePresetLabel(input.datePreset);
    }

    generatedLabel = `Reporting window: ${dateLabel}`;
  } else if (template.dateMode === "month") {
    if (!input.month) {
      return {
        ok: false as const,
        message: "Select a valid month for this report.",
      };
    }

    const monthWindow = resolveMonthWindow(input.month);
    if (!monthWindow) {
      return {
        ok: false as const,
        message: "Selected month is invalid.",
      };
    }

    dateFrom = monthWindow.start;
    dateTo = monthWindow.end;
    dateLabel = monthWindow.label;
    generatedLabel = `Reporting month: ${monthWindow.label}`;
  } else {
    generatedLabel = "Snapshot generated from the current live-loan state.";
  }

  const resolvedTitle = input.title.trim() || buildDefaultTitle(template.key, scopeLabel, dateLabel);

  let snapshot: unknown;
  if (template.key === "collector_performance_report" && !input.collectorId) {
    return {
      ok: false as const,
      message: "Select a collector for this performance report.",
    };
  }

  if (template.key === "financial_overview") {
    const reportData = await loadFinancialOverviewData(selectedBranchRows, dateFrom, dateTo);
    snapshot = buildFinancialOverviewSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      periodRows: reportData.periodRows,
      branchRows: reportData.branchRows,
    });
  } else if (template.key === "collections_summary") {
    const reportData = await loadCollectionsSummaryData(selectedBranchRows, dateFrom, dateTo);
    snapshot = buildCollectionsSummarySnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      chartSeries: reportData.chartSeries,
      trendRows: reportData.trendRows,
      rawColumns: reportData.rawColumns,
      rawRows: reportData.rawRows,
      branchRows: reportData.branchRows,
      bucketMode: reportData.bucketMode,
    });
  } else if (template.key === "active_loans_summary") {
    const reportData = await loadActiveLoansSummaryData(selectedBranchRows);
    snapshot = buildActiveLoansSummarySnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      chartRows: reportData.chartRows,
      branchRows: reportData.branchRows,
      collectorRows: reportData.collectorRows,
    });
  } else if (template.key === "loans_summary") {
    const reportData = await loadLoansSummaryData(selectedBranchRows, dateFrom, dateTo);
    snapshot = buildLoansSummarySnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      chartRows: reportData.chartRows,
      rawRows: reportData.rawRows,
    });
  } else if (template.key === "overdue_loans_report") {
    const reportData = await loadOverdueLoansReportData(selectedBranchRows, dateFrom, dateTo);
    snapshot = buildOverdueLoansReportSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      chartRows: reportData.chartRows,
      rawRows: reportData.rawRows,
    });
  } else if (template.key === "collections_by_collector") {
    const reportData = await loadCollectionsByCollectorData(selectedBranchRows, dateFrom, dateTo);
    snapshot = buildCollectionsByCollectorSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      chartRows: reportData.chartRows,
      rawRows: reportData.rawRows,
    });
  } else if (template.key === "released_loans_report") {
    const reportData = await loadReleasedLoansReportData(selectedBranchRows, dateFrom, dateTo);
    snapshot = buildReleasedLoansReportSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      chartRows: reportData.chartRows,
      rawRows: reportData.rawRows,
    });
  } else if (template.key === "closed_loans_report") {
    const reportData = await loadClosedLoansReportData(selectedBranchRows, dateFrom, dateTo);
    snapshot = buildClosedLoansReportSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      chartRows: reportData.chartRows,
      rawRows: reportData.rawRows,
    });
  } else if (template.key === "branch_collections_comparison") {
    const reportData = await loadBranchCollectionsComparisonData(selectedBranchRows, dateFrom, dateTo);
    snapshot = buildBranchCollectionsComparisonSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      chartRows: reportData.chartRows,
      rawRows: reportData.rawRows,
    });
  } else if (template.key === "branch_loans_comparison") {
    const reportData = await loadBranchLoansComparisonData(selectedBranchRows, dateFrom, dateTo);
    snapshot = buildBranchLoansComparisonSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      chartRows: reportData.chartRows,
      rawRows: reportData.rawRows,
    });
  } else if (template.key === "borrower_summary") {
    const reportData = await loadBorrowerSummaryData(selectedBranchRows, dateFrom, dateTo);
    snapshot = buildBorrowerSummarySnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      chartRows: reportData.chartRows,
      rawRows: reportData.rawRows,
    });
  } else if (template.key === "borrowers_with_overdue_loans") {
    const reportData = await loadBorrowersWithOverdueLoansData(selectedBranchRows, dateFrom, dateTo);
    snapshot = buildBorrowersWithOverdueLoansSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      chartRows: reportData.chartRows,
      rawRows: reportData.rawRows,
    });
  } else if (template.key === "collector_performance_report") {
    const reportData = await loadCollectorPerformanceReportData(
      access,
      selectedBranchRows,
      dateFrom,
      dateTo,
      input.collectorId!,
    );

    if (!reportData) {
      return {
        ok: false as const,
        message: "The selected collector is outside the chosen branch scope or no longer available.",
      };
    }

    snapshot = buildCollectorPerformanceReportSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      collectorLabel: reportData.collectorLabel,
      summary: reportData.summary,
      chartRows: reportData.chartRows,
      rawRows: reportData.rawRows,
    });
  } else if (template.key === "collector_leaderboard_report") {
    const reportData = await loadCollectorLeaderboardReportData(
      access,
      selectedBranchRows,
      dateFrom,
      dateTo,
    );
    snapshot = buildCollectorLeaderboardReportSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      chartRows: reportData.chartRows,
      rawRows: reportData.rawRows,
    });
  } else if (template.key === "branch_performance_overview") {
    const reportData = await loadBranchPerformanceOverviewData(selectedBranchRows[0]!, dateFrom, dateTo);
    snapshot = buildBranchPerformanceOverviewSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      branchName: selectedBranchRows[0]!.branchName,
      summary: reportData.summary,
      financialChartRows: reportData.financialChartRows,
      operationalChartRows: reportData.operationalChartRows,
      rawRows: reportData.rawRows,
    });
  } else {
    const reportData = await loadBranchPerformanceComparisonData(selectedBranchRows, dateFrom, dateTo, {
      trimLargeComparisons: options.generatedType === "system",
    });
    snapshot = buildBranchPerformanceComparisonSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      branchRows: reportData.branchRows,
      comparisonNote: reportData.comparisonNote,
    });
  }

  const insertedReport = await db
    .insert(reports)
    .values({
      title: resolvedTitle,
      report_category: "analytics",
      template_key: template.key,
      generated_type: options.generatedType ?? "user",
      generated_by: options.generatedByUserId ?? access.userId,
      filters: {
        branchIds: normalizedBranchIds,
        collectorId: input.collectorId,
        datePreset: input.datePreset,
        month: input.month,
        dateFrom,
        dateTo,
        ...(options.additionalFilters ?? {}),
      },
      branch_scope: normalizedBranchIds,
      date_from: dateFrom,
      date_to: dateTo,
      snapshot,
      status: "active",
    })
    .returning({
      reportId: reports.report_id,
      title: reports.title,
      generatedAt: reports.generated_at,
    })
    .catch(() => []);

  const reportRow = insertedReport[0];
  if (!reportRow) {
    return {
      ok: false as const,
      message: "Unable to save the generated report right now.",
    };
  }

  return {
    ok: true as const,
    reportId: reportRow.reportId,
    title: reportRow.title,
    generatedAt: reportRow.generatedAt,
    templateLabel: template.label,
    templateKey: template.key,
    branchCount: normalizedBranchIds.length,
    dateFrom,
    dateTo,
  };
}

export async function generateAnalyticsReport(
  access: ReportsReadyAccessState,
  input: GenerateAnalyticsReportInput,
) {
  return generateAnalyticsReportInternal(access, input);
}

async function generatePreviousMonthSystemReportsCore(): Promise<ReportsSystemMonthlyGenerationResult> {
  const coverageWindow = resolvePreviousCompletedMonthWindow();
  if (!coverageWindow) {
    return {
      ok: false,
      message: "Unable to resolve the previous completed calendar month.",
    };
  }

  const systemUserResult = await resolveReportsSystemUser();
  if (!systemUserResult.ok) {
    return {
      ok: false,
      message: systemUserResult.message,
    };
  }

  if (systemUserResult.user.status !== "active") {
    return {
      ok: false,
      message: "The configured Reports system user must be active before monthly system reports can be generated.",
    };
  }

  const recipients = await loadSystemMonthlyGenerationRecipients(systemUserResult.user.userId);
  if (recipients.length === 0) {
    return {
      ok: false,
      message: "No eligible Admin, Auditor, or Branch Manager recipients were found for monthly system report generation.",
    };
  }

  const items: ReportsSystemMonthlyGenerationItem[] = [];
  let created = 0;
  let duplicates = 0;
  let skipped = 0;
  let errors = 0;

  for (const recipient of recipients) {
    const access = buildSystemRecipientAccessState(recipient);
    const templateKeys = getSystemGeneratedTemplateKeysForRole(recipient.roleName);

    for (const templateKey of templateKeys) {
      const duplicateResult = await findExistingSystemGeneratedReportDuplicate({
        templateKey,
        coverageMonth: coverageWindow.coverageMonth,
        branchScope: recipient.scopeBranchIds,
        recipientRole: recipient.roleName,
        recipientUserId: recipient.userId,
      });

      if (duplicateResult.exists) {
        duplicates += 1;
        items.push({
          roleName: recipient.roleName,
          recipientUserId: recipient.userId,
          scopeLabel: recipient.scopeLabel,
          templateKey,
          outcome: "duplicate",
          reportId: duplicateResult.reportId,
          message: "Skipped because a system-generated report for this month, scope, and recipient already exists.",
        });
        continue;
      }

      const generationResult = await generateAnalyticsReportInternal(
        access,
        {
          title: buildSystemMonthlyDefaultTitle(
            templateKey,
            recipient.scopeLabel,
            coverageWindow.coverageLabel,
          ),
          templateKey,
          branchIds: recipient.scopeBranchIds,
          collectorId: null,
          datePreset: "custom",
          month: coverageWindow.coverageMonth,
          dateFrom: coverageWindow.dateFrom,
          dateTo: coverageWindow.dateTo,
        },
        {
          generatedType: "system",
          generatedByUserId: systemUserResult.user.userId,
          additionalFilters: buildSystemGeneratedReportFilters({
            templateKey,
            coverageMonth: coverageWindow.coverageMonth,
            branchScope: recipient.scopeBranchIds,
            recipientRole: recipient.roleName,
            recipientUserId: recipient.userId,
          }),
        },
      );

      if (!generationResult.ok) {
        const outcome =
          generationResult.message.includes("requires") ||
          generationResult.message.includes("outside your reporting scope") ||
          generationResult.message.includes("Unable to resolve the selected branch scope")
            ? "skipped"
            : "error";

        if (outcome === "skipped") {
          skipped += 1;
        } else {
          errors += 1;
        }

        items.push({
          roleName: recipient.roleName,
          recipientUserId: recipient.userId,
          scopeLabel: recipient.scopeLabel,
          templateKey,
          outcome,
          message: generationResult.message,
        });
        continue;
      }

      created += 1;
      items.push({
        roleName: recipient.roleName,
        recipientUserId: recipient.userId,
        scopeLabel: recipient.scopeLabel,
        templateKey,
        outcome: "created",
        reportId: generationResult.reportId,
        message: "System-generated monthly report created.",
      });
    }
  }

  return {
    ok: true,
    coverageMonth: coverageWindow.coverageMonth,
    coverageLabel: coverageWindow.coverageLabel,
    dateFrom: coverageWindow.dateFrom,
    dateTo: coverageWindow.dateTo,
    totals: {
      recipients: recipients.length,
      created,
      duplicates,
      skipped,
      errors,
    },
    items,
  };
}

export async function generatePreviousMonthSystemReports(
  triggeredBy: ReportsReadyAccessState,
): Promise<ReportsSystemMonthlyGenerationResult> {
  if (triggeredBy.roleName !== "Admin") {
    return {
      ok: false,
      message: "Only Admin users can trigger monthly system-generated reports.",
    };
  }

  return generatePreviousMonthSystemReportsCore();
}

export async function runScheduledPreviousMonthSystemReports(): Promise<ReportsSystemMonthlyGenerationResult> {
  return generatePreviousMonthSystemReportsCore();
}

async function loadUserDisplayRows(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return [];
  }

  return db
    .select({
      userId: users.user_id,
      username: users.username,
      firstName: employee_info.first_name,
      middleName: employee_info.middle_name,
      lastName: employee_info.last_name,
    })
    .from(users)
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .where(inArray(users.user_id, uniqueIds))
    .catch(() => []);
}

function buildLoanScheduleRows(params: {
  startDate: string;
  dueDate: string;
  totalPayable: number;
  estimatedDailyPayment: number | null;
  collectionRows: Array<{
    collectionDate: string;
    amount: number;
    note: string;
    collectorName: string;
    outstandingBalance: number;
  }>;
}) {
  const rowsByDate = new Map<
    string,
    {
      amount: number;
      notes: string[];
      collectors: string[];
      outstandingBalance: number;
    }
  >();

  for (const row of params.collectionRows) {
    const existing = rowsByDate.get(row.collectionDate) ?? {
      amount: 0,
      notes: [],
      collectors: [],
      outstandingBalance: params.totalPayable,
    };
    existing.amount += row.amount;
    if (row.note.trim()) {
      existing.notes.push(row.note.trim());
    }
    if (row.collectorName.trim()) {
      existing.collectors.push(row.collectorName.trim());
    }
    existing.outstandingBalance = row.outstandingBalance;
    rowsByDate.set(row.collectionDate, existing);
  }

  let lastOutstandingBalance = params.totalPayable;

  return enumerateIsoDates(params.startDate, params.dueDate).map((date) => {
    const current = rowsByDate.get(date);
    if (current) {
      lastOutstandingBalance = current.outstandingBalance;
    }

      return {
        date,
        principalPlusInterest: params.totalPayable,
        dailyPayment: params.estimatedDailyPayment ?? 0,
        outstandingBalance: lastOutstandingBalance,
        amount: current ? current.amount : "-",
        collector: current?.collectors.length
          ? Array.from(new Set(current.collectors)).join(", ")
          : "-",
        note: current?.notes.length
        ? Array.from(new Set(current.notes)).join("; ")
        : "-",
    };
  });
}

async function loadLoanDocumentSource(access: ReportsReadyAccessState, loanId: number) {
  const loan = await db
    .select({
      loanId: loan_records.loan_id,
      loanCode: loan_records.loan_code,
      borrowerId: loan_records.borrower_id,
      principal: loan_records.principal,
      interest: loan_records.interest,
      collectorId: loan_records.collector_id,
      startDate: loan_records.start_date,
      dueDate: loan_records.due_date,
      termDays: loan_records.term_days,
      branchId: loan_records.branch_id,
      status: loan_records.status,
    })
    .from(loan_records)
    .where(eq(loan_records.loan_id, loanId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!loan) {
    return null;
  }

  if (!access.canAccessOperationalDocuments || !access.allowedBranchIds.includes(loan.branchId)) {
    return null;
  }

  const [branchRow, borrowerRow, collectorRow, collectionRows] = await Promise.all([
    db
      .select({
        branchName: branch.branch_name,
        branchAddress: branch.branch_address,
      })
      .from(branch)
      .where(eq(branch.branch_id, loan.branchId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
    db
      .select({
        borrowerId: borrower_info.user_id,
        firstName: borrower_info.first_name,
        middleName: borrower_info.middle_name,
        lastName: borrower_info.last_name,
        address: borrower_info.address,
        areaCode: areas.area_code,
        companyId: users.company_id,
        username: users.username,
      })
      .from(borrower_info)
      .innerJoin(users, eq(users.user_id, borrower_info.user_id))
      .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
      .where(eq(borrower_info.user_id, loan.borrowerId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
    loan.collectorId
      ? db
          .select({
            username: users.username,
            firstName: employee_info.first_name,
            middleName: employee_info.middle_name,
            lastName: employee_info.last_name,
          })
          .from(users)
          .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
          .where(eq(users.user_id, loan.collectorId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
          .catch(() => null)
      : Promise.resolve(null),
    db
      .select({
        collectionId: collections.collection_id,
        collectionCode: collections.collection_code,
        collectionDate: collections.collection_date,
        amount: collections.amount,
        note: collections.note,
        collectorId: collections.collector_id,
      })
      .from(collections)
      .where(eq(collections.loan_id, loan.loanId))
      .orderBy(asc(collections.collection_date), asc(collections.collection_id))
      .catch(() => []),
  ]);

  if (!branchRow || !borrowerRow) {
    return null;
  }

  const collectionUserRows = await loadUserDisplayRows(
    collectionRows
      .map((row) => row.collectorId)
      .filter((value): value is string => Boolean(value)),
  );
  const userDisplayMap = new Map(
    collectionUserRows.map((row) => [
      row.userId,
      buildUserDisplayName({
        firstName: row.firstName,
        middleName: row.middleName,
        lastName: row.lastName,
        username: row.username,
      }),
    ]),
  );

  const borrowerName =
    [borrowerRow.firstName, borrowerRow.middleName, borrowerRow.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    borrowerRow.username ||
    loan.borrowerId;
  const collectorName = collectorRow
    ? buildUserDisplayName({
        firstName: collectorRow.firstName,
        middleName: collectorRow.middleName,
        lastName: collectorRow.lastName,
        username: collectorRow.username,
      })
    : "Unassigned";

  const principal = toNumber(loan.principal);
  const interestRate = toNumber(loan.interest);
  const totalPayable = principal + (principal * interestRate) / 100;
  const termDays = loan.termDays ?? calculateLoanDurationDays(loan.startDate, loan.dueDate);

  let runningPaid = 0;
  const normalizedCollectionRows = collectionRows.map((row) => {
    const amount = toNumber(row.amount);
    runningPaid += amount;

    return {
      collectionId: row.collectionId,
      collectionCode: row.collectionCode,
      collectionDate: row.collectionDate,
      amount,
      note: row.note ?? "",
      collectorName:
        (row.collectorId ? userDisplayMap.get(row.collectorId) : null) ?? collectorName,
      outstandingBalance: Math.max(totalPayable - runningPaid, 0),
    };
  });

  const totalPaid = normalizedCollectionRows.reduce((sum, row) => sum + row.amount, 0);
  const outstandingBalance =
    normalizedCollectionRows.length > 0
      ? normalizedCollectionRows[normalizedCollectionRows.length - 1].outstandingBalance
      : totalPayable;
  const scheduleRows = buildLoanScheduleRows({
    startDate: loan.startDate,
    dueDate: loan.dueDate,
    totalPayable,
    estimatedDailyPayment: termDays ? totalPayable / termDays : null,
    collectionRows: normalizedCollectionRows,
  });

  return {
    loanId: loan.loanId,
    loanCode: loan.loanCode,
    branchId: loan.branchId,
    branchName: branchRow.branchName,
    branchAddress: branchRow.branchAddress,
    borrowerName,
    borrowerCompanyId: borrowerRow.companyId || borrowerRow.username || loan.borrowerId,
    borrowerAddress: borrowerRow.address || "N/A",
    areaCode: borrowerRow.areaCode || "N/A",
    collectorName,
    status: getVisibleLoanStatusFromStoredStatus(loan.status),
    startDate: loan.startDate,
    dueDate: loan.dueDate,
    termDays,
    principal,
    interestRate,
    totalPayable,
    estimatedDailyPayment: termDays ? totalPayable / termDays : null,
    totalPaid,
    outstandingBalance,
    completionDate:
      normalizedCollectionRows[normalizedCollectionRows.length - 1]?.collectionDate ?? loan.dueDate,
    scheduleRows,
    collectionRows: normalizedCollectionRows,
  };
}

async function loadCollectionDocumentSource(
  access: ReportsReadyAccessState,
  collectionId: number,
) {
  const collectionRow = await db
    .select({
      collectionId: collections.collection_id,
      collectionCode: collections.collection_code,
      collectionDate: collections.collection_date,
      amount: collections.amount,
      note: collections.note,
      collectorId: collections.collector_id,
      encodedBy: collections.encoded_by,
      loanId: loan_records.loan_id,
      loanCode: loan_records.loan_code,
      branchId: loan_records.branch_id,
      borrowerId: loan_records.borrower_id,
      principal: loan_records.principal,
      interest: loan_records.interest,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(eq(collections.collection_id, collectionId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  if (!collectionRow) {
    return null;
  }

  if (!access.canAccessOperationalDocuments || !access.allowedBranchIds.includes(collectionRow.branchId)) {
    return null;
  }

  const [branchRow, borrowerRow, userRows] = await Promise.all([
    db
      .select({
        branchName: branch.branch_name,
        branchAddress: branch.branch_address,
      })
      .from(branch)
      .where(eq(branch.branch_id, collectionRow.branchId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
    db
      .select({
        firstName: borrower_info.first_name,
        middleName: borrower_info.middle_name,
        lastName: borrower_info.last_name,
        companyId: users.company_id,
        username: users.username,
      })
      .from(borrower_info)
      .innerJoin(users, eq(users.user_id, borrower_info.user_id))
      .where(eq(borrower_info.user_id, collectionRow.borrowerId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
    loadUserDisplayRows(
      [collectionRow.collectorId, collectionRow.encodedBy].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ]);

  if (!branchRow || !borrowerRow) {
    return null;
  }

  const userDisplayMap = new Map(
    userRows.map((row) => [
      row.userId,
      buildUserDisplayName({
        firstName: row.firstName,
        middleName: row.middleName,
        lastName: row.lastName,
        username: row.username,
      }),
    ]),
  );

  const loanCollections = await db
    .select({
      collectionId: collections.collection_id,
      collectionDate: collections.collection_date,
      amount: collections.amount,
    })
    .from(collections)
    .where(eq(collections.loan_id, collectionRow.loanId))
    .orderBy(asc(collections.collection_date), asc(collections.collection_id))
    .catch(() => []);

  const totalPayable =
    toNumber(collectionRow.principal) +
    (toNumber(collectionRow.principal) * toNumber(collectionRow.interest)) / 100;
  let runningPaid = 0;
  let remainingBalanceAfterPayment = totalPayable;

  for (const row of loanCollections) {
    runningPaid += toNumber(row.amount);
    if (row.collectionId === collectionRow.collectionId) {
      remainingBalanceAfterPayment = Math.max(totalPayable - runningPaid, 0);
      break;
    }
  }

  return {
    collectionId: collectionRow.collectionId,
    collectionCode: collectionRow.collectionCode,
    collectionDate: collectionRow.collectionDate,
    amount: toNumber(collectionRow.amount),
    note: collectionRow.note ?? null,
    loanId: collectionRow.loanId,
    loanCode: collectionRow.loanCode,
    branchId: collectionRow.branchId,
    branchName: branchRow.branchName,
    borrowerName:
      [borrowerRow.firstName, borrowerRow.middleName, borrowerRow.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      borrowerRow.username ||
      collectionRow.borrowerId,
    borrowerCompanyId:
      borrowerRow.companyId || borrowerRow.username || collectionRow.borrowerId,
    collectorName:
      (collectionRow.collectorId
        ? userDisplayMap.get(collectionRow.collectorId)
        : null) ?? "Unassigned",
    encodedByName:
      userDisplayMap.get(collectionRow.encodedBy) ?? collectionRow.encodedBy,
    branchAddress: branchRow.branchAddress,
    remainingBalanceAfterPayment,
  };
}

export async function generateOperationalDocument(
  access: ReportsReadyAccessState,
  input: GenerateOperationalDocumentInput,
) {
  if (!access.canAccessOperationalDocuments) {
    return {
      ok: false as const,
      message: "Operational document generation is not available for your current role.",
    };
  }

  const template = getOperationalDocumentTemplateDefinition(input.templateKey);
  if (!template) {
    return {
      ok: false as const,
      message: "Select a valid document template.",
    };
  }

  if (!template.implemented) {
    return {
      ok: false as const,
      message: "This document template is planned but not implemented yet.",
    };
  }

  if (!template.allowedRoles.includes(access.roleName)) {
    return {
      ok: false as const,
      message: "This document template is not available for your current role.",
    };
  }

  let title: string;
  let branchScope: number[];
  let filters: Record<string, number>;
  let sourceEntityType: "loan" | "collection";
  let sourceEntityId: number;
  let snapshot: unknown;

  if (template.sourceEntityType === "loan") {
    const loanSource = await loadLoanDocumentSource(access, input.sourceEntityId);
    if (!loanSource) {
      return {
        ok: false as const,
        message: "You are not allowed to generate this loan document.",
      };
    }

    branchScope = [loanSource.branchId];
    filters = { loanId: loanSource.loanId };
    sourceEntityType = "loan";
    sourceEntityId = loanSource.loanId;

    if (template.key === "borrower_loan_schedule") {
      title = `Borrower Loan Schedule - ${loanSource.loanCode}`;
      snapshot = buildBorrowerLoanScheduleSnapshot({
        title,
        generatedLabel: `Loan schedule snapshot for ${loanSource.loanCode}`,
        scopeLabel: loanSource.branchName,
        borrowerName: loanSource.borrowerName,
        borrowerCompanyId: loanSource.borrowerCompanyId,
        borrowerAddress: loanSource.borrowerAddress,
        branchName: loanSource.branchName,
        branchAddress: loanSource.branchAddress,
        areaCode: loanSource.areaCode,
        collectorName: loanSource.collectorName,
        loanCode: loanSource.loanCode,
        startDate: loanSource.startDate,
        dueDate: loanSource.dueDate,
        termDays: loanSource.termDays,
        status: loanSource.status,
        principal: loanSource.principal,
        interestRate: loanSource.interestRate,
        totalPayable: loanSource.totalPayable,
        estimatedDailyPayment: loanSource.estimatedDailyPayment,
        totalPaid: loanSource.totalPaid,
        outstandingBalance: loanSource.outstandingBalance,
        scheduleRows: loanSource.scheduleRows,
      });
    } else {
      if (!isLoanReceiptSummaryEligible(loanSource.status, loanSource.outstandingBalance)) {
        return {
          ok: false as const,
          message:
            "Loan receipt summaries are only available for loans that are completed or archived with zero remaining balance.",
        };
      }

      title = `Loan Receipt Summary - ${loanSource.loanCode}`;
      snapshot = buildLoanReceiptSummarySnapshot({
        title,
        generatedLabel: `Loan payment snapshot for ${loanSource.loanCode}`,
        scopeLabel: loanSource.branchName,
        loanCode: loanSource.loanCode,
        borrowerName: loanSource.borrowerName,
        borrowerCompanyId: loanSource.borrowerCompanyId,
        branchName: loanSource.branchName,
        areaCode: loanSource.areaCode,
        collectorName: loanSource.collectorName,
        status: loanSource.status,
        startDate: loanSource.startDate,
        completionDate: loanSource.completionDate,
        principal: loanSource.principal,
        interestRate: loanSource.interestRate,
        totalPayable: loanSource.totalPayable,
        totalPaid: loanSource.totalPaid,
        outstandingBalance: loanSource.outstandingBalance,
        collectionRows: loanSource.collectionRows.map((row) => ({
          collectionCode: row.collectionCode,
          collectionDate: row.collectionDate,
          amount: row.amount,
          collectorName: row.collectorName,
          note: row.note || "-",
          outstandingBalance: row.outstandingBalance,
        })),
      });
    }
  } else {
    const collectionSource = await loadCollectionDocumentSource(access, input.sourceEntityId);
    if (!collectionSource) {
      return {
        ok: false as const,
        message: "You are not allowed to generate this collection receipt.",
      };
    }

    title = `Collection Receipt - ${collectionSource.collectionCode}`;
    branchScope = [collectionSource.branchId];
    filters = {
      collectionId: collectionSource.collectionId,
      loanId: collectionSource.loanId,
    };
    sourceEntityType = "collection";
    sourceEntityId = collectionSource.collectionId;
    snapshot = buildCollectionReceiptSnapshot({
      title,
      generatedLabel: `Collection receipt for ${collectionSource.collectionCode}`,
      scopeLabel: collectionSource.branchName,
      collectionCode: collectionSource.collectionCode,
      collectionDate: collectionSource.collectionDate,
      amount: collectionSource.amount,
      note: collectionSource.note,
      loanCode: collectionSource.loanCode,
      borrowerName: collectionSource.borrowerName,
      borrowerCompanyId: collectionSource.borrowerCompanyId,
      branchName: collectionSource.branchName,
      collectorName: collectionSource.collectorName,
      encodedByName: collectionSource.encodedByName,
      branchAddress: collectionSource.branchAddress,
      remainingBalanceAfterPayment: collectionSource.remainingBalanceAfterPayment,
    });
  }

  const insertedReport = await db
    .insert(reports)
    .values({
      title,
      report_category: "document",
      template_key: template.key,
      generated_type: "user",
      generated_by: access.userId,
      filters,
      branch_scope: branchScope,
      source_entity_type: sourceEntityType,
      source_entity_id: sourceEntityId,
      snapshot,
      status: "active",
    })
    .returning({
      reportId: reports.report_id,
      title: reports.title,
      generatedAt: reports.generated_at,
    })
    .catch(() => []);

  const reportRow = insertedReport[0];
  if (!reportRow) {
    return {
      ok: false as const,
      message: "Unable to save the generated document right now.",
    };
  }

  return {
    ok: true as const,
    reportId: reportRow.reportId,
    title: reportRow.title,
    generatedAt: reportRow.generatedAt,
    templateLabel: template.label,
    templateKey: template.key,
    sourceEntityType,
    sourceEntityId,
  };
}
