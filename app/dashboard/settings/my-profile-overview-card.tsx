import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { SelfProfileDetail } from "@/app/dashboard/settings/types";

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

function OverviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function MyProfileOverviewCard({ profile }: { profile: SelfProfileDetail }) {
  return (
    <Card className="border-zinc-200/80 shadow-sm xl:sticky xl:top-6">
      <CardHeader className="space-y-4 border-b bg-zinc-50/70 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            My Profile
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{profile.fullName}</h2>
          <p className="text-sm text-muted-foreground">
            This is your read-only account summary in SumTrack.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="border-zinc-200 bg-zinc-100 text-zinc-700" variant="outline">
            {profile.companyId}
          </Badge>
          <Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">
            {profile.roleName}
          </Badge>
          <Badge
            className={
              profile.status === "active"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }
            variant="outline"
          >
            {profile.status === "active" ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-6">
        <OverviewItem label="Branch / Area / Scope" value={profile.scopeLabel} />
        <OverviewItem label="Contact No." value={profile.contactNo || "N/A"} />
        <OverviewItem label="Email" value={profile.email || "N/A"} />
        <OverviewItem label="Date Created" value={formatDate(profile.dateCreated)} />
      </CardContent>
    </Card>
  );
}
