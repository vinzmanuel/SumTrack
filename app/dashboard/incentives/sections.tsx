import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatPercent } from "@/app/dashboard/incentives/format";
import type { IncentiveRow } from "@/app/dashboard/incentives/lib";

export function IncentivesSummaryCards(props: {
  totalEmployees: number;
  totalComputedIncentive: number;
  branchCollectorAverage: number;
  isFinalized: boolean;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Eligible Employees</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{props.totalEmployees}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Total Computed Incentive</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{formatMoney(props.totalComputedIncentive)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Collector Average Basis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{formatMoney(props.branchCollectorAverage)}</p>
          {props.isFinalized ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Historical records are shown from finalized payout history.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function IncentivesSection(props: {
  title: string;
  description: string;
  rows: IncentiveRow[];
  ruleMissing: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {props.ruleMissing ? (
          <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
            No incentive rule configured for this role in the selected branch.
          </p>
        ) : null}

        {props.rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No eligible employees found.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-260 text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="px-2 py-2 font-medium">Employee</th>
                  <th className="px-2 py-2 font-medium">Company ID</th>
                  <th className="px-2 py-2 font-medium">Role</th>
                  <th className="px-2 py-2 font-medium">Branch</th>
                  <th className="px-2 py-2 font-medium">Base Amount</th>
                  <th className="px-2 py-2 font-medium">Percent</th>
                  <th className="px-2 py-2 font-medium">Flat Amount</th>
                  <th className="px-2 py-2 font-medium">Computed Incentive</th>
                </tr>
              </thead>
              <tbody>
                {props.rows.map((row) => (
                  <tr className="border-b" key={`${row.roleName}-${row.userId}`}>
                    <td className="px-2 py-2">{row.employeeName}</td>
                    <td className="px-2 py-2">{row.companyId}</td>
                    <td className="px-2 py-2">{row.roleName}</td>
                    <td className="px-2 py-2">{row.branchName}</td>
                    <td className="px-2 py-2">{formatMoney(row.baseAmount)}</td>
                    <td className="px-2 py-2">
                      {row.percentValue === null ? "No incentive rule configured" : formatPercent(row.percentValue)}
                    </td>
                    <td className="px-2 py-2">
                      {row.flatAmount === null ? "No incentive rule configured" : formatMoney(row.flatAmount)}
                    </td>
                    <td className="px-2 py-2">
                      {row.computedIncentive === null
                        ? "No incentive rule configured"
                        : formatMoney(row.computedIncentive)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
