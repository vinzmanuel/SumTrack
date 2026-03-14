import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

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
  const displayValue = label === "Date Created" ? formatDate(value) : value;

  return (
    <div className="space-y-1 rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{displayValue}</p>
    </div>
  );
}

export function ManagedUserSummaryCard({
  eyebrow,
  title,
  subtitle,
  companyId,
  roleName,
  status,
  details,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  companyId: string;
  roleName: string;
  status: "active" | "inactive";
  details: Array<{ label: string; value: string | null | undefined }>;
}) {
  return (
    <Card className="border-zinc-200/80 shadow-sm">
      <CardHeader className="space-y-4 border-b bg-zinc-50/70 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="border-zinc-200 bg-zinc-100 text-zinc-700" variant="outline">
            {companyId}
          </Badge>
          <Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">
            {roleName}
          </Badge>
          <Badge
            className={
              status === "active"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }
            variant="outline"
          >
            {status === "active" ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 pb-6 pt-6 md:grid-cols-2 xl:grid-cols-3">
        {details.map((detail) => (
          <DetailItem key={detail.label} label={detail.label} value={detail.value || "N/A"} />
        ))}
      </CardContent>
    </Card>
  );
}
