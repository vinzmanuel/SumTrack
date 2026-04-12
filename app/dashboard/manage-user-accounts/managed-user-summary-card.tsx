import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  UI_SURFACE_CLASS_NAME,
  getUiRoleBadgeClassName,
} from "@/app/dashboard/_components/ui-patterns";
import { formatStoredDateForManila } from "@/app/dashboard/datetime";

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
  const displayValue = label === "Date Created" ? formatDate(value) : value;

  return (
    <div className="space-y-1 rounded-md border border-border/70 bg-muted/20 px-3 py-3">
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
  headingName,
  subtitle,
  companyId,
  roleName,
  status,
  details,
  hideHeader,
}: {
  eyebrow: string;
  title: string;
  headingName?: string;
  subtitle: string;
  companyId: string;
  roleName: string;
  status: "active" | "inactive";
  details: Array<{ label: string; value: string | null | undefined }>;
  hideHeader?: boolean;
}) {
  return (
    <Card className={`${UI_SURFACE_CLASS_NAME} p-0 gap-0 overflow-hidden`}>
      {!hideHeader ? (
        <CardHeader className="space-y-4 border-b border-border/70 bg-muted/20 px-6 pb-5 pt-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{headingName ?? title}</h1>
            <span
              className={
                status === "active"
                  ? "inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium leading-none text-emerald-700 shadow-xs dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "inline-flex items-center rounded-md border border-zinc-200 bg-zinc-100 px-3 py-1 text-xs font-medium leading-none text-zinc-700 shadow-xs dark:border-zinc-500/30 dark:bg-zinc-500/10 dark:text-zinc-300"
              }
            >
              {status === "active" ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="mt-2 flex flex-col gap-0.5 text-sm text-muted-foreground">
            <p>{companyId}</p>
            <p>{roleName}</p>
            <p>{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      ) : null}
      <CardContent className="grid gap-3 p-6 md:grid-cols-2 xl:grid-cols-3">
        {details.map((detail) => (
          <DetailItem key={detail.label} label={detail.label} value={detail.value || "N/A"} />
        ))}
      </CardContent>
    </Card>
  );
}
