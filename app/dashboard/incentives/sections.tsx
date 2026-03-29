import type { ComponentType } from "react";
import { CircleAlert, Landmark, TrendingUp, Users, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMoney, formatPercent, sectionTotal } from "@/app/dashboard/incentives/format";
import type { IncentiveRow } from "@/app/dashboard/incentives/lib";

type IncentivesSummaryCardsProps = {
  branchCollectorAverage: number;
  collectorAverageLabel: string;
  modeDescription: string;
  modeLabel: string;
  payoutStateDescription: string;
  payoutStateLabel: string;
  totalComputedIncentive: number;
  totalEmployees: number;
};

type IncentivesDataRegionProps = {
  branchManagerRows: IncentiveRow[];
  branchManagerRuleMissing: boolean;
  collectorRows: IncentiveRow[];
  collectorRuleMissing: boolean;
  secretaryRows: IncentiveRow[];
  secretaryRuleMissing: boolean;
  showBranchColumn: boolean;
};

type IncentivesRoleSection = {
  description: string;
  key: "collectors" | "secretaries" | "branch-managers";
  rows: IncentiveRow[];
  ruleMissing: boolean;
  title: string;
};

function SummaryMetricCard(props: {
  description: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
}) {
  const Icon = props.icon;

  return (
    <Card className="gap-4 py-0">
      <CardHeader className="flex flex-row items-start justify-between gap-4 border-b py-4">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">{props.title}</CardTitle>
          <CardDescription>{props.description}</CardDescription>
        </div>
        <div className="rounded-full border bg-muted/50 p-2 text-muted-foreground">
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="py-4">
        <p className="text-2xl font-semibold tracking-tight">{props.value}</p>
      </CardContent>
    </Card>
  );
}

function RuleCell(props: {
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
      <div className="flex flex-col gap-2">
        <Badge className="w-fit" variant="outline">
          Rule required
        </Badge>
        <p className="text-xs text-muted-foreground">No configured rule for this employee&apos;s branch role.</p>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-1 whitespace-normal">
      <p className="font-medium text-foreground">{formatPercent(props.percentValue)}</p>
      <p className="text-xs text-muted-foreground">+ {formatMoney(props.flatAmount)} flat amount</p>
    </div>
  );
}

function IncentivesRoleTable(props: {
  description: string;
  rows: IncentiveRow[];
  ruleMissing: boolean;
  showBranchColumn: boolean;
  title: string;
}) {
  const totalPayout = sectionTotal(props.rows);

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-foreground">{props.title}</h3>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{props.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{props.rows.length} employees</Badge>
          <Badge variant="outline">{formatMoney(totalPayout)} total payout</Badge>
        </div>
      </div>

      {props.ruleMissing ? (
        <Alert>
          <CircleAlert className="size-4" />
          <AlertTitle>Missing incentive rule</AlertTitle>
          <AlertDescription>
            At least one employee in this section does not have an applicable rule for the selected period, so
            computed payout is unavailable until the rule is configured.
          </AlertDescription>
        </Alert>
      ) : null}

      {props.rows.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 px-5 py-10 text-center">
          <p className="text-sm font-medium text-foreground">No eligible employees found.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This role has no employees in scope for the selected branch and month.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Company ID</TableHead>
              {props.showBranchColumn ? <TableHead>Branch</TableHead> : null}
              <TableHead>Base Amount</TableHead>
              <TableHead className="whitespace-normal">Rule Setup</TableHead>
              <TableHead className="text-right">Computed Incentive</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.rows.map((row) => (
              <TableRow key={`${row.roleName}-${row.userId}-${row.branchId}`}>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium text-foreground">{row.employeeName}</p>
                    <p className="text-xs text-muted-foreground">{row.roleName}</p>
                  </div>
                </TableCell>
                <TableCell>{row.companyId}</TableCell>
                {props.showBranchColumn ? (
                  <TableCell className="whitespace-normal">{row.branchName}</TableCell>
                ) : null}
                <TableCell>{formatMoney(row.baseAmount)}</TableCell>
                <TableCell className="whitespace-normal">
                  <RuleCell
                    computedIncentive={row.computedIncentive}
                    flatAmount={row.flatAmount}
                    percentValue={row.percentValue}
                  />
                </TableCell>
                <TableCell className="text-right">
                  {row.computedIncentive === null ? (
                    <span className="text-sm text-muted-foreground">—</span>
                  ) : (
                    <span className="font-semibold text-foreground">{formatMoney(row.computedIncentive)}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export function IncentivesSummaryCards(props: IncentivesSummaryCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryMetricCard
        description="Total staff rows currently included in payout output."
        icon={Users}
        title="Eligible Employees"
        value={props.totalEmployees.toLocaleString("en-PH")}
      />
      <SummaryMetricCard
        description="Combined payout amount across the active scope."
        icon={Wallet}
        title="Total Computed Incentive"
        value={formatMoney(props.totalComputedIncentive)}
      />
      <SummaryMetricCard
        description={props.collectorAverageLabel}
        icon={TrendingUp}
        title="Collector Average Basis"
        value={formatMoney(props.branchCollectorAverage)}
      />
      <SummaryMetricCard
        description={props.payoutStateDescription || props.modeDescription}
        icon={Landmark}
        title={props.modeLabel}
        value={props.payoutStateLabel}
      />
    </div>
  );
}

export function IncentivesDataRegion(props: IncentivesDataRegionProps) {
  const sections: IncentivesRoleSection[] = [
    {
      key: "collectors",
      title: "Collectors",
      description: "Collector incentive = (collector month total × percent ÷ 100) + flat amount.",
      rows: props.collectorRows,
      ruleMissing: props.collectorRuleMissing,
    },
    {
      key: "secretaries",
      title: "Secretaries",
      description: "Secretary incentive = (branch collector average × percent ÷ 100) + flat amount.",
      rows: props.secretaryRows,
      ruleMissing: props.secretaryRuleMissing,
    },
    {
      key: "branch-managers",
      title: "Branch Managers",
      description: "Branch manager incentive = (branch collector average × percent ÷ 100) + flat amount.",
      rows: props.branchManagerRows,
      ruleMissing: props.branchManagerRuleMissing,
    },
  ];

  const defaultSection = sections.find((section) => section.rows.length > 0) ?? sections[0];

  return (
    <Tabs className="w-full" defaultValue={defaultSection.key}>
      <Card className="overflow-hidden py-0">
        <CardHeader className="gap-4 border-b py-5">
          <div className="flex flex-col gap-1">
            <CardTitle>Role Breakdown</CardTitle>
            <CardDescription>
              Review payout rows by role, verify rule coverage, and inspect computed incentive values before export or
              finalization.
            </CardDescription>
          </div>
          <TabsList className="w-full justify-start overflow-x-auto" variant="line">
            {sections.map((section) => (
              <TabsTrigger key={section.key} value={section.key}>
                {section.title}
                <span className="text-xs text-muted-foreground">{section.rows.length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </CardHeader>

        {sections.map((section) => (
          <TabsContent className="m-0" key={section.key} value={section.key}>
            <IncentivesRoleTable
              description={section.description}
              rows={section.rows}
              ruleMissing={section.ruleMissing}
              showBranchColumn={props.showBranchColumn}
              title={section.title}
            />
          </TabsContent>
        ))}
      </Card>
    </Tabs>
  );
}
