import type { OverviewMetric } from "@/app/dashboard/_components/dashboard-tremor";
import { formatDateShort, formatMoney } from "@/app/dashboard/overview-format";
import type { DashboardOverviewData } from "@/app/dashboard/overview-types";

const cardStyles = {
  loans: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300",
  collections: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  expenses: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  outstanding: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  overdue: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  borrowers: "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-100",
  dueDate: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300",
} as const;

export function buildDashboardOverviewCards(data: DashboardOverviewData): OverviewMetric[] {
  return buildDashboardOverviewCardsForPeriod(data, "Last 30 Days");
}

export function buildDashboardOverviewCardsForPeriod(
  data: DashboardOverviewData,
  periodLabel: string,
): OverviewMetric[] {
  const periodLabelLower = periodLabel.toLowerCase();

  if (data.variant === "management") {
    return [
      {
        id: "kpi.active_loans",
        label: "Total Active Loans",
        value: String(data.overview.activeLoans),
        supportingText: "Loans currently being repaid",
        iconKey: "loans",
        iconClassName: cardStyles.loans,
      },
      {
        id: "kpi.collections_period",
        label: "Collections",
        value: formatMoney(data.overview.collectionsThisMonth),
        supportingText: `Recorded collections for ${periodLabelLower}`,
        iconKey: "collections",
        iconClassName: cardStyles.collections,
      },
      {
        id: "kpi.expenses_period",
        label: "Expenses",
        value: formatMoney(data.overview.expensesThisMonth),
        supportingText: `Recorded branch expenses for ${periodLabelLower}`,
        iconKey: "expenses",
        iconClassName: cardStyles.expenses,
      },
      {
        id: "kpi.outstanding_balance",
        label: "Outstanding Balance",
        value: formatMoney(data.overview.outstandingBalance),
        supportingText: "Remaining unpaid balance across active/overdue loans",
        iconKey: "outstanding",
        iconClassName: cardStyles.outstanding,
      },
      {
        id: "kpi.overdue_loans",
        label: "Overdue Loans",
        value: String(data.overview.overdueLoans),
        supportingText: "Loans requiring follow-up",
        iconKey: "overdue",
        iconClassName: cardStyles.overdue,
      },
      {
        id: "kpi.borrower_count",
        label: "Borrower Count",
        value: String(data.overview.borrowerCount),
        supportingText: "Borrowers within visible scope",
        iconKey: "borrowers",
        iconClassName: cardStyles.borrowers,
      },
    ];
  }

  if (data.variant === "secretary") {
    return [
      {
        id: "kpi.collections_period",
        label: "Collections",
        value: formatMoney(data.overview.collectionsThisMonth),
        supportingText: `Recorded collections for ${periodLabelLower}`,
        iconKey: "collections",
        iconClassName: cardStyles.collections,
      },
      {
        id: "kpi.loans_created_period",
        label: "Loans Created",
        value: String(data.secretary.loansCreatedThisMonth),
        supportingText: `Loan records created during ${periodLabelLower}`,
        iconKey: "loans",
        iconClassName: cardStyles.loans,
      },
      {
        id: "kpi.borrowers_added_period",
        label: "Borrowers Added",
        value: String(data.secretary.borrowersAddedThisMonth),
        supportingText: `Borrower accounts added during ${periodLabelLower}`,
        iconKey: "borrowers",
        iconClassName: cardStyles.borrowers,
      },
    ];
  }

  if (data.variant === "collector") {
    return [
      {
        id: "kpi.collections_period",
        label: "My Collections",
        value: formatMoney(data.overview.collectionsThisMonth),
        supportingText: `Recorded collections for ${periodLabelLower}`,
        iconKey: "collections",
        iconClassName: cardStyles.collections,
      },
      {
        id: "kpi.assigned_loans_count",
        label: "Active Assigned Loans",
        value: String(data.collector.assignedLoansCount),
        supportingText: "Loans assigned to you",
        iconKey: "loans",
        iconClassName: cardStyles.loans,
      },
      {
        id: "kpi.missed_payments_period",
        label: "Missed Payments on Assigned Loans",
        value: String(data.collector.missedPaymentsCount),
        supportingText: "Missed payment entries this month",
        iconKey: "overdue",
        iconClassName: cardStyles.overdue,
      },
    ];
  }

  if (data.variant === "borrower") {
    return [
      {
        id: "kpi.current_loan_code",
        label: "Current Loan Code",
        value: data.borrower.currentLoanCode,
        supportingText: "Your current loan reference",
        iconKey: "loans",
        iconClassName: cardStyles.loans,
      },
      {
        id: "kpi.outstanding_balance",
        label: "Outstanding Balance",
        value: formatMoney(data.borrower.outstandingBalance),
        supportingText: "Remaining balance for current loan",
        iconKey: "outstanding",
        iconClassName: cardStyles.outstanding,
      },
      {
        id: "kpi.latest_payment_amount",
        label: "Latest Payment",
        value: formatMoney(data.borrower.latestPayment),
        supportingText: "Most recent collection amount",
        iconKey: "collections",
        iconClassName: cardStyles.collections,
      },
      {
        id: "kpi.last_payment_date",
        label: "Last Payment Date",
        value:
          data.borrower.lastPaymentDate && data.borrower.lastPaymentDate !== "N/A"
            ? formatDateShort(data.borrower.lastPaymentDate)
            : "N/A",
        supportingText: "Date of latest recorded payment",
        iconKey: "borrowers",
        iconClassName: cardStyles.borrowers,
      },
      {
        id: "kpi.loan_status",
        label: "Loan Status",
        value: data.borrower.loanStatus,
        supportingText: "Current status of your loan",
        iconKey: "overdue",
        iconClassName: cardStyles.overdue,
      },
      {
        id: "kpi.next_due_date",
        label: "Next Due Date",
        value:
          data.borrower.nextDueDate && data.borrower.nextDueDate !== "N/A"
            ? formatDateShort(data.borrower.nextDueDate)
            : "N/A",
        supportingText: "Due date of current loan",
        iconKey: "dueDate",
        iconClassName: cardStyles.dueDate,
      },
    ];
  }

  return [];
}
