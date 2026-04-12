import { CircleAlert, Gift, TrendingUp, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney, formatPercent, sectionTotal } from "@/app/dashboard/incentives/format";
import type { IncentiveRow } from "@/app/dashboard/incentives/lib";

type IncentivesSummaryStripProps = {
  branchCollectorAverage: number;
  collectorAverageLabel: string;
  totalComputedIncentive: number;
  totalEmployees: number;
};

type IncentivesPayoutTableProps = {
  branchManagerRows: IncentiveRow[];
  branchManagerRuleMissing: boolean;
  collectorRows: IncentiveRow[];
  collectorRuleMissing: boolean;
  secretaryRows: IncentiveRow[];
  secretaryRuleMissing: boolean;
  showBranchColumn: boolean;
};

function formatEmployeeName(row: IncentiveRow) {
  const companyIdSuffix = row.companyId ? ` (${row.companyId})` : "";

  if (row.firstName && row.lastName) {
    const middleInitial = row.middleName?.trim() ? `${row.middleName.trim().charAt(0)}.` : null;
    return `${[row.firstName, middleInitial, row.lastName].filter(Boolean).join(" ")}${companyIdSuffix}`;
  }

  return `${row.employeeName}${companyIdSuffix}`;
}

function roleBadgeClass(roleName: IncentiveRow["roleName"]) {
  if (roleName === "Collector") {
    return "rounded-md border border-emerald-200 bg-emerald-50 py-1 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  if (roleName === "Secretary") {
    return "rounded-md border border-violet-200 bg-violet-50 py-1 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300";
  }

  return "rounded-md border border-amber-200 bg-amber-50 py-1 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
}

function RuleSetupCell(props: {
  computedIncentive: number | null;
  flatAmount: number | null;
  percentValue: number | null;
}) {
  if (
    props.percentValue === null ||
    props.flatAmount === null ||
    props.computedIncentive === null
  ) {
    return (
      <div className="flex">
        <Badge className="w-fit" variant="outline">
          Missing rule
        </Badge>
      </div>
    );
  }

  return (
    <span className="font-medium text-foreground">
      {formatPercent(props.percentValue)} + {formatMoney(props.flatAmount)}
    </span>
  );
}

export function IncentivesSummaryStrip(props: IncentivesSummaryStripProps) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-md border bg-rose-50/70 px-4 py-4 dark:border-rose-500/30 dark:bg-rose-500/10">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Gift className="size-5 text-rose-600" />
          Total Incentives
        </div>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          {formatMoney(props.totalComputedIncentive)}
        </p>
      </div>

      <div className="rounded-md border bg-muted/20 px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <TrendingUp className="size-4" />
          Branch Collector Average
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {formatMoney(props.branchCollectorAverage)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{props.collectorAverageLabel}</p>
      </div>

      <div className="rounded-md border bg-muted/20 px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Users className="size-4" />
          Eligible Employees
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {props.totalEmployees.toLocaleString("en-PH")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Employees included in this monthly payout view.</p>
      </div>
    </div>
  );
}

export function IncentivesPayoutTable(props: IncentivesPayoutTableProps) {
  const rows = [...props.collectorRows, ...props.secretaryRows, ...props.branchManagerRows];
  const totalPayout = sectionTotal(rows);
  const hasMissingRule =
    props.collectorRuleMissing || props.secretaryRuleMissing || props.branchManagerRuleMissing;

  const sortedRows = [...rows].sort((left, right) => {
    const roleOrder = {
      Collector: 0,
      "Branch Manager": 1,
      Secretary: 2,
    } as const;

    const roleCompare = roleOrder[left.roleName] - roleOrder[right.roleName];
    if (roleCompare !== 0) {
      return roleCompare;
    }

    const lastCompare = (left.lastName ?? left.employeeName).localeCompare(right.lastName ?? right.employeeName);
    if (lastCompare !== 0) {
      return lastCompare;
    }

    return (left.firstName ?? left.employeeName).localeCompare(right.firstName ?? right.employeeName);
  });

  return (
    <div className="flex flex-col gap-4">
      {hasMissingRule ? (
        <Alert>
          <CircleAlert className="size-4" />
          <AlertTitle>Some incentive rows are missing a rule</AlertTitle>
          <AlertDescription>
            Employees without a configured rule stay visible, but their incentive value remains unavailable until the
            rule is created.
          </AlertDescription>
        </Alert>
      ) : null}

      {sortedRows.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-5 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No eligible employees found.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a branch and month with incentive activity to populate the payout table.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table className="[&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:first-child]:pl-5 [&_th:last-child]:pr-5">
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Base Amount</TableHead>
                <TableHead className="whitespace-normal">Rule Setup</TableHead>
                <TableHead className="text-right">Incentive</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => (
                <TableRow key={`${row.roleName}-${row.userId}-${row.branchId}`}>
                  <TableCell>
                    <Badge className={roleBadgeClass(row.roleName)} variant="outline">
                      {row.roleName}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <span className="font-medium text-foreground">{formatEmployeeName(row)}</span>
                  </TableCell>
                  <TableCell>{formatMoney(row.baseAmount)}</TableCell>
                  <TableCell className="whitespace-normal">
                    <RuleSetupCell
                      computedIncentive={row.computedIncentive}
                      flatAmount={row.flatAmount}
                      percentValue={row.percentValue}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {row.computedIncentive === null ? (
                      <span className="text-sm text-muted-foreground">N/A</span>
                    ) : (
                      <span className="font-semibold text-foreground">{formatMoney(row.computedIncentive)}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold" colSpan={4}>
                  Total
                </TableCell>
                <TableCell className="text-right font-semibold">{formatMoney(totalPayout)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
}
