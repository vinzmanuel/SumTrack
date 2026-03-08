import "server-only";

import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { ACTIVE_LOAN_STATUSES } from "@/app/dashboard/loans/active-statuses";
import { firstDayOfMonth, toNumber, todayInManila } from "@/app/dashboard/overview-format";
import type {
  BorrowerOverview,
  CollectorMetrics,
  DashboardOverviewData,
  DashboardOverviewState,
  DashboardScope,
  OverviewMetrics,
  SecretaryMetrics,
} from "@/app/dashboard/overview-types";
import { db } from "@/db";
import { areas, borrower_info, collections, expenses, loan_records, users } from "@/db/schema";

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

async function getOverviewMetrics(scope: DashboardScope): Promise<OverviewMetrics> {
  const today = todayInManila();
  const monthStart = firstDayOfMonth(today);
  const loanScope = loanScopeConditions(scope);
  const expenseScope = expenseScopeConditions(scope);

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
    activeLoans,
    overdueLoans,
    totalPayableActive,
    paidAgainstActive,
    borrowerCount,
  ] = await Promise.all([
    db
      .select({ value: sql<number>`coalesce(sum(${collections.amount}), 0)` })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(
        whereFrom([...loanScope, gte(collections.collection_date, monthStart), lte(collections.collection_date, today)]),
      )
      .then((rows) => toNumber(rows[0]?.value))
      .catch(() => 0),
    db
      .select({ value: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
      .from(expenses)
      .where(whereFrom([...expenseScope, gte(expenses.expense_date, monthStart), lte(expenses.expense_date, today)]))
      .then((rows) => toNumber(rows[0]?.value))
      .catch(() => 0),
    db
      .select({ value: sql<number>`count(*)` })
      .from(loan_records)
      .where(whereFrom([...loanScope, inArray(loan_records.status, [...ACTIVE_LOAN_STATUSES])]))
      .then((rows) => toNumber(rows[0]?.value))
      .catch(() => 0),
    db
      .select({ value: sql<number>`count(*)` })
      .from(loan_records)
      .where(whereFrom([...loanScope, eq(loan_records.status, "Overdue")]))
      .then((rows) => toNumber(rows[0]?.value))
      .catch(() => 0),
    db
      .select({
        value: sql<number>`coalesce(sum(${loan_records.principal} + (${loan_records.principal} * ${loan_records.interest} / 100)), 0)`,
      })
      .from(loan_records)
      .where(whereFrom([...loanScope, inArray(loan_records.status, [...ACTIVE_LOAN_STATUSES])]))
      .then((rows) => toNumber(rows[0]?.value))
      .catch(() => 0),
    db
      .select({ value: sql<number>`coalesce(sum(${collections.amount}), 0)` })
      .from(collections)
      .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
      .where(whereFrom([...loanScope, inArray(loan_records.status, [...ACTIVE_LOAN_STATUSES])]))
      .then((rows) => toNumber(rows[0]?.value))
      .catch(() => 0),
    borrowerCountPromise,
  ]);

  return {
    collectionsThisMonth,
    expensesThisMonth,
    activeLoans,
    overdueLoans,
    outstandingBalance: Math.max(totalPayableActive - paidAgainstActive, 0),
    borrowerCount,
  };
}

async function getSecretaryMetrics(scope: DashboardScope): Promise<SecretaryMetrics> {
  const today = todayInManila();
  const monthStart = firstDayOfMonth(today);
  const loanScope = loanScopeConditions(scope);
  const branchIds = scope.kind === "branches" ? scope.branchIds : [];
  const borrowerConditions: SQL[] = [
    gte(sql`date(${users.date_created})`, monthStart),
    lte(sql`date(${users.date_created})`, today),
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
      .where(whereFrom([...loanScope, gte(loan_records.start_date, monthStart), lte(loan_records.start_date, today)]))
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

async function getCollectorMetrics(collectorId: string): Promise<CollectorMetrics> {
  const today = todayInManila();
  const monthStart = firstDayOfMonth(today);

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
          gte(collections.collection_date, monthStart),
          lte(collections.collection_date, today),
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
  const activeLoan = await db
    .select({
      loan_id: loan_records.loan_id,
      loan_code: loan_records.loan_code,
      status: loan_records.status,
      principal: loan_records.principal,
      interest: loan_records.interest,
      start_date: loan_records.start_date,
    })
    .from(loan_records)
    .where(and(eq(loan_records.borrower_id, borrowerId), inArray(loan_records.status, [...ACTIVE_LOAN_STATUSES])))
    .orderBy(desc(loan_records.start_date), desc(loan_records.loan_id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const fallbackLoan = activeLoan
    ? null
    : await db
        .select({
          loan_id: loan_records.loan_id,
          loan_code: loan_records.loan_code,
          status: loan_records.status,
          principal: loan_records.principal,
          interest: loan_records.interest,
        })
        .from(loan_records)
        .where(eq(loan_records.borrower_id, borrowerId))
        .orderBy(desc(loan_records.start_date), desc(loan_records.loan_id))
        .limit(1)
        .then((rows) => rows[0] ?? null)
        .catch(() => null);

  const currentLoan = activeLoan ?? fallbackLoan;
  if (!currentLoan) {
    return {
      currentLoanCode: "None",
      loanStatus: "No Loan",
      outstandingBalance: 0,
      latestPayment: 0,
      lastPaymentDate: "N/A",
    };
  }

  const [paidTotal, latestPayment] = await Promise.all([
    db
      .select({
        paid: sql<number>`coalesce(sum(${collections.amount}), 0)`,
      })
      .from(collections)
      .where(eq(collections.loan_id, currentLoan.loan_id))
      .then((rows) => toNumber(rows[0]?.paid))
      .catch(() => 0),
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

  const principal = toNumber(currentLoan.principal);
  const interest = toNumber(currentLoan.interest);
  const totalPayable = principal + (principal * interest) / 100;

  return {
    currentLoanCode: currentLoan.loan_code,
    loanStatus: currentLoan.status,
    outstandingBalance: Math.max(totalPayable - paidTotal, 0),
    latestPayment: latestPayment ? toNumber(latestPayment.amount) : 0,
    lastPaymentDate: latestPayment?.collection_date ?? "N/A",
  };
}

export async function loadDashboardOverviewData(
  state: DashboardOverviewState,
): Promise<DashboardOverviewData> {
  if (state.variant === "none" || !state.scope) {
    return { variant: "none" };
  }

  if (state.variant === "management") {
    return {
      variant: "management",
      overview: await getOverviewMetrics(state.scope),
    };
  }

  if (state.variant === "secretary") {
    const [overview, secretary] = await Promise.all([
      getOverviewMetrics(state.scope),
      getSecretaryMetrics(state.scope),
    ]);

    return {
      variant: "secretary",
      overview,
      secretary,
    };
  }

  if (state.variant === "collector") {
    const [overview, collector] = await Promise.all([
      getOverviewMetrics(state.scope),
      getCollectorMetrics(state.auth.userId),
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
