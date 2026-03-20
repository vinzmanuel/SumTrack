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
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { ACTIVE_LOAN_STATUSES } from "@/app/dashboard/loans/active-statuses";
import {
  buildActiveLoansSummarySnapshot,
  buildBranchPerformanceComparisonSnapshot,
  buildBorrowerLoanScheduleSnapshot,
  buildCollectionReceiptSnapshot,
  buildFinancialOverviewSnapshot,
  buildLoanReceiptSummarySnapshot,
  buildMonthlyCollectionsSummarySnapshot,
} from "@/app/dashboard/reports/snapshot-builders";
import {
  buildAnalyticsTemplateOptions,
  getAnalyticsTemplateDefinition,
  getOperationalDocumentTemplateDefinition,
  resolveReportTemplateLabel,
} from "@/app/dashboard/reports/templates";
import type {
  AnalyticsReportTemplateKey,
  OperationalDocumentTemplateKey,
  ReportsBranchOption,
  ReportsLibraryFilterState,
  ReportsLibraryPageData,
  ReportsLibraryRow,
  ReportsPageData,
  ReportsReadyAccessState,
} from "@/app/dashboard/reports/types";
import { db } from "@/db";
import {
  areas,
  borrower_info,
  branch,
  collections,
  employee_area_assignment,
  employee_info,
  expenses,
  loan_records,
  reports,
  roles,
  users,
} from "@/db/schema";

type GenerateAnalyticsReportInput = {
  title: string;
  templateKey: AnalyticsReportTemplateKey;
  branchIds: number[];
  dateFrom: string | null;
  dateTo: string | null;
  month: string | null;
};

type GenerateOperationalDocumentInput = {
  templateKey: OperationalDocumentTemplateKey;
  sourceEntityId: number;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
    conditions.push(sql`array_position(${reports.branch_scope}, ${access.fixedBranchId}) is not null`);
  } else if (access.allowedBranchIds.length > 0) {
    const branchScopeConditions = access.allowedBranchIds.map((branchId) =>
      sql`array_position(${reports.branch_scope}, ${branchId}) is not null`,
    );
    const branchScopeWhere =
      branchScopeConditions.length === 1
        ? branchScopeConditions[0]
        : or(...branchScopeConditions);

    if (branchScopeWhere) {
      conditions.push(branchScopeWhere);
    }
  } else {
    conditions.push(eq(reports.report_id, -1));
  }

  if (conditions.length === 0) {
    return undefined;
  }

  return conditions.length === 1 ? conditions[0] : and(...conditions);
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
  generatedByRoleName: string | null;
  branchScope: number[];
  dateFrom: string | null;
  dateTo: string | null;
  sourceEntityType: "loan" | "collection" | null;
  sourceEntityId: number | null;
}): ReportsLibraryRow {
  return {
    reportId: row.reportId,
    title: row.title,
    reportCategory: row.reportCategory,
    templateKey: row.templateKey,
    templateLabel: resolveReportTemplateLabel(row.templateKey),
    generatedType: row.generatedType,
    generatedAt: row.generatedAt,
    status: row.status,
    generatedByUserId: row.generatedByUserId,
    generatedByName: row.generatedByName,
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

  const [loanRows, paymentRows] = await Promise.all([
    db
      .select({
        branchId: loan_records.branch_id,
        activeLoans: sql<number>`sum(case when ${loan_records.status} = 'Active' then 1 else 0 end)`,
        overdueLoans: sql<number>`sum(case when ${loan_records.status} = 'Overdue' then 1 else 0 end)`,
        principalExposure: sql<number>`coalesce(sum(case when ${loan_records.status} in ('Active', 'Overdue') then ${loan_records.principal} else 0 end), 0)`,
        totalPayableActive: sql<number>`coalesce(sum(case when ${loan_records.status} in ('Active', 'Overdue') then ${loan_records.principal} + (${loan_records.principal} * ${loan_records.interest} / 100) else 0 end), 0)`,
      })
      .from(loan_records)
      .where(inArray(loan_records.branch_id, safeBranchIds))
      .groupBy(loan_records.branch_id)
      .catch(() => []),
    db
      .select({
        branchId: loan_records.branch_id,
        paidAgainstActive: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        and(
          inArray(loan_records.branch_id, safeBranchIds),
          inArray(loan_records.status, [...ACTIVE_LOAN_STATUSES]),
        ),
      )
      .groupBy(loan_records.branch_id)
      .catch(() => []),
  ]);

  const paidMap = new Map(paymentRows.map((row) => [row.branchId, toNumber(row.paidAgainstActive)]));

  return new Map(
    loanRows.map((row) => {
      const totalPayableActive = toNumber(row.totalPayableActive);
      const paidAgainstActive = paidMap.get(row.branchId) ?? 0;

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

async function loadFinancialOverviewData(branchRows: Array<{ branchId: number; branchName: string }>, dateFrom: string, dateTo: string) {
  const branchIds = branchRows.map((row) => row.branchId);
  const liveLoanMetrics = await loadLiveLoanBranchMetrics(branchIds);

  const [collectionRows, expenseRows] = await Promise.all([
    db
      .select({
        branchId: loan_records.branch_id,
        totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        and(
          inArray(loan_records.branch_id, branchIds),
          gte(collections.collection_date, dateFrom),
          lte(collections.collection_date, dateTo),
        ),
      )
      .groupBy(loan_records.branch_id)
      .catch(() => []),
    db
      .select({
        branchId: expenses.branch_id,
        totalAmount: sql<number>`coalesce(sum(${expenses.amount}), 0)`,
      })
      .from(expenses)
      .where(
        and(
          inArray(expenses.branch_id, branchIds),
          gte(expenses.expense_date, dateFrom),
          lte(expenses.expense_date, dateTo),
        ),
      )
      .groupBy(expenses.branch_id)
      .catch(() => []),
  ]);

  const collectionMap = new Map(collectionRows.map((row) => [row.branchId, toNumber(row.totalAmount)]));
  const expenseMap = new Map(expenseRows.map((row) => [row.branchId, toNumber(row.totalAmount)]));

  const branchSummaryRows = branchRows.map((row) => {
    const collectionsAmount = collectionMap.get(row.branchId) ?? 0;
    const expensesAmount = expenseMap.get(row.branchId) ?? 0;
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

  const summary = branchSummaryRows.reduce(
    (totals, row) => ({
      collectionsTotal: totals.collectionsTotal + row.collectionsAmount,
      expensesTotal: totals.expensesTotal + row.expensesAmount,
      netTotal: totals.netTotal + row.netAmount,
      activeLoans: totals.activeLoans + row.activeLoans,
      overdueLoans: totals.overdueLoans + row.overdueLoans,
      outstandingBalance: totals.outstandingBalance + row.outstandingBalance,
    }),
    {
      collectionsTotal: 0,
      expensesTotal: 0,
      netTotal: 0,
      activeLoans: 0,
      overdueLoans: 0,
      outstandingBalance: 0,
    },
  );

  return {
    summary,
    branchRows: branchSummaryRows,
  };
}

async function loadMonthlyCollectionsSummaryData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string,
  dateTo: string,
) {
  const branchIds = branchRows.map((row) => row.branchId);
  const [summaryRows, trendRows, branchBreakdownRows, bucketRows] = await Promise.all([
    db
      .select({
        totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
        totalEntries: sql<number>`count(*)`,
        averageAmount: sql<number>`coalesce(avg(${collections.amount}), 0)`,
        missedPayments: sql<number>`sum(case when ${collections.amount} = 0 then 1 else 0 end)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        and(
          inArray(loan_records.branch_id, branchIds),
          gte(collections.collection_date, dateFrom),
          lte(collections.collection_date, dateTo),
        ),
      )
      .limit(1)
      .catch(() => []),
    db
      .select({
        bucket: collections.collection_date,
        totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        and(
          inArray(loan_records.branch_id, branchIds),
          gte(collections.collection_date, dateFrom),
          lte(collections.collection_date, dateTo),
        ),
      )
      .groupBy(collections.collection_date)
      .orderBy(collections.collection_date)
      .catch(() => []),
    db
      .select({
        branchId: loan_records.branch_id,
        totalAmount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
        totalEntries: sql<number>`count(*)`,
        missedPayments: sql<number>`sum(case when ${collections.amount} = 0 then 1 else 0 end)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        and(
          inArray(loan_records.branch_id, branchIds),
          gte(collections.collection_date, dateFrom),
          lte(collections.collection_date, dateTo),
        ),
      )
      .groupBy(loan_records.branch_id)
      .catch(() => []),
    db
      .select({
        label: sql<string>`case
          when ${collections.amount} = 0 then 'Missed / Zero'
          when ${collections.amount} <= 500 then 'Up to PHP 500'
          when ${collections.amount} <= 1500 then 'PHP 501 to PHP 1,500'
          when ${collections.amount} <= 5000 then 'PHP 1,501 to PHP 5,000'
          else 'Above PHP 5,000'
        end`,
        bucketOrder: sql<number>`case
          when ${collections.amount} = 0 then 0
          when ${collections.amount} <= 500 then 1
          when ${collections.amount} <= 1500 then 2
          when ${collections.amount} <= 5000 then 3
          else 4
        end`,
        entries: sql<number>`count(*)`,
        amount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        and(
          inArray(loan_records.branch_id, branchIds),
          gte(collections.collection_date, dateFrom),
          lte(collections.collection_date, dateTo),
        ),
      )
      .groupBy(
        sql`case
          when ${collections.amount} = 0 then 'Missed / Zero'
          when ${collections.amount} <= 500 then 'Up to PHP 500'
          when ${collections.amount} <= 1500 then 'PHP 501 to PHP 1,500'
          when ${collections.amount} <= 5000 then 'PHP 1,501 to PHP 5,000'
          else 'Above PHP 5,000'
        end`,
        sql`case
          when ${collections.amount} = 0 then 0
          when ${collections.amount} <= 500 then 1
          when ${collections.amount} <= 1500 then 2
          when ${collections.amount} <= 5000 then 3
          else 4
        end`,
      )
      .orderBy(sql`case
        when ${collections.amount} = 0 then 0
        when ${collections.amount} <= 500 then 1
        when ${collections.amount} <= 1500 then 2
        when ${collections.amount} <= 5000 then 3
        else 4
      end`)
      .catch(() => []),
  ]);

  const summaryRow = summaryRows[0];
  const branchNameMap = new Map(branchRows.map((row) => [row.branchId, row.branchName]));

  return {
    summary: {
      totalAmount: toNumber(summaryRow?.totalAmount),
      totalEntries: toNumber(summaryRow?.totalEntries),
      averageAmount: toNumber(summaryRow?.averageAmount),
      missedPayments: toNumber(summaryRow?.missedPayments),
    },
    trendRows: trendRows.map((row) => ({
      bucket: row.bucket,
      values: {
        collections: toNumber(row.totalAmount),
      },
    })),
    branchRows: branchBreakdownRows
      .map((row) => ({
        branchName: branchNameMap.get(row.branchId) ?? `Branch ${row.branchId}`,
        totalAmount: toNumber(row.totalAmount),
        totalEntries: toNumber(row.totalEntries),
        missedPayments: toNumber(row.missedPayments),
      }))
      .sort((left, right) => left.branchName.localeCompare(right.branchName)),
    bucketRows: bucketRows.map((row) => ({
      label: row.label,
      entries: toNumber(row.entries),
      amount: toNumber(row.amount),
    })),
  };
}

async function loadActiveLoansSummaryData(branchRows: Array<{ branchId: number; branchName: string }>) {
  const branchIds = branchRows.map((row) => row.branchId);
  const liveLoanMetrics = await loadLiveLoanBranchMetrics(branchIds);

  const collectorRows = await db
    .select({
      userId: users.user_id,
      username: users.username,
      firstName: employee_info.first_name,
      middleName: employee_info.middle_name,
      lastName: employee_info.last_name,
      liveLoanCount: sql<number>`count(*)`,
      overdueLoanCount: sql<number>`sum(case when ${loan_records.status} = 'Overdue' then 1 else 0 end)`,
      principalExposure: sql<number>`coalesce(sum(${loan_records.principal}), 0)`,
      totalPayableActive: sql<number>`coalesce(sum(${loan_records.principal} + (${loan_records.principal} * ${loan_records.interest} / 100)), 0)`,
      paidAgainstActive: sql<number>`coalesce(sum((
        select coalesce(sum(c.amount), 0)
        from collections c
        where c.loan_id = ${loan_records.loan_id}
      )), 0)`,
    })
    .from(loan_records)
    .leftJoin(users, eq(users.user_id, loan_records.collector_id))
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .where(
      and(
        inArray(loan_records.branch_id, branchIds),
        inArray(loan_records.status, [...ACTIVE_LOAN_STATUSES]),
      ),
    )
    .groupBy(
      users.user_id,
      users.username,
      employee_info.first_name,
      employee_info.middle_name,
      employee_info.last_name,
    )
    .orderBy(desc(sql<number>`count(*)`), asc(users.username))
    .catch(() => []);

  const branchSummaryRows = branchRows.map((row) => {
    const loanMetrics = liveLoanMetrics.get(row.branchId) ?? {
      activeLoans: 0,
      overdueLoans: 0,
      principalExposure: 0,
      totalPayableActive: 0,
      outstandingBalance: 0,
    };

    return {
      branchName: row.branchName,
      activeLoans: loanMetrics.activeLoans,
      overdueLoans: loanMetrics.overdueLoans,
      principalExposure: loanMetrics.principalExposure,
      outstandingBalance: loanMetrics.outstandingBalance,
    };
  });

  const summary = branchSummaryRows.reduce(
    (totals, row) => ({
      activeLoans: totals.activeLoans + row.activeLoans,
      overdueLoans: totals.overdueLoans + row.overdueLoans,
      principalExposure: totals.principalExposure + row.principalExposure,
      outstandingBalance: totals.outstandingBalance + row.outstandingBalance,
    }),
    {
      activeLoans: 0,
      overdueLoans: 0,
      principalExposure: 0,
      outstandingBalance: 0,
    },
  );

  return {
    summary,
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

async function loadBranchPerformanceComparisonData(
  branchRows: Array<{ branchId: number; branchName: string }>,
  dateFrom: string,
  dateTo: string,
) {
  const branchIds = branchRows.map((row) => row.branchId);

  const [
    collectorCountRows,
    borrowerCountRows,
    loanCountRows,
    collectionRows,
  ] = await Promise.all([
    db
      .select({
        branchId: areas.branch_id,
        collectorCount: sql<number>`count(distinct ${employee_area_assignment.employee_user_id})`,
      })
      .from(employee_area_assignment)
      .innerJoin(areas, eq(areas.area_id, employee_area_assignment.area_id))
      .innerJoin(users, eq(users.user_id, employee_area_assignment.employee_user_id))
      .innerJoin(roles, eq(roles.role_id, users.role_id))
      .where(
        and(
          inArray(areas.branch_id, branchIds),
          isNull(employee_area_assignment.end_date),
          eq(roles.role_name, "Collector"),
          eq(users.status, "active"),
        ),
      )
      .groupBy(areas.branch_id)
      .catch(() => []),
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
        branchId: loan_records.branch_id,
        activeLoanCount: sql<number>`sum(case when ${loan_records.status} = 'Active' then 1 else 0 end)`,
        overdueLoanCount: sql<number>`sum(case when ${loan_records.status} = 'Overdue' then 1 else 0 end)`,
      })
      .from(loan_records)
      .where(inArray(loan_records.branch_id, branchIds))
      .groupBy(loan_records.branch_id)
      .catch(() => []),
    db
      .select({
        branchId: loan_records.branch_id,
        collectionsThisMonth: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        and(
          inArray(loan_records.branch_id, branchIds),
          gte(collections.collection_date, dateFrom),
          lte(collections.collection_date, dateTo),
        ),
      )
      .groupBy(loan_records.branch_id)
      .catch(() => []),
  ]);

  const collectorMap = new Map(collectorCountRows.map((row) => [row.branchId, toNumber(row.collectorCount)]));
  const borrowerMap = new Map(borrowerCountRows.map((row) => [row.branchId, toNumber(row.borrowerCount)]));
  const loanMap = new Map(
    loanCountRows.map((row) => [
      row.branchId,
      {
        activeLoanCount: toNumber(row.activeLoanCount),
        overdueLoanCount: toNumber(row.overdueLoanCount),
      },
    ]),
  );
  const collectionMap = new Map(collectionRows.map((row) => [row.branchId, toNumber(row.collectionsThisMonth)]));

  const comparisonRows = branchRows.map((row) => ({
    branchName: row.branchName,
    borrowerCount: borrowerMap.get(row.branchId) ?? 0,
    collectorCount: collectorMap.get(row.branchId) ?? 0,
    activeLoanCount: loanMap.get(row.branchId)?.activeLoanCount ?? 0,
    overdueLoanCount: loanMap.get(row.branchId)?.overdueLoanCount ?? 0,
    collectionsThisMonth: collectionMap.get(row.branchId) ?? 0,
  }));

  return {
    summary: {
      branchesCompared: comparisonRows.length,
      totalBorrowers: comparisonRows.reduce((sum, row) => sum + row.borrowerCount, 0),
      totalCollectors: comparisonRows.reduce((sum, row) => sum + row.collectorCount, 0),
      totalActiveLoans: comparisonRows.reduce((sum, row) => sum + row.activeLoanCount, 0),
      totalOverdueLoans: comparisonRows.reduce((sum, row) => sum + row.overdueLoanCount, 0),
      totalCollections: comparisonRows.reduce((sum, row) => sum + row.collectionsThisMonth, 0),
    },
    branchRows: comparisonRows,
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

export async function loadReportsPageData(access: ReportsReadyAccessState): Promise<ReportsPageData> {
  const branchOptions = await loadVisibleBranchOptions(access);

  return {
    branchOptions,
    analyticsTemplates: buildAnalyticsTemplateOptions(branchOptions.length, access.canAccessAnalytics),
  };
}

export async function loadReportsLibraryPageData(
  access: ReportsReadyAccessState,
  filters: ReportsLibraryFilterState,
): Promise<ReportsLibraryPageData> {
  const [rows, visibleBranchOptions] = await Promise.all([
      db
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
          generatedByFirstName: employee_info.first_name,
          generatedByMiddleName: employee_info.middle_name,
          generatedByLastName: employee_info.last_name,
          generatedByUsername: users.username,
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
        .where(buildReportsLibraryScopeWhere(access))
        .orderBy(desc(reports.generated_at), desc(reports.report_id))
        .catch(() => []),
      loadVisibleLibraryBranchOptions(access),
    ]);

  const visibleRows = rows.map((row) =>
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
      generatedByRoleName: row.generatedByRoleName,
      branchScope: row.branchScope,
      dateFrom: row.dateFrom,
      dateTo: row.dateTo,
      sourceEntityType: row.sourceEntityType,
      sourceEntityId: row.sourceEntityId,
    }),
  );
  const generatedByRoles = Array.from(
    new Map(
      rows
        .filter((row) => Boolean(row.generatedByRoleName))
        .map((row) => [
          row.generatedByRoleName as string,
          {
            roleName: row.generatedByRoleName as string,
          },
        ] as const)
        .sort((left, right) => left[1].roleName.localeCompare(right[1].roleName)),
    ).values(),
  );
  const generatedByUsers = Array.from(
    new Map(
      rows
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
  const templates = Array.from(
    new Map(
      visibleRows
        .map((row) => [
          row.templateKey,
          {
            templateKey: row.templateKey,
            label: row.templateLabel,
          },
        ] as const)
        .sort((left, right) => left[1].label.localeCompare(right[1].label)),
    ).values(),
  );

  const advancedFilteredRows = visibleRows.filter((row) => {
    if (filters.templateKey && row.templateKey !== filters.templateKey) {
      return false;
    }

      if (filters.generatedType !== "all" && row.generatedType !== filters.generatedType) {
        return false;
      }

      if (filters.generatedByRoleName && row.generatedByRoleName !== filters.generatedByRoleName) {
        return false;
      }

      if (filters.generatedByUserId && row.generatedByUserId !== filters.generatedByUserId) {
        return false;
      }

    if (
      filters.branchIds.length > 0 &&
      !filters.branchIds.some((branchId) => row.branchScope.includes(branchId))
    ) {
      return false;
    }

    if (filters.generatedDateFrom && row.generatedAt.slice(0, 10) < filters.generatedDateFrom) {
      return false;
    }

    if (filters.generatedDateTo && row.generatedAt.slice(0, 10) > filters.generatedDateTo) {
      return false;
    }

    if (filters.coverageDateFrom && (!row.dateTo || row.dateTo < filters.coverageDateFrom)) {
      return false;
    }

    if (filters.coverageDateTo && (!row.dateFrom || row.dateFrom > filters.coverageDateTo)) {
      return false;
    }

    return true;
  });

  const categoryScopedRows = advancedFilteredRows.filter((row) =>
    filters.category === "all"
      ? true
      : filters.category === "documents"
        ? row.reportCategory === "document"
        : row.reportCategory === "analytics",
  );

  const filteredRows = categoryScopedRows.filter((row) => row.status === filters.status);

  return {
    filters,
    rows: filteredRows,
    counts: {
      all: advancedFilteredRows.length,
      analytics: advancedFilteredRows.filter((row) => row.reportCategory === "analytics").length,
      documents: advancedFilteredRows.filter((row) => row.reportCategory === "document").length,
      active: categoryScopedRows.filter((row) => row.status === "active").length,
      archived: categoryScopedRows.filter((row) => row.status === "archived").length,
    },
    filterOptions: {
      templates,
      generatedByRoles,
      generatedByUsers,
      branches: visibleBranchOptions,
    },
  };
}

export async function generateAnalyticsReport(
  access: ReportsReadyAccessState,
  input: GenerateAnalyticsReportInput,
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
          ? "Branch Performance Comparison requires at least two selected branches."
          : "Select a valid branch scope for this report.",
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
    if (!input.dateFrom || !input.dateTo) {
      return {
        ok: false as const,
        message: "Select a valid date range for this report.",
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

  if (template.key === "financial_overview") {
    const reportData = await loadFinancialOverviewData(selectedBranchRows, dateFrom!, dateTo!);
    snapshot = buildFinancialOverviewSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      branchRows: reportData.branchRows,
    });
  } else if (template.key === "monthly_collections_summary") {
    const reportData = await loadMonthlyCollectionsSummaryData(selectedBranchRows, dateFrom!, dateTo!);
    snapshot = buildMonthlyCollectionsSummarySnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      trendRows: reportData.trendRows,
      branchRows: reportData.branchRows,
      bucketRows: reportData.bucketRows,
    });
  } else if (template.key === "active_loans_summary") {
    const reportData = await loadActiveLoansSummaryData(selectedBranchRows);
    snapshot = buildActiveLoansSummarySnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      branchRows: reportData.branchRows,
      collectorRows: reportData.collectorRows,
    });
  } else {
    const reportData = await loadBranchPerformanceComparisonData(selectedBranchRows, dateFrom!, dateTo!);
    snapshot = buildBranchPerformanceComparisonSnapshot({
      title: resolvedTitle,
      generatedLabel,
      scopeLabel,
      summary: reportData.summary,
      branchRows: reportData.branchRows,
    });
  }

  const insertedReport = await db
    .insert(reports)
    .values({
      title: resolvedTitle,
      report_category: "analytics",
      template_key: template.key,
      generated_type: "user",
      generated_by: access.userId,
      filters: {
        branchIds: normalizedBranchIds,
        month: input.month,
        dateFrom,
        dateTo,
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
    status: loan.status,
    startDate: loan.startDate,
    dueDate: loan.dueDate,
    termDays,
    principal,
    interestRate,
    totalPayable,
    estimatedDailyPayment: termDays ? totalPayable / termDays : null,
    totalPaid: normalizedCollectionRows.reduce((sum, row) => sum + row.amount, 0),
    outstandingBalance:
      normalizedCollectionRows.length > 0
        ? normalizedCollectionRows[normalizedCollectionRows.length - 1].outstandingBalance
        : totalPayable,
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
      });
    } else {
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
