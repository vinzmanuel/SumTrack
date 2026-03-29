import { ReceiptText, WalletCards, Waves } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/app/dashboard/expenses/format";

export function ExpensesSummary(props: { totalExpenses: number; totalAmount: number }) {
  const averageExpense = props.totalExpenses > 0 ? props.totalAmount / props.totalExpenses : 0;

  return (
    <div className="grid gap-3 lg:grid-cols-3 pb-2">
      <Card className="gap-0 rounded-2xl border bg-slate-50/70 py-0 shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ReceiptText className="size-4" />
            Total Matching Expenses
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            {props.totalExpenses.toLocaleString("en-PH")}
          </p>
        </CardContent>
      </Card>

      <Card className="gap-0 rounded-2xl border bg-emerald-50/60 py-0 shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <WalletCards className="size-4" />
            Total Matching Amount
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{formatMoney(props.totalAmount)}</p>
        </CardContent>
      </Card>

      <Card className="gap-0 rounded-2xl border bg-muted/20 py-0 shadow-none">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Waves className="size-4" />
            Average Matching Expense
          </div>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{formatMoney(averageExpense)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
