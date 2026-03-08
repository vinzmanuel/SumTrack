import type { OverviewMetric } from "@/app/dashboard/_components/dashboard-tremor";
import { formatDateShort, formatMoney } from "@/app/dashboard/overview-format";
import type { DashboardOverviewData } from "@/app/dashboard/overview-types";

const cardStyles = {
  loans: "bg-red-100 text-red-600",
  collections: "bg-green-100 text-green-600",
  expenses: "bg-blue-100 text-blue-600",
  outstanding: "bg-purple-100 text-purple-600",
  overdue: "bg-amber-100 text-amber-600",
  borrowers: "bg-orange-100 text-orange-600",
} as const;

export function buildDashboardOverviewCards(data: DashboardOverviewData): OverviewMetric[] {
  if (data.variant === "management") {
    return [
      {
        label: "Total Active Loans",
        value: String(data.overview.activeLoans),
        supportingText: "Loans currently being repaid",
        iconKey: "loans",
        iconClassName: cardStyles.loans,
      },
      {
        label: "Collections This Month",
        value: formatMoney(data.overview.collectionsThisMonth),
        supportingText: "Recorded collections for the current month",
        iconKey: "collections",
        iconClassName: cardStyles.collections,
      },
      {
        label: "Expenses This Month",
        value: formatMoney(data.overview.expensesThisMonth),
        supportingText: "Recorded branch expenses for the current month",
        iconKey: "expenses",
        iconClassName: cardStyles.expenses,
      },
      {
        label: "Outstanding Balance",
        value: formatMoney(data.overview.outstandingBalance),
        supportingText: "Remaining unpaid balance across active/overdue loans",
        iconKey: "outstanding",
        iconClassName: cardStyles.outstanding,
      },
      {
        label: "Overdue Loans",
        value: String(data.overview.overdueLoans),
        supportingText: "Loans requiring follow-up",
        iconKey: "overdue",
        iconClassName: cardStyles.overdue,
      },
      {
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
        label: "Collections This Month",
        value: formatMoney(data.overview.collectionsThisMonth),
        supportingText: "Recorded collections for the current month",
        iconKey: "collections",
        iconClassName: cardStyles.collections,
      },
      {
        label: "Loans Created This Month",
        value: String(data.secretary.loansCreatedThisMonth),
        supportingText: "Loan records created this month",
        iconKey: "loans",
        iconClassName: cardStyles.loans,
      },
      {
        label: "Borrowers Added This Month",
        value: String(data.secretary.borrowersAddedThisMonth),
        supportingText: "Borrower accounts added this month",
        iconKey: "borrowers",
        iconClassName: cardStyles.borrowers,
      },
    ];
  }

  if (data.variant === "collector") {
    return [
      {
        label: "My Collections This Month",
        value: formatMoney(data.overview.collectionsThisMonth),
        supportingText: "Recorded collections for the current month",
        iconKey: "collections",
        iconClassName: cardStyles.collections,
      },
      {
        label: "Assigned Loans Count",
        value: String(data.collector.assignedLoansCount),
        supportingText: "Loans assigned to you",
        iconKey: "loans",
        iconClassName: cardStyles.loans,
      },
      {
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
        label: "Current Loan Code",
        value: data.borrower.currentLoanCode,
        supportingText: "Your current loan reference",
        iconKey: "loans",
        iconClassName: cardStyles.loans,
      },
      {
        label: "Outstanding Balance",
        value: formatMoney(data.borrower.outstandingBalance),
        supportingText: "Remaining balance for current loan",
        iconKey: "outstanding",
        iconClassName: cardStyles.outstanding,
      },
      {
        label: "Latest Payment",
        value: formatMoney(data.borrower.latestPayment),
        supportingText: "Most recent collection amount",
        iconKey: "collections",
        iconClassName: cardStyles.collections,
      },
      {
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
        label: "Loan Status",
        value: data.borrower.loanStatus,
        supportingText: "Current status of your loan",
        iconKey: "overdue",
        iconClassName: cardStyles.overdue,
      },
    ];
  }

  return [];
}
