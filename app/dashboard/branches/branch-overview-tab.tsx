import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUiRoleBadgeClassName } from "@/app/dashboard/_components/ui-patterns";
import { CollectionsAreaChart } from "@/app/dashboard/collections/collections-area-chart";
import { formatStoredDateForManila } from "@/app/dashboard/datetime";
import type { BranchDetailOverviewData } from "@/app/dashboard/branches/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  return formatStoredDateForManila(value, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex h-full min-h-[108px] flex-col rounded-md border border-border/70 bg-muted/15 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function LeadershipCard({
  roleName,
  name,
  companyId,
}: {
  roleName: "Branch Manager" | "Auditor";
  name: string | null;
  companyId: string | null;
}) {
  return (
    <div className="flex h-full min-h-[108px] flex-col rounded-md border border-border/70 bg-card px-4 py-3">
      <div>
        <Badge className={getUiRoleBadgeClassName(roleName)} variant="outline">
          {roleName}
        </Badge>
      </div>
      <p className="mt-2 text-sm font-semibold text-foreground">{name ?? "No active assignment"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {companyId ? `Company ID ${companyId}` : "No active account assigned right now."}
      </p>
    </div>
  );
}

function CountCard({
  roleLabel,
  roleName,
  value,
}: {
  roleLabel: string;
  roleName: "Secretary" | "Collector";
  value: string;
}) {
  return (
    <div className="flex h-full min-h-[108px] flex-col rounded-md border border-border/70 bg-card px-4 py-3">
      <div>
        <Badge className={getUiRoleBadgeClassName(roleName)} variant="outline">
          {roleLabel}
        </Badge>
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/10 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={
          tone === "warning"
            ? "mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-300"
            : "mt-1 text-2xl font-semibold text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

export function BranchOverviewTab({ data }: { data: BranchDetailOverviewData }) {
  return (
    <div className="grid gap-4 xl:grid-cols-12 xl:items-stretch">
      <Card className="rounded-md border-border/70 py-0 shadow-sm xl:col-span-6">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base">Branch Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 pb-4 pt-0 sm:grid-cols-2">
          <DetailItem label="Municipality / City and Province" value={`${data.municipalityName}, ${data.provinceName}`} />
          <DetailItem label="Branch Code" value={data.branchCode} />
          <DetailItem label="Branch Address" value={data.branchAddress} />
          <DetailItem label="Date Created" value={formatDate(data.dateCreated)} />
        </CardContent>
      </Card>

      <Card className="rounded-md border-border/70 py-0 shadow-sm xl:col-span-6">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base">Assigned Leadership and Staff Coverage</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 pb-4 pt-0 sm:grid-cols-2">
          <LeadershipCard
            companyId={data.managerCompanyId}
            name={data.managerName}
            roleName="Branch Manager"
          />
          <LeadershipCard
            companyId={data.auditorCompanyId}
            name={data.auditorName}
            roleName="Auditor"
          />
          <CountCard roleLabel="Secretaries" roleName="Secretary" value={String(data.secretaryCount)} />
          <CountCard roleLabel="Collectors" roleName="Collector" value={String(data.collectorCount)} />
        </CardContent>
      </Card>

      <Card className="rounded-md border-border/70 py-0 shadow-sm xl:col-span-4 xl:h-full">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-base">Operational Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2.5 pb-4 pt-0">
          <MetricCard label="Borrowers" value={String(data.borrowerCount)} />
          <MetricCard label="Active Areas" value={String(data.activeAreaCount)} />
          <MetricCard label="Active Loans" value={String(data.activeLoanCount)} />
          <MetricCard label="Overdue Loans" tone="warning" value={String(data.overdueLoanCount)} />
          <MetricCard label="Collections This Month" value={formatCurrency(data.collectionsThisMonth)} />
        </CardContent>
      </Card>

      <Card className="flex rounded-md border-border/70 py-0 shadow-sm xl:col-span-8 xl:h-full xl:flex-col">
        <CardHeader className="space-y-1 pb-0 pt-4">
          <CardTitle className="text-base">Monthly Collections</CardTitle>
          <p className="text-sm text-muted-foreground">
            Six-month branch collection trend based on recorded collections inside this branch.
          </p>
        </CardHeader>
        <CardContent className="flex-1 pb-4 pt-2">
          <CollectionsAreaChart
            chart={data.collectionsTrend}
            className="h-full min-h-[340px]"
            valueFormatter={(value) => formatCurrency(value)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
