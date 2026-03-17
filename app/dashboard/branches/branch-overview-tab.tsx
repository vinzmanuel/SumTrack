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
    <div className="flex h-full flex-col rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function RoleBadge({
  label,
  tone,
}: {
  label: string;
  tone: "branchManager" | "auditor" | "secretary" | "collector";
}) {
  const className =
    tone === "branchManager"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "auditor"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : tone === "secretary"
          ? "border-violet-200 bg-violet-50 text-violet-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <Badge className={className} variant="outline">
      {label}
    </Badge>
  );
}

function LeadershipCard({
  roleLabel,
  roleTone,
  name,
  companyId,
}: {
  roleLabel: string;
  roleTone: "branchManager" | "auditor";
  name: string | null;
  companyId: string | null;
}) {
  return (
    <div className="flex h-full flex-col justify-center rounded-xl border border-border/70 bg-background px-4 py-4">
      <div>
        <RoleBadge label={roleLabel} tone={roleTone} />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">{name ?? "No active assignment"}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {companyId ? `Company ID ${companyId}` : "No active account assigned right now."}
      </p>
    </div>
  );
}

function CountCard({
  roleLabel,
  roleTone,
  value,
}: {
  roleLabel: string;
  roleTone: "secretary" | "collector";
  value: string;
}) {
  return (
    <div className="flex h-full flex-col justify-center rounded-xl border border-border/70 bg-background px-4 py-4">
      <div>
        <RoleBadge label={roleLabel} tone={roleTone} />
      </div>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
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
    <div className="flex h-full flex-col justify-center rounded-xl border border-border/70 bg-background px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p
        className={
          tone === "warning"
            ? "mt-1.5 text-2xl font-semibold text-amber-700"
            : "mt-1.5 text-2xl font-semibold text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

export function BranchOverviewTab({ data }: { data: BranchDetailOverviewData }) {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-zinc-200/80 py-0 shadow-sm">
        <CardHeader className="space-y-3 rounded-t-[inherit] border-b bg-linear-to-r from-zinc-50 via-white to-slate-50/80 pb-4 pt-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Branch Overview
            </p>
            <p className="text-sm text-muted-foreground">
              Read-only branch summary for staffing, loan activity, and collections.
            </p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pb-6 md:grid-cols-2 xl:grid-cols-4 ">
          <DetailItem label="Municipality / City and Province" value={`${data.municipalityName}, ${data.provinceName}`} />
          <DetailItem label="Branch Code" value={data.branchCode} />
          <DetailItem label="Branch Address" value={data.branchAddress} />
          <DetailItem label="Date Created" value={formatDate(data.dateCreated)} />
        </CardContent>
      </Card>

      <Card className="border-border/70 py-0 shadow-sm">
        <CardHeader className="gap-0 pt-6">
          <CardTitle className="text-lg">Assigned Leadership and Staff Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 pb-6 md:grid-cols-2 xl:grid-cols-4">
          <LeadershipCard
            companyId={data.managerCompanyId}
            name={data.managerName}
            roleLabel="Branch Manager"
            roleTone="branchManager"
          />
          <LeadershipCard
            companyId={data.auditorCompanyId}
            name={data.auditorName}
            roleLabel="Auditor"
            roleTone="auditor"
          />
          <CountCard roleLabel="Secretaries" roleTone="secretary" value={String(data.secretaryCount)} />
          <CountCard roleLabel="Collectors" roleTone="collector" value={String(data.collectorCount)} />
        </CardContent>
      </Card>

      <Card className="border-border/70 py-0 shadow-sm">
        <CardHeader className="gap-0 pt-6">
          <CardTitle className="text-lg">Operational Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 pb-6 pt-0 sm:grid-cols-2 xl:grid-cols-5">
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
