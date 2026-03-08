import { formatMoney } from "@/app/dashboard/expenses/format";
import type { ExpenseListRow } from "@/app/dashboard/expenses/types";

export function ExpensesTable({ expenses }: { expenses: ExpenseListRow[] }) {
  if (expenses.length === 0) {
    return <p className="text-muted-foreground text-sm">No expenses found for the selected filters.</p>;
  }

  return (
    <div className="overflow-auto">
      <table className="w-full min-w-300 text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-2 py-2 font-medium">Expense ID</th>
            <th className="px-2 py-2 font-medium">Branch</th>
            <th className="px-2 py-2 font-medium">Category</th>
            <th className="px-2 py-2 font-medium">Description</th>
            <th className="px-2 py-2 font-medium">Amount</th>
            <th className="px-2 py-2 font-medium">Expense Date</th>
            <th className="px-2 py-2 font-medium">Recorded By</th>
            <th className="px-2 py-2 font-medium">Recorded At</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((row) => (
            <tr className="border-b" key={row.expenseId}>
              <td className="px-2 py-2">{row.expenseId}</td>
              <td className="px-2 py-2">{row.branchName}</td>
              <td className="px-2 py-2">{row.category}</td>
              <td className="px-2 py-2">{row.description || "-"}</td>
              <td className="px-2 py-2">{formatMoney(row.amount)}</td>
              <td className="px-2 py-2">{row.expenseDate}</td>
              <td className="px-2 py-2">{row.recordedByCompanyId || row.recordedByUsername || "N/A"}</td>
              <td className="px-2 py-2">{row.recordedAt || "N/A"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
