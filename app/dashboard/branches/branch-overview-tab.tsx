import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollectionsAreaChart } from "@/app/dashboard/collections/collections-area-chart";
import type { BranchDetailOverviewData } from "@/app/dashboard/branches/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(parsed);
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1 rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function LeadershipCard({
  title,
  name,
  companyId,
}: {
  title: string;
  name: string | null;
  companyId: string | null;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{name ?? "No active assignment"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {companyId ? `Company ID ${companyId}` : "No active account assigned right now."}
      </p>
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
    <div className="rounded-xl border border-border/70 bg-background px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={tone === "warning" ? "mt-2 text-2xl font-semibold text-amber-700" : "mt-2 text-2xl font-semibold text-foreground"}>
        {value}
      </p>
    </div>
  );
}

export function BranchOverviewTab({ data }: { data: BranchDetailOverviewData }) {
  return (
    <div className="space-y-4">
      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="space-y-4 border-b bg-zinc-50/70 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Branch Overview
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{data.branchName}</h2>
            <p className="text-sm text-muted-foreground">
              Read-only branch summary for staffing, loan activity, and collections.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-zinc-200 bg-zinc-100 text-zinc-700" variant="outline">
              {data.branchCode}
            </Badge>
            <Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">
              {data.municipalityName}, {data.provinceName}
            </Badge>
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
              {data.statusLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pb-6 pt-6 md:grid-cols-2 xl:grid-cols-4">
          <DetailItem label="Branch Name" value={data.branchName} />
          <DetailItem label="Branch Code" value={data.branchCode} />
          <DetailItem label="Location" value={`${data.municipalityName}, ${data.provinceName}`} />
          <DetailItem label="Date Created" value={formatDate(data.dateCreated)} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-lg">Assigned Leadership</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 md:grid-cols-2">
            <LeadershipCard companyId={data.managerCompanyId} name={data.managerName} title="Branch Manager" />
            <LeadershipCard companyId={data.auditorCompanyId} name={data.auditorName} title="Auditor" />
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-lg">Staff Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
            <MetricCard label="Branch Managers" value={String(data.branchManagerCount)} />
            <MetricCard label="Auditors" value={String(data.auditorCount)} />
            <MetricCard label="Secretaries" value={String(data.secretaryCount)} />
            <MetricCard label="Collectors" value={String(data.collectorCount)} />
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="text-lg">Operational Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Borrowers" value={String(data.borrowerCount)} />
          <MetricCard label="Active Areas" value={String(data.activeAreaCount)} />
          <MetricCard label="Active Loans" value={String(data.activeLoanCount)} />
          <MetricCard label="Overdue Loans" tone="warning" value={String(data.overdueLoanCount)} />
          <MetricCard label="Collections This Month" value={formatCurrency(data.collectionsThisMonth)} />
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="space-y-1 pb-0">
          <CardTitle className="text-lg">Monthly Collections</CardTitle>
          <p className="text-sm text-muted-foreground">
            Six-month branch collection trend based on recorded collections inside this branch.
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <CollectionsAreaChart
            chart={data.collectionsTrend}
            valueFormatter={(value) => formatCurrency(value)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
