import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/app/dashboard/expenses/format";

export function ExpensesSummary(props: { totalExpenses: number; totalAmount: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Total Matching Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{props.totalExpenses}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Total Matching Amount</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{formatMoney(props.totalAmount)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
