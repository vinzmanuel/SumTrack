"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, CircleAlert, MapPin, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { BranchNetworkCardData } from "@/app/dashboard/branches/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
      <div className="mb-1 flex items-center gap-2 text-muted-foreground">
        <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{label}</span>
      </div>
      <p className="text-base font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function BranchNetworkCard({ branch }: { branch: BranchNetworkCardData }) {
  const href = `/dashboard/branches/${encodeURIComponent(branch.branchCode)}?source=branches&returnTo=${encodeURIComponent("/dashboard/branches")}`;

  return (
    <Link className="group block h-full" href={href}>
      <Card className="h-full border-border/70 py-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                  <BriefcaseBusiness className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-foreground transition-colors group-hover:text-emerald-700">
                    {branch.branchName}
                  </h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate">{branch.municipalityName}, {branch.provinceName}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-zinc-300 bg-background text-zinc-700" variant="outline">
                  {branch.branchCode}
                </Badge>
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
                  {branch.activeLoanCount + branch.overdueLoanCount} Live Loans
                </Badge>
              </div>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-colors group-hover:text-foreground">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Branch Manager
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">{branch.managerName ?? "No active manager assigned"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {branch.managerCompanyId ? `Company ID ${branch.managerCompanyId}` : branch.branchAddress}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatTile icon={<Users className="h-4 w-4" />} label="Collectors" value={String(branch.collectorCount)} />
            <StatTile icon={<Users className="h-4 w-4" />} label="Borrowers" value={String(branch.borrowerCount)} />
            <StatTile icon={<CircleAlert className="h-4 w-4" />} label="Overdue Loans" value={String(branch.overdueLoanCount)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatTile icon={<Wallet className="h-4 w-4" />} label="Collections This Month" value={formatCurrency(branch.collectionsThisMonth)} />
            <StatTile icon={<BriefcaseBusiness className="h-4 w-4" />} label="Active Loans" value={String(branch.activeLoanCount)} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
