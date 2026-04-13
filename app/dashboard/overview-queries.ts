import "server-only";

import { and, asc, desc, eq, gte, inArray, isNull, lte, sql, type SQL } from "drizzle-orm";
import {
  buildLoanDerivedMetricsSubquery,
  LIVE_STORED_LOAN_STATUSES,
  buildStoredLoanStatusEqualsSql,
  buildStoredLoanStatusInSql,
} from "@/app/dashboard/loans/loan-derived-status-sql";
import { formatDateShort, formatMoney, toNumber, todayInManila } from "@/app/dashboard/overview-format";
import { getVisibleLoanStatusFromStoredStatus } from "@/app/dashboard/loans/loan-state";
import type {
  BorrowerOverview,
  BorrowerCollectorContact,
  CollectorMetrics,
  DashboardMiniListWidget,
  DashboardOverviewData,
  DashboardSecondaryChartWidget,
  DashboardOverviewState,
  DashboardScope,
  OverviewMetrics,
  SecretaryMetrics,
} from "@/app/dashboard/overview-types";
import type { AnalyticsChartModel } from "@/components/analytics/types";
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
  roles,
  users,
} from "@/db/schema";

function loanScopeConditions(scope: DashboardScope): SQL[] {
  if (scope.kind === "all_branches") {
    return [];
  }

  if (scope.kind === "branches") {
    if (scope.branchIds.length === 0) {
      return [eq(loan_records.loan_id, -1)];
    }

    return [inArray(loan_records.branch_id, scope.branchIds)];
  }

  if (scope.kind === "collector") {
    return [eq(loan_records.collector_id, scope.collectorId)];
  }

  return [eq(loan_records.borrower_id, scope.borrowerId)];
}

function expenseScopeConditions(scope: DashboardScope): SQL[] {
  if (scope.kind === "all_branches") {
    return [];
  }

  if (scope.kind === "branches") {
    if (scope.branchIds.length === 0) {
      return [eq(expenses.expense_id, -1)];
    }

    return [inArray(expenses.branch_id, scope.branchIds)];
  }

  return [eq(expenses.expense_id, -1)];
}

function whereFrom(conditions: SQL[]) {
  if (conditions.length === 0) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return and(...conditions);
}

type OverviewPeriod = {
  start: string;
  end: string;
};

async function getOverviewMetrics(scope: DashboardScope, period: OverviewPeriod): Promise<OverviewMetrics> {
  const loanScope = loanScopeConditions(scope);
  const expenseScope = expenseScopeConditions(scope);
  const loanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "overview_loan_metrics",
    currentDate: period.end,
    where: whereFrom(loanScope),
  });

  const borrowerCountPromise =
    scope.kind === "all_branches" || scope.kind === "branches"
      ? db
          .select({ value: sql<number>`count(distinct ${borrower_info.user_id})` })
          .from(borrower_info)
          .innerJoin(loan_records, eq(loan_records.borrower_id, borrower_info.user_id))
          .where(
            scope.kind === "branches" ? whereFrom([inArray(loan_records.branch_id, scope.branchIds)]) : undefined,
          )
          .then((rows) => toNumber(rows[0]?.value))
          .catch(() => 0)
      : Promise.resolve(0);

  const [
    collectionsThisMonth,
    expensesThisMonth,
    loanSummaryRow,
    borrowerCount,
  ] = await Promise.all([
    db
      .select({ value: sql<number>`coalesce(sum(${collections.amount}), 0)` })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        whereFrom([
          ...loanScope,
          gte(collections.collection_date, period.start),
          lte(collections.collection_date, period.end),
        ]),
      )
      .then((rows) => toNumber(rows[0]?.value))
      .catch(() => 0),
    db
      .select({ value: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(
        whereFrom([
          ...expenseScope,
          gte(expenses.expense_date, period.start),
          lte(expenses.expense_date, period.end),
        ]),
      )
      .then((rows) => toNumber(rows[0]?.value))
      .catch(() => 0),
    db
      .select({
        activeLoans: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusEqualsSql(loanMetrics.storedStatus, "active")} then 1 else 0 end), 0)`,
        overdueLoans: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusEqualsSql(loanMetrics.storedStatus, "overdue")} then 1 else 0 end), 0)`,
        totalPayableActive: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusInSql(loanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)} then ${loanMetrics.totalPayable} else 0 end), 0)`,
        paidAgainstActive: sql<number>`coalesce(sum(case when ${buildStoredLoanStatusInSql(loanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES)} then ${loanMetrics.totalCollected} else 0 end), 0)`,
      })
      .from(loanMetrics)
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
    borrowerCountPromise,
  ]);

  const activeLoans = toNumber(loanSummaryRow?.activeLoans);
  const overdueLoans = toNumber(loanSummaryRow?.overdueLoans);
  const totalPayableActive = toNumber(loanSummaryRow?.totalPayableActive);
  const paidAgainstActive = toNumber(loanSummaryRow?.paidAgainstActive);

  return {
    collectionsThisMonth,
    expensesThisMonth,
    activeLoans,
    overdueLoans,
    outstandingBalance: Math.max(totalPayableActive - paidAgainstActive, 0),
    borrowerCount,
  };
}

async function getSecretaryMetrics(scope: DashboardScope, period: OverviewPeriod): Promise<SecretaryMetrics> {
  const loanScope = loanScopeConditions(scope);
  const branchIds = scope.kind === "branches" ? scope.branchIds : [];
  const borrowerConditions: SQL[] = [
    gte(sql`date(${users.date_created})`, period.start),
    lte(sql`date(${users.date_created})`, period.end),
  ];

  if (branchIds.length > 0) {
    borrowerConditions.push(inArray(areas.branch_id, branchIds));
  } else {
    borrowerConditions.push(eq(users.user_id, "00000000-0000-0000-0000-000000000000"));
  }

  const [loansCreatedThisMonth, borrowersAddedThisMonth] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)` })
      .from(loan_records)
      .where(
        whereFrom([
          ...loanScope,
          gte(loan_records.start_date, period.start),
          lte(loan_records.start_date, period.end),
        ]),
      )
      .then((rows) => toNumber(rows[0]?.value))
      .catch(() => 0),
    db
      .select({ value: sql<number>`count(*)` })
      .from(borrower_info)
      .innerJoin(users, eq(users.user_id, borrower_info.user_id))
      .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
      .where(whereFrom(borrowerConditions))
      .then((rows) => toNumber(rows[0]?.value))
      .catch(() => 0),
  ]);

  return {
    loansCreatedThisMonth,
    borrowersAddedThisMonth,
  };
}

async function getCollectorMetrics(collectorId: string, period: OverviewPeriod): Promise<CollectorMetrics> {

  const [assignedLoansCount, missedPaymentsCount] = await Promise.all([
    db
      .select({ value: sql<number>`count(*)` })
      .from(loan_records)
      .where(eq(loan_records.collector_id, collectorId))
      .then((rows) => toNumber(rows[0]?.value))
      .catch(() => 0),
    db
      .select({ value: sql<number>`count(*)` })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        and(
          eq(loan_records.collector_id, collectorId),
          eq(collections.amount, "0"),
          gte(collections.collection_date, period.start),
          lte(collections.collection_date, period.end),
        ),
      )
      .then((rows) => toNumber(rows[0]?.value))
      .catch(() => 0),
  ]);

  return {
    assignedLoansCount,
    missedPaymentsCount,
  };
}

async function getBorrowerOverview(borrowerId: string): Promise<BorrowerOverview> {
  const currentDate = todayInManila();
  const borrowerLoanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "borrower_overview_loan_metrics",
    currentDate,
    where: eq(loan_records.borrower_id, borrowerId),
  });

  const activeLoan = await db
      .select({
        loan_id: borrowerLoanMetrics.loanId,
        loan_code: borrowerLoanMetrics.loanCode,
        status: borrowerLoanMetrics.storedStatus,
        outstandingBalance: borrowerLoanMetrics.remainingBalance,
        dueDate: borrowerLoanMetrics.dueDate,
      })
    .from(borrowerLoanMetrics)
    .where(buildStoredLoanStatusInSql(borrowerLoanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES))
    .orderBy(desc(borrowerLoanMetrics.startDate), desc(borrowerLoanMetrics.loanId))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const fallbackLoan = activeLoan
    ? null
    : await db
        .select({
          loan_id: borrowerLoanMetrics.loanId,
          loan_code: borrowerLoanMetrics.loanCode,
          status: borrowerLoanMetrics.storedStatus,
          outstandingBalance: borrowerLoanMetrics.remainingBalance,
          dueDate: borrowerLoanMetrics.dueDate,
        })
        .from(borrowerLoanMetrics)
        .orderBy(desc(borrowerLoanMetrics.startDate), desc(borrowerLoanMetrics.loanId))
        .limit(1)
        .then((rows) => rows[0] ?? null)
        .catch(() => null);

  const collectorContactPromise = db
    .select({
      assignmentId: employee_area_assignment.assignment_id,
      assignmentStartDate: employee_area_assignment.start_date,
      collectorUserId: users.user_id,
      collectorCompanyId: users.company_id,
      collectorContactNo: users.contact_no,
      collectorFirstName: employee_info.first_name,
      collectorMiddleName: employee_info.middle_name,
      collectorLastName: employee_info.last_name,
      areaCode: areas.area_code,
      areaNo: areas.area_no,
      branchName: branch.branch_name,
      branchAddress: branch.branch_address,
      municipalityName: branch.municipality_name,
      provinceName: branch.province_name,
    })
    .from(borrower_info)
    .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
    .innerJoin(branch, eq(branch.branch_id, areas.branch_id))
    .leftJoin(
      employee_area_assignment,
      and(eq(employee_area_assignment.area_id, borrower_info.area_id), isNull(employee_area_assignment.end_date)),
    )
    .leftJoin(users, eq(users.user_id, employee_area_assignment.employee_user_id))
    .leftJoin(roles, eq(roles.role_id, users.role_id))
    .leftJoin(employee_info, eq(employee_info.user_id, users.user_id))
    .where(
      and(
        eq(borrower_info.user_id, borrowerId),
        eq(users.status, "active"),
        eq(roles.role_name, "Collector"),
      ),
    )
    .orderBy(
      desc(employee_area_assignment.start_date),
      desc(employee_area_assignment.assignment_id),
      employee_info.last_name,
      employee_info.first_name,
    )
    .limit(2)
    .catch(() => []);

  const currentLoan = activeLoan ?? fallbackLoan;
  const collectorRows = await collectorContactPromise;
  const primaryCollectorRow = collectorRows[0] ?? null;
  const collectorContact: BorrowerCollectorContact | null = primaryCollectorRow
    ? {
        collectorName:
          [
            primaryCollectorRow.collectorFirstName,
            primaryCollectorRow.collectorMiddleName?.trim()
              ? `${primaryCollectorRow.collectorMiddleName.trim().charAt(0)}.`
              : null,
            primaryCollectorRow.collectorLastName,
          ]
            .filter(Boolean)
            .join(" ") || primaryCollectorRow.collectorCompanyId || primaryCollectorRow.collectorUserId || "Assigned collector",
        collectorCompanyId: primaryCollectorRow.collectorCompanyId || primaryCollectorRow.collectorUserId || "N/A",
        contactNumber: primaryCollectorRow.collectorContactNo,
        areaLabel: primaryCollectorRow.areaCode || `Area ${primaryCollectorRow.areaNo}`,
        branchName: primaryCollectorRow.branchName,
        branchLocation: `${primaryCollectorRow.municipalityName}, ${primaryCollectorRow.provinceName}`,
        branchAddress: primaryCollectorRow.branchAddress,
        hasMultipleActiveCollectors: collectorRows.length > 1,
      }
    : null;

  if (!currentLoan) {
    return {
      currentLoanCode: "None",
      loanStatus: "No Loan",
      outstandingBalance: 0,
      latestPayment: 0,
      lastPaymentDate: "N/A",
      nextDueDate: "N/A",
      hasActiveOrOverdueLoan: false,
      collectorContact,
    };
  }

  const [outstandingBalance, latestPayment] = await Promise.all([
    Promise.resolve(toNumber(currentLoan.outstandingBalance)),
    db
      .select({
        amount: collections.amount,
        collection_date: collections.collection_date,
      })
      .from(collections)
      .where(eq(collections.loan_id, currentLoan.loan_id))
      .orderBy(desc(collections.collection_date), desc(collections.collection_id))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch(() => null),
  ]);

  return {
    currentLoanCode: currentLoan.loan_code,
    loanStatus: getVisibleLoanStatusFromStoredStatus(currentLoan.status),
    outstandingBalance,
    latestPayment: latestPayment ? toNumber(latestPayment.amount) : 0,
    lastPaymentDate: latestPayment?.collection_date ?? "N/A",
    nextDueDate: currentLoan.dueDate || "N/A",
    hasActiveOrOverdueLoan: currentLoan.status === "active" || currentLoan.status === "overdue",
    collectorContact,
  };
}

function formatPersonName(parts: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  fallback: string;
}) {
  const firstName = parts.firstName?.trim() ?? "";
  const middleName = parts.middleName?.trim() ?? "";
  const lastName = parts.lastName?.trim() ?? "";
  const middleInitial = middleName ? `${middleName.charAt(0)}.` : "";

  return [firstName, middleInitial, lastName].filter(Boolean).join(" ").trim() || parts.fallback;
}

async function loadBranchRankChartWidget(
  scope: DashboardScope,
  period: OverviewPeriod,
): Promise<DashboardSecondaryChartWidget> {
  const loanScope = loanScopeConditions(scope);
  const rows = await db
    .select({
      branchName: branch.branch_name,
      amount: sql<number>`coalesce(sum(${collections.amount}), 0)`,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .innerJoin(branch, eq(branch.branch_id, loan_records.branch_id))
    .where(
      whereFrom([
        ...loanScope,
        gte(collections.collection_date, period.start),
        lte(collections.collection_date, period.end),
      ]),
    )
    .groupBy(branch.branch_id, branch.branch_name)
    .orderBy(desc(sql`coalesce(sum(${collections.amount}), 0)`))
    .limit(7)
    .catch(() => []);

  const chart: AnalyticsChartModel = {
    rows: rows.map((row) => ({
      bucket: row.branchName,
      values: { amount: toNumber(row.amount) },
    })),
    series: [{ key: "amount", label: "Collections", color: "#22c55e" }],
    noData: rows.length === 0 || rows.every((row) => toNumber(row.amount) <= 0),
  };

  return {
    id: "chart.branch_collections_rank",
    title: "Top Branch Collections",
    description: "Collections ranked by branch in the selected period.",
    chart,
  };
}

async function loadRecentLoansCreatedWidget(
  scope: DashboardScope,
  period: OverviewPeriod,
): Promise<DashboardMiniListWidget> {
  const rows = await db
    .select({
      loanId: loan_records.loan_id,
      loanCode: loan_records.loan_code,
      principal: loan_records.principal,
      interest: loan_records.interest,
      startDate: loan_records.start_date,
      dueDate: loan_records.due_date,
      borrowerId: loan_records.borrower_id,
      borrowerFirstName: borrower_info.first_name,
      borrowerMiddleName: borrower_info.middle_name,
      borrowerLastName: borrower_info.last_name,
      borrowerCompanyId: users.company_id,
    })
    .from(loan_records)
    .innerJoin(users, eq(users.user_id, loan_records.borrower_id))
    .leftJoin(borrower_info, eq(borrower_info.user_id, loan_records.borrower_id))
    .where(
      whereFrom([
        ...loanScopeConditions(scope),
        gte(loan_records.start_date, period.start),
        lte(loan_records.start_date, period.end),
      ]),
    )
    .orderBy(desc(loan_records.loan_id))
    .limit(8)
    .catch(() => []);

  return {
    id: "list.recent_loans_created",
    title: "Recent Loans Created",
    description: "Latest loan records created in the selected period.",
    emptyMessage: "No loans were created in the selected period.",
    items: rows.map((row) => ({
      id: String(row.loanId),
      title: row.loanCode,
      subtitle: `${formatPersonName({
        firstName: row.borrowerFirstName,
        middleName: row.borrowerMiddleName,
        lastName: row.borrowerLastName,
        fallback: row.borrowerCompanyId ?? row.borrowerId,
      })} • Due ${formatDateShort(row.dueDate)}`,
      meta: formatMoney(toNumber(row.principal) + (toNumber(row.principal) * toNumber(row.interest)) / 100),
    })),
  };
}

async function loadCollectorDueSoonLoansWidget(
  collectorId: string,
  period: OverviewPeriod,
): Promise<DashboardMiniListWidget> {
  const loanMetrics = buildLoanDerivedMetricsSubquery({
    aliasName: "dashboard_collector_due_soon_loan_metrics",
    currentDate: period.end,
    where: whereFrom([eq(loan_records.collector_id, collectorId)]),
  });

  const rows = await db
    .select({
      loanId: loanMetrics.loanId,
      loanCode: loanMetrics.loanCode,
      dueDate: loanMetrics.dueDate,
      storedStatus: loanMetrics.storedStatus,
      remainingBalance: loanMetrics.remainingBalance,
      borrowerId: loanMetrics.borrowerId,
      borrowerFirstName: borrower_info.first_name,
      borrowerMiddleName: borrower_info.middle_name,
      borrowerLastName: borrower_info.last_name,
      borrowerCompanyId: users.company_id,
    })
    .from(loanMetrics)
    .innerJoin(users, eq(users.user_id, loanMetrics.borrowerId))
    .leftJoin(borrower_info, eq(borrower_info.user_id, loanMetrics.borrowerId))
    .where(buildStoredLoanStatusInSql(loanMetrics.storedStatus, LIVE_STORED_LOAN_STATUSES))
    .orderBy(asc(loanMetrics.dueDate), asc(loanMetrics.loanId))
    .limit(8)
    .catch(() => []);

  return {
    id: "list.collector_due_soon_loans",
    title: "Due Soon Loans",
    description: "Assigned loans requiring near-term collection action.",
    emptyMessage: "No active assigned loans are due soon.",
    items: rows.map((row) => ({
      id: String(row.loanId),
      title: row.loanCode,
      subtitle: `${formatPersonName({
        firstName: row.borrowerFirstName,
        middleName: row.borrowerMiddleName,
        lastName: row.borrowerLastName,
        fallback: row.borrowerCompanyId ?? row.borrowerId,
      })} • Due ${formatDateShort(row.dueDate)}`,
      meta: formatMoney(toNumber(row.remainingBalance)),
    })),
  };
}

async function loadBorrowerRecentPaymentsWidget(
  borrowerId: string,
): Promise<DashboardMiniListWidget> {
  const rows = await db
    .select({
      collectionId: collections.collection_id,
      loanCode: loan_records.loan_code,
      collectionDate: collections.collection_date,
      amount: collections.amount,
    })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(eq(loan_records.borrower_id, borrowerId))
    .orderBy(desc(collections.collection_date), desc(collections.collection_id))
    .limit(8)
    .catch(() => []);

  return {
    id: "list.borrower_recent_payments",
    title: "Recent Payments",
    description: "Latest recorded collections across your loan records.",
    emptyMessage: "No recorded payments yet.",
    items: rows.map((row) => ({
      id: String(row.collectionId),
      title: row.loanCode,
      subtitle: formatDateShort(row.collectionDate),
      meta: formatMoney(toNumber(row.amount)),
    })),
  };
}

void loadCollectorDueSoonLoansWidget;
void loadBorrowerRecentPaymentsWidget;

export async function loadDashboardOverviewData(
  state: DashboardOverviewState,
  period: OverviewPeriod,
): Promise<DashboardOverviewData> {
  if (state.variant === "none" || !state.scope) {
    return { variant: "none" };
  }

  if (state.variant === "management") {
    const overview = await getOverviewMetrics(state.scope, period);
    const shouldShowBranchCollectionsChart =
      state.auth.roleName === "Admin" || state.auth.roleName === "Auditor";
    const branchRankChart = shouldShowBranchCollectionsChart
      ? await loadBranchRankChartWidget(state.scope, period)
      : undefined;

    return {
      variant: "management",
      overview,
      widgets: {
        branchRankChart,
      },
    };
  }

  if (state.variant === "secretary") {
    const [overview, secretary] = await Promise.all([
      getOverviewMetrics(state.scope, period),
      getSecretaryMetrics(state.scope, period),
    ]);

    return {
      variant: "secretary",
      overview,
      secretary,
    };
  }

  if (state.variant === "collector") {
    const [overview, collector] = await Promise.all([
      getOverviewMetrics(state.scope, period),
      getCollectorMetrics(state.auth.userId, period),
    ]);

    return {
      variant: "collector",
      overview,
      collector,
    };
  }

  return {
    variant: "borrower",
    borrower: await getBorrowerOverview(state.auth.userId),
  };
}
