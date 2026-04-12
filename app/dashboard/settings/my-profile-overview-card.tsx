import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { SelfProfileDetail } from "@/app/dashboard/settings/types";
import { formatStoredDateForManila } from "@/app/dashboard/datetime";

function formatDate(value: string | null) {
  return formatStoredDateForManila(value, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function MyProfileOverviewCard({ profile }: { profile: SelfProfileDetail }) {
  return (
    <Card className="gap-0 overflow-hidden rounded-md border-border/70 py-0 shadow-sm">
      <CardHeader className="space-y-3 border-b bg-muted/15 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">My Profile</p>
        <div className="space-y-0.5">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-foreground">{profile.fullName}</h2>
          <p className="text-base text-muted-foreground">{profile.companyId}</p>
          <p className="text-base text-muted-foreground">{profile.roleName}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 py-6">
        <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/15 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Branch / Area / Scope</p>
          <p className="text-base font-medium text-foreground">{profile.scopeLabel}</p>
        </div>
        <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/15 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Contact No.</p>
          <p className="text-base font-medium text-foreground">{profile.contactNo || "N/A"}</p>
        </div>
        <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/15 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Email</p>
          <p className="break-all text-base font-medium text-foreground">{profile.email || "N/A"}</p>
        </div>
        <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/15 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Date Created</p>
          <p className="text-base font-medium text-foreground">{formatDate(profile.dateCreated)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
