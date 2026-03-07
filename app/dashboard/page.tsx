import { and, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDashboardAuth } from "@/app/dashboard/auth";
import {
  DashboardMetricGrid,
  type OverviewMetric,
} from "@/app/dashboard/_components/dashboard-tremor";
import { ACTIVE_LOAN_STATUSES } from "@/app/dashboard/loans/active-statuses";
import { db } from "@/db";
import {
  borrower_info,
  collections,
  expenses,
  loan_records,
  areas,
  users,
} from "@/db/schema";

type DashboardScope =
  | { kind: "all_branches" }
  | { kind: "branches"; branchIds: number[] }
  | { kind: "collector"; collectorId: string }
  | { kind: "borrower"; borrowerId: string };

function formatMoney(value: number) {
  return `\u20B1${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function todayInManila() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

function firstDayOfMonth(dateString: string) {
  return `${dateString.slice(0, 7)}-01`;
}

function loanScopeConditions(scope: DashboardScope): SQL[] {
  if (scope.kind === "all_branches") return [];
  if (scope.kind === "branches") {
    if (scope.branchIds.length === 0) return [eq(loan_records.loan_id, -1)];
    return [inArray(loan_records.branch_id, scope.branchIds)];
  }
  if (scope.kind === "collector") return [eq(loan_records.collector_id, scope.collectorId)];
  return [eq(loan_records.borrower_id, scope.borrowerId)];
}

function expenseScopeConditions(scope: DashboardScope): SQL[] {
  if (scope.kind === "all_branches") return [];
  if (scope.kind === "branches") {
    if (scope.branchIds.length === 0) return [eq(expenses.expense_id, -1)];
    return [inArray(expenses.branch_id, scope.branchIds)];
  }
  return [eq(expenses.expense_id, -1)];
}

function whereFrom(conditions: SQL[]) {
  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions);
}

async function getOverviewMetrics(scope: DashboardScope) {
  const today = todayInManila();
  const monthStart = firstDayOfMonth(today);
  const loanScope = loanScopeConditions(scope);
  const expenseScope = expenseScopeConditions(scope);

  const collectionsThisMonth = await db
    .select({ value: sql<number>`coalesce(sum(${collections.amount}), 0)` })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(and(...loanScope, gte(collections.collection_date, monthStart), lte(collections.collection_date, today)))
    .then((rows) => toNumber(rows[0]?.value))
    .catch(() => 0);

  const expensesThisMonth = await db
    .select({ value: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
    .from(expenses)
    .where(and(...expenseScope, gte(expenses.expense_date, monthStart), lte(expenses.expense_date, today)))
    .then((rows) => toNumber(rows[0]?.value))
    .catch(() => 0);

  const activeLoans = await db
    .select({ value: sql<number>`count(*)` })
    .from(loan_records)
    .where(and(...loanScope, inArray(loan_records.status, [...ACTIVE_LOAN_STATUSES])))
    .then((rows) => toNumber(rows[0]?.value))
    .catch(() => 0);

  const overdueLoans = await db
    .select({ value: sql<number>`count(*)` })
    .from(loan_records)
    .where(and(...loanScope, eq(loan_records.status, "Overdue")))
    .then((rows) => toNumber(rows[0]?.value))
    .catch(() => 0);

  const totalPayableActive = await db
    .select({
      value: sql<number>`coalesce(sum(${loan_records.principal} + (${loan_records.principal} * ${loan_records.interest} / 100)), 0)`,
    })
    .from(loan_records)
    .where(and(...loanScope, inArray(loan_records.status, [...ACTIVE_LOAN_STATUSES])))
    .then((rows) => toNumber(rows[0]?.value))
    .catch(() => 0);

  const paidAgainstActive = await db
    .select({ value: sql<number>`coalesce(sum(${collections.amount}), 0)` })
    .from(collections)
    .innerJoin(loan_records, eq(loan_records.loan_id, collections.loan_id))
    .where(and(...loanScope, inArray(loan_records.status, [...ACTIVE_LOAN_STATUSES])))
    .then((rows) => toNumber(rows[0]?.value))
    .catch(() => 0);

  const outstandingBalance = Math.max(totalPayableActive - paidAgainstActive, 0);

  let borrowerCount = 0;
  if (scope.kind === "all_branches" || scope.kind === "branches") {
    const borrowerScope: SQL[] = [];
    if (scope.kind === "branches") {
      borrowerScope.push(inArray(loan_records.branch_id, scope.branchIds));
    }
    borrowerCount = await db
      .select({ value: sql<number>`count(distinct ${borrower_info.user_id})` })
      .from(borrower_info)
      .innerJoin(loan_records, eq(loan_records.borrower_id, borrower_info.user_id))
      .where(whereFrom(borrowerScope))
      .then((rows) => toNumber(rows[0]?.value))
      .catch(() => 0);
  }

  return {
    collectionsThisMonth,
    expensesThisMonth,
    activeLoans,
    overdueLoans,
    outstandingBalance,
    borrowerCount,
  };
}

async function getSecretaryMetrics(scope: DashboardScope) {
  const today = todayInManila();
  const monthStart = firstDayOfMonth(today);
  const loanScope = loanScopeConditions(scope);
  const branchIds = scope.kind === "branches" ? scope.branchIds : [];

  const loansCreatedThisMonth = await db
    .select({ value: sql<number>`count(*)` })
    .from(loan_records)
    .where(and(...loanScope, gte(loan_records.start_date, monthStart), lte(loan_records.start_date, today)))
    .then((rows) => toNumber(rows[0]?.value))
    .catch(() => 0);

  const borrowerConditions: SQL[] = [
    gte(sql`date(${users.date_created})`, monthStart),
    lte(sql`date(${users.date_created})`, today),
  ];
  if (branchIds.length > 0) {
    borrowerConditions.push(inArray(areas.branch_id, branchIds));
  } else {
    borrowerConditions.push(eq(users.user_id, "00000000-0000-0000-0000-000000000000"));
  }

  const borrowersAddedThisMonth = await db
    .select({ value: sql<number>`count(*)` })
    .from(borrower_info)
    .innerJoin(users, eq(users.user_id, borrower_info.user_id))
    .innerJoin(areas, eq(areas.area_id, borrower_info.area_id))
    .where(and(...borrowerConditions))
    .then((rows) => toNumber(rows[0]?.value))
    .catch(() => 0);

  return {
    loansCreatedThisMonth,
    borrowersAddedThisMonth,
  };
}

async function getCollectorMetrics(collectorId: string) {
  const today = todayInManila();
  const monthStart = firstDayOfMonth(today);

  const assignedLoansCount = await db
    .select({ value: sql<number>`count(*)` })
    .from(loan_records)
    .where(eq(loan_records.collector_id, collectorId))
    .then((rows) => toNumber(rows[0]?.value))
    .catch(() => 0);

  const missedPaymentsCount = await db
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
    .catch(() => 0);

  return {
    assignedLoansCount,
    missedPaymentsCount,
  };
}

async function getBorrowerOverview(borrowerId: string) {
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

  const totals = await db
    .select({
      paid: sql<number>`coalesce(sum(${collections.amount}), 0)`,
    })
    .from(collections)
    .where(eq(collections.loan_id, currentLoan.loan_id))
    .then((rows) => toNumber(rows[0]?.paid))
    .catch(() => 0);

  const latestPayment = await db
    .select({
      amount: collections.amount,
      collection_date: collections.collection_date,
    })
    .from(collections)
    .where(eq(collections.loan_id, currentLoan.loan_id))
    .orderBy(desc(collections.collection_date), desc(collections.collection_id))
    .limit(1)
    .then((rows) => rows[0] ?? null)
    .catch(() => null);

  const principal = toNumber(currentLoan.principal);
  const interest = toNumber(currentLoan.interest);
  const totalPayable = principal + (principal * interest) / 100;
  const outstandingBalance = Math.max(totalPayable - totals, 0);

  return {
    currentLoanCode: currentLoan.loan_code,
    loanStatus: currentLoan.status,
    outstandingBalance,
    latestPayment: latestPayment ? toNumber(latestPayment.amount) : 0,
    lastPaymentDate: latestPayment?.collection_date ?? "N/A",
  };
}

function formatDateShort(value: string) {
  const [year, month, day] = value.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

export default async function DashboardPage() {
  const auth = await requireDashboardAuth();
  if (!auth.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{auth.message}</p>
        </CardContent>
      </Card>
    );
  }

  const isAdmin = auth.roleName === "Admin";
  const isBranchManager = auth.roleName === "Branch Manager";
  const isAuditor = auth.roleName === "Auditor";
  const isSecretary = auth.roleName === "Secretary";
  const isCollector = auth.roleName === "Collector";
  const isBorrower = auth.roleName === "Borrower";
  const showManagementDashboard = isAdmin || isBranchManager || isAuditor;

  let baseScope: DashboardScope = { kind: "all_branches" };
  if (isAdmin) {
    baseScope = { kind: "all_branches" };
  } else if (isAuditor) {
    baseScope = { kind: "branches", branchIds: auth.assignedBranchIds };
  } else if (isBranchManager || isSecretary) {
    baseScope = { kind: "branches", branchIds: auth.activeBranchId ? [auth.activeBranchId] : [] };
  } else if (isCollector) {
    baseScope = { kind: "collector", collectorId: auth.userId };
  } else {
    baseScope = { kind: "borrower", borrowerId: auth.userId };
  }

  const overviewMetrics = await getOverviewMetrics(baseScope);
  const secretaryMetrics = isSecretary ? await getSecretaryMetrics(baseScope) : null;
  const collectorMetrics = isCollector ? await getCollectorMetrics(auth.userId) : null;
  const borrowerOverview = isBorrower ? await getBorrowerOverview(auth.userId) : null;

  const cards: OverviewMetric[] = [];
  if (showManagementDashboard) {
    cards.push(
      {
        label: "Total Active Loans",
        value: overviewMetrics.activeLoans.toString(),
        supportingText: "Loans currently being repaid",
        iconKey: "loans",
        iconClassName: "bg-red-100 text-red-600",
      },
      {
        label: "Collections This Month",
        value: formatMoney(overviewMetrics.collectionsThisMonth),
        supportingText: "Recorded collections for the current month",
        iconKey: "collections",
        iconClassName: "bg-green-100 text-green-600",
      },
      {
        label: "Expenses This Month",
        value: formatMoney(overviewMetrics.expensesThisMonth),
        supportingText: "Recorded branch expenses for the current month",
        iconKey: "expenses",
        iconClassName: "bg-blue-100 text-blue-600",
      },
      {
        label: "Outstanding Balance",
        value: formatMoney(overviewMetrics.outstandingBalance),
        supportingText: "Remaining unpaid balance across active/overdue loans",
        iconKey: "outstanding",
        iconClassName: "bg-purple-100 text-purple-600",
      },
      {
        label: "Overdue Loans",
        value: overviewMetrics.overdueLoans.toString(),
        supportingText: "Loans requiring follow-up",
        iconKey: "overdue",
        iconClassName: "bg-amber-100 text-amber-600",
      },
      {
        label: "Borrower Count",
        value: overviewMetrics.borrowerCount.toString(),
        supportingText: "Borrowers within visible scope",
        iconKey: "borrowers",
        iconClassName: "bg-orange-100 text-orange-600",
      },
    );
  } else if (isSecretary) {
    cards.push(
      {
        label: "Collections This Month",
        value: formatMoney(overviewMetrics.collectionsThisMonth),
        supportingText: "Recorded collections for the current month",
        iconKey: "collections",
        iconClassName: "bg-green-100 text-green-600",
      },
      {
        label: "Loans Created This Month",
        value: String(secretaryMetrics?.loansCreatedThisMonth ?? 0),
        supportingText: "Loan records created this month",
        iconKey: "loans",
        iconClassName: "bg-red-100 text-red-600",
      },
      {
        label: "Borrowers Added This Month",
        value: String(secretaryMetrics?.borrowersAddedThisMonth ?? 0),
        supportingText: "Borrower accounts added this month",
        iconKey: "borrowers",
        iconClassName: "bg-orange-100 text-orange-600",
      },
    );
  } else if (isCollector) {
    cards.push(
      {
        label: "My Collections This Month",
        value: formatMoney(overviewMetrics.collectionsThisMonth),
        supportingText: "Recorded collections for the current month",
        iconKey: "collections",
        iconClassName: "bg-green-100 text-green-600",
      },
      {
        label: "Assigned Loans Count",
        value: String(collectorMetrics?.assignedLoansCount ?? 0),
        supportingText: "Loans assigned to you",
        iconKey: "loans",
        iconClassName: "bg-red-100 text-red-600",
      },
      {
        label: "Missed Payments on Assigned Loans",
        value: String(collectorMetrics?.missedPaymentsCount ?? 0),
        supportingText: "Missed payment entries this month",
        iconKey: "overdue",
        iconClassName: "bg-amber-100 text-amber-600",
      },
    );
  } else if (isBorrower) {
    cards.push(
      {
        label: "Current Loan Code",
        value: borrowerOverview?.currentLoanCode ?? "None",
        supportingText: "Your current loan reference",
        iconKey: "loans",
        iconClassName: "bg-red-100 text-red-600",
      },
      {
        label: "Outstanding Balance",
        value: formatMoney(borrowerOverview?.outstandingBalance ?? 0),
        supportingText: "Remaining balance for current loan",
        iconKey: "outstanding",
        iconClassName: "bg-purple-100 text-purple-600",
      },
      {
        label: "Latest Payment",
        value: formatMoney(borrowerOverview?.latestPayment ?? 0),
        supportingText: "Most recent collection amount",
        iconKey: "collections",
        iconClassName: "bg-green-100 text-green-600",
      },
      {
        label: "Last Payment Date",
        value:
          borrowerOverview?.lastPaymentDate && borrowerOverview.lastPaymentDate !== "N/A"
            ? formatDateShort(borrowerOverview.lastPaymentDate)
            : "N/A",
        supportingText: "Date of latest recorded payment",
        iconKey: "borrowers",
        iconClassName: "bg-orange-100 text-orange-600",
      },
      {
        label: "Loan Status",
        value: borrowerOverview?.loanStatus ?? "No Loan",
        supportingText: "Current status of your loan",
        iconKey: "overdue",
        iconClassName: "bg-amber-100 text-amber-600",
      },
    );
  }

  return (
    <div className="space-y-6">
      <DashboardMetricGrid items={cards} />
    </div>
  );
}
